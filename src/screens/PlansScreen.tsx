/**
 * src/screens/PlansScreen.tsx
 * ============================
 * Create and manage workout plans: assign exercises, set repeat days, toggle active.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createPlan, deletePlan, Plan, getPlans, updatePlan, cancelTodayPendingSessions
} from '../database/Database';
import { SystemButton, SystemInput, SectionHeader, EmptyState } from '../components/UIComponents';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PlansScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [plans, setPlans]             = useState<Plan[]>([]);
  const [createModal, setCreateModal] = useState(false);

  // Create plan form
  const [planName, setPlanName]     = useState('');
  const [planDesc, setPlanDesc]     = useState('');
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [penaltyExp, setPenaltyExp] = useState('0');

  const [editPlanModal, setEditPlanModal]   = useState(false);
  const [editPlanTarget, setEditPlanTarget] = useState<Plan | null>(null);
  const [editPlanName, setEditPlanName]     = useState('');
  const [editPlanDesc, setEditPlanDesc]     = useState('');
  const [editRepeatDays, setEditRepeatDays] = useState<string[]>([]);
  const [editPenaltyExp, setEditPenaltyExp] = useState('0');

  useFocusEffect(useCallback(() => { loadPlans(); }, []));

  const loadPlans = async () => setPlans(await getPlans());

  const openManage = (plan: Plan) => navigation.navigate('ManagePlan', { plan });

  const handleCreatePlan = async () => {
    if (!planName.trim()) return Alert.alert('System', 'Plan name required.');
    await createPlan({
      name: planName.trim(),
      description: planDesc.trim(),
      is_active: 0,
      repeat_days: JSON.stringify(repeatDays),
      penalty_exp: Number(penaltyExp) || 0,
    });
    setPlanName(''); setPlanDesc(''); setRepeatDays([]); setPenaltyExp('0');
    setCreateModal(false);
    await loadPlans();
  };

  const handleDeletePlan = (plan: Plan) =>
    Alert.alert('Delete Plan', `Remove "${plan.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await cancelTodayPendingSessions(plan.id!);   // ← add
          await deletePlan(plan.id!);
          await loadPlans();
        },
      },
    ]);

  const openEditPlan = (plan: Plan) => {
    setEditPlanTarget(plan);
    setEditPlanName(plan.name);
    setEditPlanDesc(plan.description);
    setEditRepeatDays(JSON.parse(plan.repeat_days || '[]'));
    setEditPenaltyExp(String(plan.penalty_exp ?? 0));
    setEditPlanModal(true);
  };

  const handleSaveEditPlan = async () => {
    if (!editPlanName.trim()) return Alert.alert('System', 'Plan name required.');
    await updatePlan(editPlanTarget!.id!, {
      name:        editPlanName.trim(),
      description: editPlanDesc.trim(),
      repeat_days: JSON.stringify(editRepeatDays),
      penalty_exp: Number(editPenaltyExp) || 0,
    });
    setEditPlanModal(false);
    setEditPlanTarget(null);
    await loadPlans();
  };

  const toggleEditDay = (day: string) =>
    setEditRepeatDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const handleToggleActive = async (plan: Plan) => {
    const next = plan.is_active ? 0 : 1;
    if (next === 0) {
      await cancelTodayPendingSessions(plan.id!);   // ← add: clean up on deactivate
    }
    await updatePlan(plan.id!, { is_active: next });
    await loadPlans();
  };

  const toggleDay = (day: string) =>
    setRepeatDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  return (
    <View style={styles.root}>
      <FlatList
        data={plans}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <SectionHeader title="Workout Plans"
            subtitle={`${plans.filter(p => p.is_active).length} active`}
            action={{ label: '+ Create', onPress: () => setCreateModal(true) }} />
        }
        ListEmptyComponent={<EmptyState icon="clipboard" title="No plans yet" subtitle="Create a plan and assign exercises." />}
        renderItem={({ item }) => (
          <PlanCard plan={item}
            onManage={() => openManage(item)}
            onToggle={() => handleToggleActive(item)}
            onDelete={() => handleDeletePlan(item)}
            onEdit={() => openEditPlan(item)} />
        )}
      />

      {/* ── Create Plan Modal ── */}
      <Modal visible={createModal} animationType="slide" transparent onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ NEW PLAN</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <SystemInput label="Plan Name" value={planName} onChangeText={setPlanName} placeholder="e.g. Morning Grind" />
              <SystemInput label="Description" value={planDesc} onChangeText={setPlanDesc} placeholder="Optional..." multiline />
              <Text style={styles.selectLbl}>REPEAT DAYS</Text>
              <View style={styles.dayRow}>
                {DAYS.map(d => (
                  <TouchableOpacity key={d} style={[styles.dayChip, repeatDays.includes(d) && styles.dayChipOn]} onPress={() => toggleDay(d)}>
                    <Text style={[styles.dayTxt, repeatDays.includes(d) && styles.dayTxtOn]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.hint}>Leave empty to add this plan manually from the dashboard.</Text>
              <SystemInput
                label="Missed Quest Penalty (EXP)"
                value={penaltyExp}
                onChangeText={setPenaltyExp}
                keyboardType="numeric"
                placeholder="0 = no penalty"
              />
              <Text style={styles.hint}>EXP deducted if you skip this quest for the day.</Text>
              <View style={styles.row}>
                <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={() => setCreateModal(false)} />
                <SystemButton title="Create" style={styles.flex1} onPress={handleCreatePlan} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT PLAN MODAL ── */}
      <Modal visible={editPlanModal} animationType="slide" transparent onRequestClose={() => setEditPlanModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ EDIT PLAN</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <SystemInput label="Plan Name" value={editPlanName} onChangeText={setEditPlanName} />
              <SystemInput label="Description" value={editPlanDesc} onChangeText={setEditPlanDesc} multiline />

              <Text style={styles.selectLbl}>REPEAT DAYS</Text>
              <View style={styles.dayRow}>
                {DAYS.map(d => (
                  <TouchableOpacity key={d}
                    style={[styles.dayChip, editRepeatDays.includes(d) && styles.dayChipOn]}
                    onPress={() => toggleEditDay(d)}>
                    <Text style={[styles.dayTxt, editRepeatDays.includes(d) && styles.dayTxtOn]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.hint}>Leave empty to add this plan manually from the dashboard.</Text>

              <SystemInput
                label="Missed Quest Penalty (EXP)"
                value={editPenaltyExp}
                onChangeText={setEditPenaltyExp}
                keyboardType="numeric"
                placeholder="0 = no penalty"
              />

              <View style={styles.row}>
                <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                  onPress={() => { setEditPlanModal(false); setEditPlanTarget(null); }} />
                <SystemButton title="Save" style={styles.flex1} onPress={handleSaveEditPlan} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── PlanCard ──────────────────────────────────

const PlanCard: React.FC<{ plan: Plan; onManage: () => void; onToggle: () => void; onDelete: () => void; onEdit: () => void }> =
  ({ plan, onManage, onToggle, onDelete, onEdit }) => {
    const days: string[] = JSON.parse(plan.repeat_days || '[]');
    return (
      <View style={[styles.planCard, plan.is_active ? styles.planCardOn : null]}>
        <TouchableOpacity style={styles.planMain} onPress={onManage} activeOpacity={0.8}>
          <View style={styles.planTop}>
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={[styles.activePill, plan.is_active ? styles.activePillOn : null]}>
              <Text style={[styles.activePillTxt, { color: plan.is_active ? COLORS.accentCyan : COLORS.textMuted }]}>
                {plan.is_active ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
          {!!plan.description && <Text style={styles.planDesc}>{plan.description}</Text>}
          <View style={styles.planDays}>
            {days.length > 0
              ? days.map(d => <View key={d} style={styles.dayPill}><Text style={styles.dayPillTxt}>{d}</Text></View>)
              : <Text style={styles.everyDay}>Manual — add from dashboard</Text>}
          </View>
          {/* Penalty indicator */}
          {plan.penalty_exp > 0 && (
            <View style={styles.penaltyRow}>
              <Ionicons name="warning" size={12} color={COLORS.accentRed} />
              <Text style={styles.penaltyTxt}>-{plan.penalty_exp} EXP if missed</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.planActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onToggle}>
            <Text style={[styles.actionTxt, { color: plan.is_active ? COLORS.accentRed : COLORS.accentGreen }]}>
              {plan.is_active ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
            <Text style={[styles.actionTxt, { color: COLORS.accentCyan }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
            <Text style={[styles.actionTxt, { color: COLORS.textMuted }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bgPrimary },
  list:         { padding: 16, paddingBottom: 100 },

  planCard:     { backgroundColor: COLORS.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderMain, marginBottom: 10, overflow: 'hidden' },
  planCardOn:   { borderColor: COLORS.accentCyan },
  planMain:     { padding: 13 },
  planTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  planName:     { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  planDesc:     { color: COLORS.textSecondary, fontSize: 12, marginBottom: 7 },
  planDays:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  dayPill:      { backgroundColor: COLORS.bgTertiary, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  dayPillTxt:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  everyDay:     { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic' },
  activePill:   { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  activePillOn: { backgroundColor: `${COLORS.accentCyan}18` },
  activePillTxt:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  planActions:  { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.borderDim },
  actionBtn:    { flex: 1, paddingVertical: 10, alignItems: 'center' },
  actionTxt:    { fontSize: 12, fontWeight: '700' },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '88%' },
  handle:       { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle:   { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },

  selectLbl:    { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  dayRow:       { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  dayChip:      { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, minWidth: 42, alignItems: 'center' },
  dayChipOn:    { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}18` },
  dayTxt:       { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  dayTxtOn:     { color: COLORS.accentCyan },
  hint:         { color: COLORS.textMuted, fontSize: 11, marginBottom: 16 },
  row:          { flexDirection: 'row', gap: 12, marginBottom: 8 },
  flex1:        { flex: 1 },

  penaltyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  penaltyTxt: { color: COLORS.accentRed, fontSize: 11, fontWeight: '600' },
});

export default PlansScreen;
