/**
 * src/screens/PlansScreen.tsx
 * ============================
 * Create and manage workout plans: assign exercises, set repeat days, toggle active.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView,
  Platform, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  createPlan, deletePlan, Plan, getPlans,
  getPlanExercises, getExercises, addExerciseToPlan,
  removeExerciseFromPlan, updatePlan, Exercise, PlanExercise,
} from '../database/Database';
import { SystemButton, SystemInput, SectionHeader, EmptyState } from '../components/UIComponents';
import { COLORS } from '../constants/game';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PlansScreen: React.FC = () => {
  const [plans, setPlans]                     = useState<Plan[]>([]);
  const [createModal, setCreateModal]         = useState(false);
  const [manageModal, setManageModal]         = useState(false);
  const [addExModal, setAddExModal]           = useState(false);
  const [selectedPlan, setSelectedPlan]       = useState<Plan | null>(null);
  const [planExercises, setPlanExercises]     = useState<PlanExercise[]>([]);
  const [allExercises, setAllExercises]       = useState<Exercise[]>([]);

  // Create plan form
  const [planName, setPlanName]     = useState('');
  const [planDesc, setPlanDesc]     = useState('');
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [penaltyExp, setPenaltyExp] = useState('0');

  // Add exercise form
  const [selExId, setSelExId] = useState<number | null>(null);
  const [sets, setSets]       = useState('3');
  const [reps, setReps]       = useState('10');

  const [editPlanModal, setEditPlanModal]   = useState(false);
  const [editPlanTarget, setEditPlanTarget] = useState<Plan | null>(null);
  const [editPlanName, setEditPlanName]     = useState('');
  const [editPlanDesc, setEditPlanDesc]     = useState('');
  const [editRepeatDays, setEditRepeatDays] = useState<string[]>([]);
  const [editPenaltyExp, setEditPenaltyExp] = useState('0');

  useFocusEffect(useCallback(() => { loadPlans(); }, []));

  const loadPlans = async () => setPlans(await getPlans());

  const openManage = async (plan: Plan) => {
    setSelectedPlan(plan);
    setPlanExercises(await getPlanExercises(plan.id!));
    setAllExercises(await getExercises());
    setManageModal(true);
  };

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
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlan(plan.id!); await loadPlans(); } },
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
    await updatePlan(plan.id!, { is_active: next });
    await loadPlans();
    if (selectedPlan?.id === plan.id) setSelectedPlan({ ...plan, is_active: next });
  };

  const handleAddExercise = async () => {
    if (!selExId) return Alert.alert('System', 'Select an exercise first.');
    if (isNaN(Number(sets)) || Number(sets) < 1) return Alert.alert('System', 'Enter valid sets.');
    if (isNaN(Number(reps)) || Number(reps) < 1) return Alert.alert('System', 'Enter valid reps.');
    await addExerciseToPlan({ plan_id: selectedPlan!.id!, exercise_id: selExId, sets: Number(sets), target: Number(reps), order_index: planExercises.length });
    setPlanExercises(await getPlanExercises(selectedPlan!.id!));
    setSelExId(null); setSets('3'); setReps('10');
    setAddExModal(false);
  };

  const handleRemoveExercise = async (peId: number) => {
    await removeExerciseFromPlan(peId);
    setPlanExercises(await getPlanExercises(selectedPlan!.id!));
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
        ListEmptyComponent={<EmptyState icon="📋" title="No plans yet" subtitle="Create a plan and assign exercises." />}
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
          <View style={styles.sheet}>
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
              <Text style={styles.hint}>Empty = generate every day when active.</Text>
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

      {/* ── Manage Plan Modal ── */}
      <Modal visible={manageModal} animationType="slide" transparent onRequestClose={() => setManageModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '92%' }]}>
            <View style={styles.handle} />
            <View style={styles.manageHdr}>
              <Text style={styles.sheetTitle}>◆ {selectedPlan?.name?.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setManageModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Active toggle */}
              <View style={styles.activeRow}>
                <View>
                  <Text style={styles.activeLbl}>ACTIVE</Text>
                  <Text style={styles.activeHint}>Generates daily sessions when on</Text>
                </View>
                <Switch
                  value={!!selectedPlan?.is_active}
                  onValueChange={() => { if (selectedPlan) handleToggleActive(selectedPlan); }}
                  trackColor={{ true: COLORS.accentCyan, false: COLORS.borderMain }}
                  thumbColor={selectedPlan?.is_active ? COLORS.bgPrimary : COLORS.textMuted}
                />
              </View>

              {/* Exercise list */}
              <SectionHeader title="Exercises" subtitle={`${planExercises.length} assigned`}
                action={{ label: '+ Add', onPress: () => setAddExModal(true) }} />
              {planExercises.length === 0
                ? <Text style={styles.noEx}>No exercises yet.</Text>
                : planExercises.map(pe => (
                  <View key={pe.id} style={styles.peRow}>
                    <View style={styles.peInfo}>
                      <Text style={styles.peName}>{pe.exercise_name}</Text>
                      <Text style={styles.peSets}>
                        {pe.sets} sets × {pe.target} {pe.unit_label ?? 'reps'}  ·  +{((pe.exp_per_unit ?? 2) * pe.target * pe.sets).toFixed(0)} EXP total
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveExercise(pe.id!)}>
                      <Text style={styles.peDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Exercise Modal ── */}
      <Modal visible={addExModal} animationType="fade" transparent onRequestClose={() => setAddExModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ ADD EXERCISE</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.selectLbl}>SELECT EXERCISE</Text>
              <ScrollView style={styles.exPickList} nestedScrollEnabled>
                {allExercises.map(ex => (
                  <TouchableOpacity key={ex.id} style={[styles.exPickItem, selExId === ex.id && styles.exPickItemOn]}
                    onPress={() => setSelExId(ex.id!)}>
                    <Text style={[styles.exPickTxt, selExId === ex.id && styles.exPickTxtOn]}>{ex.name}</Text>
                    <Text style={styles.exPickExp}>+{ex.exp_per_unit} EXP/{ex.unit_label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.row}>
                <SystemInput label="Sets" value={sets} onChangeText={setSets} keyboardType="numeric" style={styles.flex1} />
                <SystemInput
                  label={selExId && allExercises.find(e => e.id === selExId)?.unit_label
                    ? `Target (${allExercises.find(e => e.id === selExId)?.unit_label})`
                    : 'Target Amount'}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="decimal-pad"
                  style={styles.flex1}
                />
              </View>
              <View style={styles.row}>
                <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={() => setAddExModal(false)} />
                <SystemButton title="Add" style={styles.flex1} onPress={handleAddExercise} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT PLAN MODAL ── */}
      <Modal visible={editPlanModal} animationType="slide" transparent onRequestClose={() => setEditPlanModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}>
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
              <Text style={styles.hint}>Empty = generate every day when active.</Text>

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
              : <Text style={styles.everyDay}>Every day (when active)</Text>}
          </View>
          {/* Penalty indicator */}
          {plan.penalty_exp > 0 && (
            <Text style={styles.penaltyTxt}>⚠ -{plan.penalty_exp} EXP if missed</Text>
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
  manageHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  closeBtn:     { color: COLORS.textMuted, fontSize: 18, fontWeight: '700' },

  selectLbl:    { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  dayRow:       { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  dayChip:      { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, minWidth: 42, alignItems: 'center' },
  dayChipOn:    { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}18` },
  dayTxt:       { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  dayTxtOn:     { color: COLORS.accentCyan },
  hint:         { color: COLORS.textMuted, fontSize: 11, marginBottom: 16 },
  row:          { flexDirection: 'row', gap: 12, marginBottom: 8 },
  flex1:        { flex: 1 },

  activeRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim, marginBottom: 16 },
  activeLbl:    { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  activeHint:   { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  noEx:         { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  peRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim },
  peInfo:       { flex: 1 },
  peName:       { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  peSets:       { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  peDelete:     { color: COLORS.accentRed, fontSize: 16, fontWeight: '700', paddingLeft: 12 },

  exPickList:   { maxHeight: 180, marginBottom: 14 },
  exPickItem:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 8, marginBottom: 5 },
  exPickItemOn: { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}12` },
  exPickTxt:    { color: COLORS.textSecondary, fontSize: 14, flex: 1 },
  exPickTxtOn:  { color: COLORS.accentCyan },
  exPickExp:    { color: COLORS.textMuted, fontSize: 12 },
  penaltyTxt: { color: COLORS.accentRed, fontSize: 11, fontWeight: '600', marginTop: 5 },
});

export default PlansScreen;
