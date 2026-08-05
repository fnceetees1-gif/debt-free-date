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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Debt } from '../calculator';
import { loadDebts, saveDebts, generateId, FREE_DEBT_LIMIT } from '../storage';
import { applyPayment, recordPayment } from '../history';
import { usePro } from '../ProContext';

export default function DebtsScreen() {
  const { isPro, showPaywall } = usePro();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
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
    setEditing({ id: generateId(), name: '', balance: 0, apr: 0, minPayment: 0 });
    setIsNew(true);
    setModalVisible(true);
  };

  const openEdit = (d: Debt) => {
    setEditing({ ...d });
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
    setEditing(null);
  };

  const save = async () => {
    if (!editing || !editing.name.trim() || editing.balance <= 0) {
      Alert.alert('Missing info', 'Enter a name and a balance greater than 0.');
      return;
    }
    if (editing.apr < 0 || editing.apr > 1.5) {
      Alert.alert('Check the APR', 'Enter an APR between 0% and 150%.');
      return;
    }
    if (editing.minPayment < 0) {
      Alert.alert('Check the minimum payment', 'Minimum payment cannot be negative.');
      return;
    }

    // A minimum that doesn't cover the monthly interest means the balance grows
    // forever and the payoff simulation never terminates on its own. Let the
    // user save it anyway — it's their real situation — but don't let the
    // resulting "never" timeline look like a bug in the app.
    const monthlyInterest = editing.balance * (editing.apr / 12);
    if (editing.minPayment <= monthlyInterest) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Payment below interest',
          `At ${(editing.apr * 100).toFixed(2)}% APR this debt accrues about $${monthlyInterest.toFixed(
            2
          )} in interest per month, which is more than the $${editing.minPayment.toFixed(
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

    await commit(editing);
  };


  return (
    <View style={styles.container}>
      <FlatList
        data={debts}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => openEdit(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {(item.apr * 100).toFixed(2)}% APR - ${item.minPayment}/mo min
                </Text>
              </View>
              <Text style={styles.rowBalance}>
                ${item.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
              <TouchableOpacity onPress={() => remove(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>X</Text>
              </TouchableOpacity>
            </TouchableOpacity>
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
        <View style={styles.modalOverlay}>
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
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPayingFor(null)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={confirmPayment}>
                <Text style={styles.saveBtnText}>Log it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{isNew ? 'Add Debt' : 'Edit Debt'}</Text>
            <Field
              label="Name"
              value={editing?.name ?? ''}
              onChangeText={(v) => setEditing((e) => (e ? { ...e, name: v } : e))}
            />
            <Field
              label="Balance ($)"
              keyboardType="decimal-pad"
              value={editing ? String(editing.balance || '') : ''}
              onChangeText={(v) =>
                setEditing((e) => (e ? { ...e, balance: parseFloat(v) || 0 } : e))
              }
            />
            <Field
              label="APR (%)"
              keyboardType="decimal-pad"
              value={editing ? String((editing.apr || 0) * 100 || '') : ''}
              onChangeText={(v) =>
                setEditing((e) => (e ? { ...e, apr: (parseFloat(v) || 0) / 100 } : e))
              }
            />
            <Field
              label="Minimum payment ($/mo)"
              keyboardType="decimal-pad"
              value={editing ? String(editing.minPayment || '') : ''}
              onChangeText={(v) =>
                setEditing((e) => (e ? { ...e, minPayment: parseFloat(v) || 0 } : e))
              }
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  setEditing(null);
                }}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={save}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
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
    padding: 14,
  },
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
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: '#C33', fontSize: 16 },
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
