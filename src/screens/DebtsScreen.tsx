// src/screens/DebtsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Debt } from '../calculator';
import { loadDebts, saveDebts, generateId, FREE_DEBT_LIMIT } from '../storage';
import { applyPayment, recordPayment } from '../history';
import { usePro } from '../ProContext';

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

/** Parses a typed field. Tolerates "", ".", "5." and stray commas. */
function parseAmount(text: string): number {
  const n = parseFloat(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function DebtsScreen() {
  const { isPro, showPaywall } = usePro();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<DebtDraft>(EMPTY_DRAFT);
  const [isNew, setIsNew] = useState(false);
  const [payingFor, setPayingFor] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const refresh = useCallback(async () => {
    setDebts(await loadDebts());
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
    Alert.alert('Delete debt?', 'This cannot be undone.', [
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
    ]);
  };

  const openPayment = (d: Debt) => {
    setPayingFor(d);
    setPayAmount(String(d.minPayment || ''));
  };

  const confirmPayment = async () => {
    if (!payingFor) return;
    const amount = parseFloat(payAmount) || 0;
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
      Alert.alert(
        '🎉 Debt cleared',
        `${record.debtName} is paid off. Its $${payingFor.minPayment.toFixed(
          2
        )}/mo minimum now rolls into your next debt automatically.`
      );
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
        contentContainerStyle={{ padding: 16 }}
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
                    {(item.apr * 100).toFixed(2)}% APR · ${item.minPayment}/mo min
                  </Text>
                </View>
                <Text style={styles.rowBalance}>
                  ${item.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
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

      <Modal visible={payingFor !== null} animationType="slide" transparent>
        {/* The decimal keypad on iOS has no Done key, so tapping the dimmed area
            above the sheet is the way out. Without this the keyboard covers the
            Cancel/Log buttons and the modal becomes a dead end. */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Log payment</Text>
              <Text style={styles.payContext}>
                {payingFor?.name} — balance $
                {payingFor?.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
              {payingFor && (
                <Text style={styles.payBreakdown}>
                  About ${(payingFor.balance * (payingFor.apr / 12)).toFixed(2)} of this month's
                  payment goes to interest.
                </Text>
              )}
              <Field
                label="Amount paid ($)"
                keyboardType="decimal-pad"
                value={payAmount}
                onChangeText={setPayAmount}
                autoFocus
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
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{isNew ? 'Add Debt' : 'Edit Debt'}</Text>
              <Text style={styles.payBreakdown}>
                Tap anywhere above this card to close the keypad.
              </Text>
              <Field
                label="Name"
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
              />
              <Field
                label="Balance ($)"
                keyboardType="decimal-pad"
                value={draft.balance}
                onChangeText={(v) => setDraft((d) => ({ ...d, balance: v }))}
              />
              <Field
                label="APR (%)"
                keyboardType="decimal-pad"
                value={draft.apr}
                onChangeText={(v) => setDraft((d) => ({ ...d, apr: v }))}
              />
              <Field
                label="Minimum payment ($/mo)"
                keyboardType="decimal-pad"
                value={draft.minPayment}
                onChangeText={(v) => setDraft((d) => ({ ...d, minPayment: v }))}
              />
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
        </TouchableWithoutFeedback>
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
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
        autoFocus={props.autoFocus}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 12 },
  cancelBtn: { padding: 12 },
  saveBtn: { backgroundColor: '#1B1F3B', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  saveBtnText: { color: '#FFF', fontWeight: '600' },
});
