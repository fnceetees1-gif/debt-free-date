// src/screens/DebtsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Debt, priorityDebt } from '../calculator';
import {
  loadDebts,
  saveDebts,
  loadSettings,
  generateId,
  AppSettings,
  FREE_DEBT_LIMIT,
} from '../storage';
import { applyPayment, recordPayment } from '../history';
import { usePro } from '../ProContext';
import { parseAmount, formatMoney } from '../format';

/**
 * The debt form holds raw text, not numbers.
 *
 * Deriving the input value from parsed state (`String(apr * 100)`) makes it
 * impossible to type a decimal: the moment you type "5.", it parses to 5 and
 * re-renders as "5", eating the point. Keeping the text as typed and parsing
 * only on save is the only thing that behaves correctly.
 */
interface DebtDraft {
  id: string;
  name: string;
  balance: string;
  apr: string;
  minPayment: string;
}

const EMPTY_DRAFT: DebtDraft = { id: '', name: '', balance: '', apr: '', minPayment: '' };

export default function DebtsScreen() {
  const { isPro, showPaywall } = usePro();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  // These sheets sit flush against the bottom of the screen. Android runs
  // edge-to-edge, so without the inset the last row of the card — the Save
  // button — is drawn underneath the gesture navigation bar.
  const insets = useSafeAreaInsets();

  /**
   * The bottom inset is for the gesture navigation bar. When the keypad is up it
   * is already covering that strip, so reserving it a second time leaves a band
   * of dead white between the buttons and the keyboard — roughly the height of a
   * whole field, on a sheet that is short of room precisely when the keypad is
   * up. Reserve it only when there is no keypad to reserve it against.
   */
  const [keypadUp, setKeypadUp] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeypadUp(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeypadUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const sheetStyle = [
    styles.modalCard,
    { paddingBottom: 20 + (keypadUp ? 0 : insets.bottom) },
  ];
  const [debts, setDebts] = useState<Debt[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<DebtDraft>(EMPTY_DRAFT);
  const [isNew, setIsNew] = useState(false);
  const [payingFor, setPayingFor] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  // Needed for the payment prefill: the extra monthly payment lives in
  // settings, and without it the log always suggests the bare minimum.
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [prefillIncludedExtra, setPrefillIncludedExtra] = useState(false);

  const refresh = useCallback(async () => {
    const [d, s] = await Promise.all([loadDebts(), loadSettings()]);
    setDebts(d);
    setSettings(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const atFreeLimit = !isPro && debts.length >= FREE_DEBT_LIMIT;

  const openAdd = () => {
    if (atFreeLimit) {
      showPaywall(
        `The free version tracks ${FREE_DEBT_LIMIT} debts. Unlock Pro to add as many as you need.`
      );
      return;
    }
    setDraft({ ...EMPTY_DRAFT, id: generateId() });
    setIsNew(true);
    setModalVisible(true);
  };

  /**
   * "Add my first debt" on the empty Dashboard navigates here with openAdd, and
   * should land in the form rather than on a screen where you still have to
   * find the + button.
   *
   * The param is cleared before opening, otherwise returning to this tab later
   * pops the form open again for no reason.
   */
  useFocusEffect(
    useCallback(() => {
      if (route.params?.openAdd) {
        navigation.setParams({ openAdd: undefined });
        openAdd();
      }
      // openAdd is recreated every render; depending on it would re-run this
      // constantly. The param is the only thing that should trigger it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.openAdd])
  );

  const openEdit = (d: Debt) => {
    setDraft({
      id: d.id,
      name: d.name,
      balance: d.balance ? String(d.balance) : '',
      // Round to kill float artifacts like 5.500000000000001 from apr*100.
      apr: d.apr ? String(Math.round(d.apr * 100 * 10000) / 10000) : '',
      minPayment: d.minPayment ? String(d.minPayment) : '',
    });
    setIsNew(false);
    setModalVisible(true);
  };

  const remove = (id: string) => {
    // Payment history deliberately survives deleting a debt — see history.ts.
    // Saying so here stops people deleting everything and wondering why the
    // Progress tab still shows payments.
    Alert.alert(
      'Delete debt?',
      "Payments you've logged for it stay in your Progress history. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = debts.filter((d) => d.id !== id);
            setDebts(next);
            await saveDebts(next);
          },
        },
      ]
    );
  };

  /**
   * Prefills the minimum, plus the extra monthly payment when this is the debt
   * the strategy is actually targeting.
   *
   * The whole premise of the app is that the projection and the logged history
   * are comparable. The projection assumes the target debt gets minimum + extra
   * every month; the log used to suggest the bare minimum, so a user following
   * their own plan still logged payments that didn't match it, and the extra
   * they'd committed to never showed up in Progress. The plan said one thing and
   * the history said another, for no reason the user could see.
   *
   * Still just a prefill — it's selected on focus, so typing replaces it.
   */
  const openPayment = (d: Debt) => {
    const extra = settings?.extraMonthlyPayment ?? 0;
    const target = settings ? priorityDebt(debts, settings.strategy) : null;
    const withExtra = extra > 0 && target?.id === d.id;

    setPayingFor(d);
    setPrefillIncludedExtra(withExtra);
    const suggested = d.minPayment + (withExtra ? extra : 0);
    setPayAmount(suggested > 0 ? String(Math.round(suggested * 100) / 100) : '');
  };

  const confirmPayment = async () => {
    if (!payingFor) return;
    // Same parser as every other amount field. Using parseFloat here meant a
    // pasted "1,200" logged a $1 payment while the Balance field read 1200.
    const amount = parseAmount(payAmount);
    if (amount <= 0) {
      Alert.alert('Enter an amount', 'Payment must be greater than 0.');
      return;
    }

    const { record, newBalance } = applyPayment(payingFor, amount);
    await recordPayment(record);

    const next = debts.map((d) =>
      d.id === payingFor.id ? { ...d, balance: newBalance } : d
    );
    setDebts(next);
    await saveDebts(next);
    setPayingFor(null);

    if (record.clearedDebt) {
      // There is no "next debt" to roll into when this was the last one, and
      // promising a rollover that cannot happen sours the best moment the app
      // has to offer.
      const remaining = next.filter((d) => d.balance > 0.01);
      if (remaining.length === 0) {
        Alert.alert(
          '🎉 You are debt free',
          `${record.debtName} is paid off — and it was your last one. Every debt you tracked here is gone.`
        );
      } else {
        Alert.alert(
          '🎉 Debt cleared',
          `${record.debtName} is paid off. Its ${formatMoney(
            payingFor.minPayment
          )}/mo minimum now rolls into your next debt automatically.`
        );
      }
    }
  };

  const commit = async (debt: Debt) => {
    const exists = debts.some((d) => d.id === debt.id);
    const next = exists ? debts.map((d) => (d.id === debt.id ? debt : d)) : [...debts, debt];
    setDebts(next);
    await saveDebts(next);
    setModalVisible(false);
    setDraft(EMPTY_DRAFT);
  };

  const save = async () => {
    // Text becomes numbers here and nowhere else.
    const debt: Debt = {
      id: draft.id,
      name: draft.name.trim(),
      balance: parseAmount(draft.balance),
      apr: parseAmount(draft.apr) / 100,
      minPayment: parseAmount(draft.minPayment),
    };

    if (!debt.name || debt.balance <= 0) {
      Alert.alert('Missing info', 'Enter a name and a balance greater than 0.');
      return;
    }
    if (debt.apr < 0 || debt.apr > 1.5) {
      Alert.alert('Check the APR', 'Enter an APR between 0% and 150%.');
      return;
    }
    if (debt.minPayment < 0) {
      Alert.alert('Check the minimum payment', 'Minimum payment cannot be negative.');
      return;
    }

    // A minimum that doesn't cover the monthly interest means the balance grows
    // forever and the payoff simulation never terminates on its own. Let the
    // user save it anyway — it's their real situation — but don't let the
    // resulting "never" timeline look like a bug in the app.
    const monthlyInterest = debt.balance * (debt.apr / 12);
    if (debt.minPayment <= monthlyInterest) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Payment below interest',
          `At ${(debt.apr * 100).toFixed(2)}% APR this debt accrues about $${monthlyInterest.toFixed(
            2
          )} in interest per month, which is more than the $${debt.minPayment.toFixed(
            2
          )} minimum you entered. The balance will grow instead of shrink unless you add an extra monthly payment.`,
          [
            { text: 'Go back', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Save anyway', onPress: () => resolve(true) },
          ]
        );
      });
      if (!proceed) return;
    }

    await commit(debt);
  };


  return (
    <View style={styles.container}>
      <FlatList
        data={debts}
        keyExtractor={(d) => d.id}
        // The FAB is 56pt tall sitting 24pt off the bottom, so it covers the
        // last ~96pt of the list. With 16pt of padding the final debt's "Log
        // payment" button ends up underneath it once the list is long enough to
        // scroll — invisible at the 2-debt free limit, obvious to a Pro user.
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Delete must be a SIBLING of the edit target, not nested inside it.
                A TouchableOpacity inside another TouchableOpacity loses the tap
                to the outer one on iOS, so the old delete just opened Edit. */}
            <View style={styles.row}>
              <TouchableOpacity style={styles.rowMain} onPress={() => openEdit(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowSub}>
                    {(item.apr * 100).toFixed(2)}% APR · {formatMoney(item.minPayment)}/mo min
                  </Text>
                </View>
                <Text style={styles.rowBalance}>{formatMoney(item.balance)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => remove(item.id)}
                style={styles.deleteBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={`Delete ${item.name}`}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.logBtn} onPress={() => openPayment(item)}>
              <Text style={styles.logBtnText}>Log payment</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No debts yet. Tap + to add your first one.</Text>
        }
        ListFooterComponent={
          atFreeLimit ? (
            <TouchableOpacity style={styles.limitBanner} onPress={() => showPaywall()}>
              <Text style={styles.limitTitle}>
                Free version limit reached ({FREE_DEBT_LIMIT} debts)
              </Text>
              <Text style={styles.limitBody}>Unlock Pro to track unlimited debts →</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <TouchableOpacity style={[styles.fab, atFreeLimit && styles.fabLocked]} onPress={openAdd}>
        <Text style={styles.fabText}>{atFreeLimit ? '🔒' : '+'}</Text>
      </TouchableOpacity>

      {/* onRequestClose is the Android back button. Without it, back does
          nothing while this sheet is open and the only way out is finding the
          Cancel button — iOS has no back button, so this only ever broke on
          Android. */}
      <Modal
        visible={payingFor !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          setPayingFor(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          // "padding" on BOTH platforms, not just iOS.
          //
          // app.json leaves softwareKeyboardLayoutMode at Expo's default of
          // "resize", so the Android activity does move out of the keyboard's
          // way — but a React Native <Modal> renders in its own window, and
          // that window doesn't inherit the behaviour. Leaving this undefined on
          // Android meant nothing moved at all: the keypad opened straight over
          // the sheet, covering the field being typed into and the buttons.
          //
          // padding suits a bottom sheet: bottom padding equal to the keyboard
          // height lifts the card clear of it. Double-counting isn't a risk here
          // precisely because the modal window is the one thing that doesn't
          // resize.
          behavior="padding"
        >
          {/* Tap the dimmed area to dismiss the keypad — the decimal pad has no
              Done key of its own. This is a SIBLING of the sheet, not a wrapper
              around it: wrapping the whole overlay put every control on the card
              inside a competing touch handler. */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          <View style={sheetStyle}>
              <Text style={styles.modalTitle}>Log payment</Text>
              <Text style={styles.payContext}>
                {payingFor?.name} — balance {payingFor ? formatMoney(payingFor.balance) : ''}
              </Text>
              {payingFor && (
                <Text style={styles.payBreakdown}>
                  About {formatMoney(payingFor.balance * (payingFor.apr / 12))} of this month's
                  payment goes to interest.
                </Text>
              )}
              {/* Say where the number came from. A prefill larger than the
                  minimum is alarming if you can't see why. */}
              {prefillIncludedExtra && payingFor && settings && (
                <Text style={styles.payPlanNote}>
                  This is your target debt, so the suggested amount is the{' '}
                  {formatMoney(payingFor.minPayment)} minimum plus your{' '}
                  {formatMoney(settings.extraMonthlyPayment)} extra payment.
                </Text>
              )}
              <Field
                label="Amount paid ($)"
                keyboardType="decimal-pad"
                value={payAmount}
                onChangeText={setPayAmount}
                autoFocus
                // Prefilled with the minimum (plus the extra payment on the
                // target debt), which is usually right but often needs
                // replacing. Select it so typing overwrites rather than
                // appending to it.
                selectTextOnFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    setPayingFor(null);
                  }}
                >
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={confirmPayment}>
                  <Text style={styles.saveBtnText}>Log it</Text>
                </TouchableOpacity>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Same Android back-button fix as the payment sheet above. Discards the
          draft, which is what Cancel does and what back should mean. */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          // See the note on the payment sheet above — "padding" on both
          // platforms, because a React Native Modal on Android renders in its
          // own window and doesn't inherit the activity's resize behaviour.
          behavior="padding"
        >
          {/* Backdrop as a sibling, not a wrapper. Wrapping the overlay put the
              Done button inside a competing touch handler, which is why it
              appeared not to respond. */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          <View style={sheetStyle}>
              {/* There used to be a "Done" button here whose only action was
                  Keyboard.dismiss. It existed because the decimal keypad has no
                  Done key of its own and the keypad used to cover Save and
                  Cancel — dismissing it was the only way to reach them.

                  That is no longer true: the sheet now lifts above the keypad
                  and the buttons are pinned, so the keypad never hides anything
                  that matters. What was left was a button labelled "Done" that
                  did not finish anything — it slid the keypad away, or did
                  nothing at all if the keypad was already down. Reported, quite
                  reasonably, as "Done does not respond". A control whose only
                  effect is invisible is worse than no control. */}
              <Text style={styles.modalHeading}>{isNew ? 'Add Debt' : 'Edit Debt'}</Text>
              {/* Scrolling the fields — and only the fields — keeps Save pinned
                  and reachable no matter how little room is left. flexShrink
                  lets it give up height inside the card's maxHeight rather than
                  pushing the buttons off the bottom.

                  There used to be a scroll-to-end on focusing the lower fields,
                  from when the keypad covered the sheet entirely. Now that the
                  sheet lifts clear it over-corrected: focusing APR scrolled Name
                  off the top of a form that would otherwise have fitted. Removed
                  — with the dead inset reclaimed above, all four fields fit with
                  the keypad up, and manual scrolling covers the short screens
                  that still don't. */}
              <ScrollView
                style={{ flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <Field
                label="Name"
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
              />
              <Field
                label="Balance ($)"
                keyboardType="decimal-pad"
                placeholder="2500"
                value={draft.balance}
                onChangeText={(v) => setDraft((d) => ({ ...d, balance: v }))}
              />
              <Field
                label="APR (%)"
                keyboardType="decimal-pad"
                placeholder="19.99"
                hint="5.5 is five and a half percent."
                value={draft.apr}
                onChangeText={(v) => setDraft((d) => ({ ...d, apr: v }))}
              />
              <Field
                label="Minimum payment ($/mo)"
                keyboardType="decimal-pad"
                placeholder="75"
                value={draft.minPayment}
                onChangeText={(v) => setDraft((d) => ({ ...d, minPayment: v }))}
              />
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    setModalVisible(false);
                    setDraft(EMPTY_DRAFT);
                  }}
                >
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={save}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  autoFocus?: boolean;
  placeholder?: string;
  hint?: string;
  selectTextOnFocus?: boolean;
  onFocus?: () => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
        autoFocus={props.autoFocus}
        placeholder={props.placeholder}
        placeholderTextColor="#AAB"
        selectTextOnFocus={props.selectTextOnFocus}
        onFocus={props.onFocus}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
      {props.hint ? <Text style={styles.fieldHint}>{props.hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logBtn: {
    borderTopWidth: 1,
    borderTopColor: '#F0F1F5',
    paddingVertical: 10,
    alignItems: 'center',
  },
  logBtnText: { color: '#1B1F3B', fontWeight: '600', fontSize: 13 },
  payContext: { fontSize: 14, color: '#444', marginBottom: 4 },
  payBreakdown: { fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 17 },
  payPlanNote: {
    fontSize: 12,
    color: '#2A5E3F',
    backgroundColor: '#EAF7F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    marginTop: -8,
    lineHeight: 17,
  },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  rowBalance: { fontSize: 15, fontWeight: '700', marginRight: 10 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  deleteBtnText: { color: '#C33', fontSize: 17, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B1F3B',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabLocked: { backgroundColor: '#6E73A8' },
  fabText: { color: '#FFF', fontSize: 24, marginTop: -2 },
  limitBanner: {
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 80,
  },
  limitTitle: { fontWeight: '700', fontSize: 13, color: '#5A4A20' },
  limitBody: { fontSize: 13, color: '#5A4A20', marginTop: 4 },
  // No justifyContent needed any more — the backdrop is a flex:1 sibling that
  // pushes the sheet to the bottom on its own.
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  backdrop: { flex: 1 },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    // Bounded so a tall form can never grow past the screen and carry the
    // buttons off the bottom with it; the fields scroll inside instead.
    //
    // 93%, not 88%. With the keypad up the form came out about four points
    // taller than the space, so the minimum payment field needed a nudge of a
    // scroll to reach — the most annoying possible margin to miss by. The extra
    // 5%, a shorter APR hint and slightly tighter field spacing put all four
    // fields on screen at once.
    maxHeight: '93%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalHeading: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  fieldHint: { fontSize: 11, color: '#888', marginTop: 4, lineHeight: 15 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, gap: 12 },
  cancelBtn: { padding: 12 },
  saveBtn: { backgroundColor: '#1B1F3B', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  saveBtnText: { color: '#FFF', fontWeight: '600' },
});
