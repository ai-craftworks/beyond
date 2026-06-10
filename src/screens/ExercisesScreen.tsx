import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createExercise, updateExercise, deleteExercise, Exercise, getExercises } from '../database/Database';
import { SystemButton, SystemInput, SectionHeader, EmptyState } from '../components/UIComponents';
import { COLORS, EXERCISE_CATEGORIES, STATS, UNIT_TYPES } from '../constants/game';

// ── Helper: compute EXP preview ──────────────
// "1 EXP per 10 reps" doing 50 reps → (50 / 10) * 1 = 5 EXP
const computeExpPreview = (amount: number, expPerUnit: number, expUnitCount: number) =>
  expUnitCount > 0 ? (amount / expUnitCount) * expPerUnit : 0;

const ExercisesScreen: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [modal, setModal]         = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Exercise | null>(null);
  const [loading, setLoading]     = useState(false);

  // ── Create form state ──
  const [name, setName]                   = useState('');
  const [desc, setDesc]                   = useState('');
  const [unitType, setUnitType]           = useState('reps');
  const [expPerUnit, setExpPerUnit]       = useState('1');
  const [expUnitCount, setExpUnitCount]   = useState('10');
  const [expPerStatPt, setExpPerStatPt]   = useState('20');
  const [statType, setStatType]           = useState('strength');
  const [category, setCategory]           = useState('strength');

  // ── Edit form state ──
  const [eName, setEName]                 = useState('');
  const [eDesc, setEDesc]                 = useState('');
  const [eUnitType, setEUnitType]         = useState('reps');
  const [eExpPerUnit, setEExpPerUnit]     = useState('1');
  const [eExpUnitCount, setEExpUnitCount] = useState('10');
  const [eExpPerStatPt, setEExpPerStatPt] = useState('20');
  const [eStatType, setEStatType]         = useState('strength');
  const [eCategory, setECategory]         = useState('strength');

  useFocusEffect(useCallback(() => { load(); }, []));
  const load = async () => setExercises(await getExercises());

  const resetCreate = () => {
    setName(''); setDesc(''); setUnitType('reps');
    setExpPerUnit('1'); setExpUnitCount('10'); setExpPerStatPt('20');
    setStatType('strength'); setCategory('strength');
  };

  const handleCreate = async () => {
    if (!name.trim()) return Alert.alert('System', 'Exercise name required.');
    const epu = Number(expPerUnit), euc = Number(expUnitCount), epsp = Number(expPerStatPt);
    if (isNaN(epu) || epu <= 0) return Alert.alert('System', 'EXP gained must be greater than 0.');
    if (isNaN(euc) || euc <= 0) return Alert.alert('System', 'Unit count must be greater than 0.');
    if (isNaN(epsp) || epsp <= 0) return Alert.alert('System', 'EXP per stat point must be greater than 0.');
    const unit = UNIT_TYPES.find(u => u.value === unitType)!;
    setLoading(true);
    try {
      await createExercise({
        name: name.trim(), description: desc.trim(),
        exp_reward: epu, unit_type: unitType,
        exp_per_unit: epu, exp_unit_count: euc,
        unit_label: unit.suffix, exp_per_stat_point: epsp,
        stat_type: statType, stat_reward: 1, category,
      });
      resetCreate(); setModal(false); await load();
    } catch (e) {
      Alert.alert('Error', 'Failed to create exercise.');
      console.error(e);
    } finally { setLoading(false); }
  };

  const openEdit = (ex: Exercise) => {
    setEditTarget(ex);
    setEName(ex.name); setEDesc(ex.description);
    setEUnitType(ex.unit_type ?? 'reps');
    setEExpPerUnit(String(ex.exp_per_unit ?? ex.exp_reward ?? 1));
    setEExpUnitCount(String(ex.exp_unit_count ?? 10));
    setEExpPerStatPt(String(ex.exp_per_stat_point ?? 20));
    setEStatType(ex.stat_type); setECategory(ex.category);
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!eName.trim()) return Alert.alert('System', 'Exercise name required.');
    const epu = Number(eExpPerUnit), euc = Number(eExpUnitCount), epsp = Number(eExpPerStatPt);
    if (isNaN(epu) || epu <= 0) return Alert.alert('System', 'EXP gained must be greater than 0.');
    if (isNaN(euc) || euc <= 0) return Alert.alert('System', 'Unit count must be greater than 0.');
    if (isNaN(epsp) || epsp <= 0) return Alert.alert('System', 'EXP per stat point must be greater than 0.');
    const unit = UNIT_TYPES.find(u => u.value === eUnitType)!;
    setLoading(true);
    try {
      await updateExercise(editTarget!.id!, {
        name: eName.trim(), description: eDesc.trim(),
        exp_reward: epu, unit_type: eUnitType,
        exp_per_unit: epu, exp_unit_count: euc,
        unit_label: unit.suffix, exp_per_stat_point: epsp,
        stat_type: eStatType, stat_reward: 1, category: eCategory,
      });
      setEditModal(false); setEditTarget(null); await load();
    } catch (e) {
      Alert.alert('Error', 'Failed to update exercise.');
    } finally { setLoading(false); }
  };

  const handleDelete = (ex: Exercise) =>
    Alert.alert('Delete', `Remove "${ex.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExercise(ex.id!); await load(); } },
    ]);

  const accentForCat = (cat: string) => {
    const stat = EXERCISE_CATEGORIES.find(c => c.value === cat)?.stat;
    return STATS.find(s => s.key === stat)?.color ?? COLORS.textSecondary;
  };

  const selectedUnit     = UNIT_TYPES.find(u => u.value === unitType);
  const selectedEditUnit = UNIT_TYPES.find(u => u.value === eUnitType);

  // Preview: doing 1 full set of target (use expUnitCount itself as sample)
  const createPreview = computeExpPreview(Number(expUnitCount) || 10, Number(expPerUnit) || 1, Number(expUnitCount) || 10);
  const editPreview   = computeExpPreview(Number(eExpUnitCount) || 10, Number(eExpPerUnit) || 1, Number(eExpUnitCount) || 10);

  return (
    <View style={styles.root}>
      <FlatList
        data={exercises}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <SectionHeader title="Exercise Library" subtitle={`${exercises.length} exercises`}
            action={{ label: '+ Create', onPress: () => setModal(true) }} />
        }
        ListEmptyComponent={<EmptyState icon="🏋️" title="No exercises yet" subtitle="Create your first exercise." />}
        renderItem={({ item }) => {
          const epu  = item.exp_per_unit  ?? item.exp_reward ?? 2;
          const euc  = item.exp_unit_count ?? 1;
          const epsp = item.exp_per_stat_point ?? 20;
          const lbl  = item.unit_label ?? 'reps';
          return (
            <View style={[styles.card, { borderLeftColor: accentForCat(item.category) }]}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.name}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                    <Text style={styles.editBtnTxt}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
              <View style={styles.tags}>
                <View style={styles.tag}>
                  <Text style={styles.tagTxt}>{epu} EXP / {euc} {lbl}</Text>
                </View>
                <View style={[styles.tag, { borderColor: accentForCat(item.category) }]}>
                  <Text style={[styles.tagTxt, { color: accentForCat(item.category) }]}>
                    +1 {item.stat_type.toUpperCase()} / {epsp} EXP
                  </Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagTxt}>{lbl}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* ── CREATE MODAL ── */}
      <ExerciseFormModal
        visible={modal}
        title="◆ NEW EXERCISE"
        name={name} setName={setName}
        desc={desc} setDesc={setDesc}
        unitType={unitType} setUnitType={setUnitType}
        expPerUnit={expPerUnit} setExpPerUnit={setExpPerUnit}
        expUnitCount={expUnitCount} setExpUnitCount={setExpUnitCount}
        expPerStatPt={expPerStatPt} setExpPerStatPt={setExpPerStatPt}
        statType={statType} setStatType={setStatType}
        category={category} setCategory={cat => { setCategory(cat); setStatType(EXERCISE_CATEGORIES.find(c => c.value === cat)?.stat ?? 'strength'); }}
        selectedUnit={selectedUnit}
        preview={createPreview}
        loading={loading}
        onSubmit={handleCreate}
        onCancel={() => { resetCreate(); setModal(false); }}
        submitLabel="Create"
      />

      {/* ── EDIT MODAL ── */}
      <ExerciseFormModal
        visible={editModal}
        title="◆ EDIT EXERCISE"
        name={eName} setName={setEName}
        desc={eDesc} setDesc={setEDesc}
        unitType={eUnitType} setUnitType={setEUnitType}
        expPerUnit={eExpPerUnit} setExpPerUnit={setEExpPerUnit}
        expUnitCount={eExpUnitCount} setExpUnitCount={setEExpUnitCount}
        expPerStatPt={eExpPerStatPt} setExpPerStatPt={setEExpPerStatPt}
        statType={eStatType} setStatType={setEStatType}
        category={eCategory} setCategory={cat => { setECategory(cat); setEStatType(EXERCISE_CATEGORIES.find(c => c.value === cat)?.stat ?? 'strength'); }}
        selectedUnit={selectedEditUnit}
        preview={editPreview}
        loading={loading}
        onSubmit={handleSaveEdit}
        onCancel={() => { setEditModal(false); setEditTarget(null); }}
        submitLabel="Save"
      />
    </View>
  );
};

// ── Shared form modal component ───────────────

interface FormModalProps {
  visible: boolean; title: string;
  name: string; setName: (v: string) => void;
  desc: string; setDesc: (v: string) => void;
  unitType: string; setUnitType: (v: string) => void;
  expPerUnit: string; setExpPerUnit: (v: string) => void;
  expUnitCount: string; setExpUnitCount: (v: string) => void;
  expPerStatPt: string; setExpPerStatPt: (v: string) => void;
  statType: string; setStatType: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  selectedUnit: typeof UNIT_TYPES[number] | undefined;
  preview: number; loading: boolean;
  onSubmit: () => void; onCancel: () => void; submitLabel: string;
}

const ExerciseFormModal: React.FC<FormModalProps> = ({
  visible, title, name, setName, desc, setDesc,
  unitType, setUnitType, expPerUnit, setExpPerUnit,
  expUnitCount, setExpUnitCount, expPerStatPt, setExpPerStatPt,
  statType, setStatType, category, setCategory,
  selectedUnit, preview, loading, onSubmit, onCancel, submitLabel,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}>

          <SystemInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Push-ups" />
          <SystemInput label="Description" value={desc} onChangeText={setDesc} placeholder="Optional..." multiline />

          {/* Unit type */}
          <Text style={styles.selectLbl}>UNIT TYPE</Text>
          <View style={styles.chips}>
            {UNIT_TYPES.map(u => (
              <TouchableOpacity key={u.value}
                style={[styles.chip, unitType === u.value && styles.chipOn]}
                onPress={() => setUnitType(u.value)}>
                <Text style={[styles.chipTxt, unitType === u.value && styles.chipTxtOn]}>{u.label}</Text>
                <Text style={styles.chipDesc}>{u.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* EXP rate — two fields: "X EXP per Y units" */}
          <Text style={styles.selectLbl}>EXP RATE</Text>
          <View style={styles.expRateRow}>
            <SystemInput
              label="EXP Gained"
              value={expPerUnit}
              onChangeText={setExpPerUnit}
              keyboardType="decimal-pad"
              placeholder="1"
              style={styles.flex1}
            />
            <Text style={styles.perText}>per</Text>
            <SystemInput
              label={`${selectedUnit?.suffix ?? 'units'}`}
              value={expUnitCount}
              onChangeText={setExpUnitCount}
              keyboardType="decimal-pad"
              placeholder="10"
              style={styles.flex1}
            />
          </View>
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>
              {expPerUnit || '?'} EXP per {expUnitCount || '?'} {selectedUnit?.suffix ?? 'units'}
            </Text>
            <Text style={styles.previewExamples}>
              10 {selectedUnit?.suffix ?? 'units'} → {computeExpPreview(10, Number(expPerUnit)||0, Number(expUnitCount)||1).toFixed(2)} EXP{'   '}
              50 {selectedUnit?.suffix ?? 'units'} → {computeExpPreview(50, Number(expPerUnit)||0, Number(expUnitCount)||1).toFixed(2)} EXP{'   '}
              100 {selectedUnit?.suffix ?? 'units'} → {computeExpPreview(100, Number(expPerUnit)||0, Number(expUnitCount)||1).toFixed(2)} EXP
            </Text>
          </View>

          {/* Stat gain rate */}
          <Text style={styles.selectLbl}>STAT GAIN RATE</Text>
          <SystemInput
            label={`EXP needed for +1 ${statType.toUpperCase()} point`}
            value={expPerStatPt}
            onChangeText={setExpPerStatPt}
            keyboardType="decimal-pad"
            placeholder="20"
          />
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>
              Every {expPerStatPt || '?'} EXP from this exercise = +1 {statType.toUpperCase()}
            </Text>
            <Text style={styles.previewExamples}>
              Example: earn {Number(expPerStatPt)*3 || '?'} EXP → +3 {statType.toUpperCase()}
            </Text>
          </View>

          {/* Category */}
          <Text style={styles.selectLbl}>CATEGORY</Text>
          <View style={styles.chips}>
            {EXERCISE_CATEGORIES.map(c => (
              <TouchableOpacity key={c.value}
                style={[styles.chip, category === c.value && styles.chipOn]}
                onPress={() => setCategory(c.value)}>
                <Text style={[styles.chipTxt, category === c.value && styles.chipTxtOn]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stat type override */}
          <Text style={styles.selectLbl}>STAT BOOSTED</Text>
          <View style={styles.chips}>
            {STATS.map(s => (
              <TouchableOpacity key={s.key}
                style={[styles.chip, statType === s.key && styles.chipOn]}
                onPress={() => setStatType(s.key)}>
                <Text style={[styles.chipTxt, statType === s.key && styles.chipTxtOn]}>
                  {s.icon} {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={onCancel} />
            <SystemButton title={submitLabel} style={styles.flex1} onPress={onSubmit} loading={loading} />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bgPrimary },
  list:       { padding: 16, paddingBottom: 100 },
  card:       { backgroundColor: COLORS.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderMain, borderLeftWidth: 3, padding: 13, marginBottom: 9 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardName:   { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  cardDesc:   { color: COLORS.textSecondary, fontSize: 12, marginBottom: 7 },
  cardActions:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn:    { padding: 4 },
  editBtnTxt: { color: COLORS.accentCyan, fontSize: 16, fontWeight: '700' },
  deleteBtn:  { color: COLORS.accentRed, fontSize: 16, fontWeight: '700', paddingLeft: 4 },
  tags:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  tag:        { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  tagTxt:     { color: COLORS.accentCyan, fontSize: 10, fontWeight: '700' },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '95%' },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },

  selectLbl:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  chip:       { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn:     { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}18` },
  chipTxt:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTxtOn:  { color: COLORS.accentCyan },
  chipDesc:   { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },

  expRateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  perText:    { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', paddingBottom: 16 },
  previewBox: { backgroundColor: COLORS.bgTertiary, borderRadius: 8, padding: 10, marginBottom: 14, borderLeftWidth: 2, borderLeftColor: COLORS.accentCyan },
  previewText:{ color: COLORS.accentCyan, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  previewExamples: { color: COLORS.textMuted, fontSize: 11 },

  row:        { flexDirection: 'row', gap: 12, marginBottom: 6 },
  flex1:      { flex: 1 },
});

export default ExercisesScreen;