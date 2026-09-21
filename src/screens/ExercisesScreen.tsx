import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createExercise, deleteExercise, updateExercise, Exercise, getExercises } from '../database/Database';
import { SystemButton, SystemInput, SectionHeader, EmptyState, SystemDropdown, SystemMultiDropdown } from '../components/UIComponents';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, EXERCISE_CATEGORIES, STATS, UNIT_TYPES, BODY_PARTS, bodyPartLabel, parseBodyParts } from '../constants/game';
import { filterExercises } from '../utils/filterExercises';

const ExercisesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [modal, setModal]         = useState(false);
  const [loading, setLoading]     = useState(false);

  const [editModal, setEditModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Exercise | null>(null);
  const [editName, setEditName]       = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [editUnitType, setEditUnitType]   = useState('reps');
  const [editExpPerUnit, setEditExpPerUnit] = useState('2');
  const [editExpUnitCount, setEditExpUnitCount] = useState('1');
  const [editStatType, setEditStatType]   = useState('strength');
  const [editExpPerStatPt, setEditExpPerStatPt] = useState('20');
  const [editCategory, setEditCategory]   = useState('strength');
  const [editBodyParts, setEditBodyParts] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const [name, setName]               = useState('');
  const [desc, setDesc]               = useState('');
  const [unitType, setUnitType]       = useState('reps');
  const [expPerUnit, setExpPerUnit]   = useState('2');
  const [expUnitCount, setExpUnitCount] = useState('1');
  const [statType, setStatType]       = useState('strength');
  const [category, setCategory]       = useState('strength');
  const [bodyParts, setBodyParts]     = useState<string[]>([]);
  const [expPerStatPt, setExpPerStatPt] = useState('20');

  // List search / filters
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('all');
  const [partFilter, setPartFilter] = useState<string[]>([]);

  useFocusEffect(useCallback(() => { load(); }, []));
  const load = async () => setExercises(await getExercises());

  const resetForm = () => {
    setName(''); setDesc(''); setUnitType('reps'); setExpPerUnit('2');
    setExpUnitCount('1');
    setExpPerStatPt('20');
    setStatType('strength'); setCategory('strength'); setBodyParts([]);
  };

  const handleCreate = async () => {
    if (!name.trim())                                    return Alert.alert('System', 'Exercise name required.');
    if (isNaN(Number(expPerUnit)) || Number(expPerUnit) <= 0) return Alert.alert('System', 'Enter a valid EXP per unit (must be greater than 0).');
    const unit = UNIT_TYPES.find(u => u.value === unitType)!;
    setLoading(true);
    try {
      await createExercise({
        name:           name.trim(),
        description:    desc.trim(),
        exp_reward:     Number(expPerUnit),
        unit_type:      unitType,
        exp_per_unit:   Number(expPerUnit),
        exp_unit_count: Number(expUnitCount) || 1,
        unit_label:     unit.suffix,
        exp_per_stat_point: Number(expPerStatPt) || 20,  
        stat_type:      statType,
        category,
      }, bodyParts);
      resetForm();
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', 'Failed to create exercise. Please try again.');
      console.error('createExercise error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (ex: Exercise) =>
    Alert.alert('Delete', `Remove "${ex.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExercise(ex.id!); await load(); } },
    ]);

  const openEdit = (ex: Exercise) => {
    setEditTarget(ex);
    setEditName(ex.name);
    setEditDesc(ex.description);
    setEditUnitType(ex.unit_type ?? 'reps');
    setEditExpPerUnit(String(ex.exp_per_unit ?? ex.exp_reward ?? 2));
    setEditExpUnitCount(String(ex.exp_unit_count ?? 1));   
    setEditExpPerStatPt(String(ex.exp_per_stat_point ?? 20));
    setEditStatType(ex.stat_type);
    setEditCategory(ex.category);
    setEditBodyParts(parseBodyParts(ex.body_parts));
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return Alert.alert('System', 'Exercise name required.');
    if (isNaN(Number(editExpPerUnit)) || Number(editExpPerUnit) <= 0)
      return Alert.alert('System', 'Enter a valid EXP per unit.');
    const unit = UNIT_TYPES.find(u => u.value === editUnitType)!;
    setEditLoading(true);
    try {
      await updateExercise(editTarget!.id!, {
        name:         editName.trim(),
        description:  editDesc.trim(),
        unit_type:    editUnitType,
        exp_per_unit: Number(editExpPerUnit),
        exp_unit_count: Number(editExpUnitCount) || 1,
        exp_reward:   Number(editExpPerUnit),
        unit_label:   unit.suffix,
        stat_type:    editStatType,
        category:     editCategory,
        exp_per_stat_point: Number(editExpPerStatPt) || 20,
      }, editBodyParts);
      setEditModal(false);
      setEditTarget(null);
      await load();
    } catch (e) {
      Alert.alert('Error', 'Failed to update exercise.');
    } finally {
      setEditLoading(false);
    }
  };

  const accentForCat = (cat: string) => {
    const stat = EXERCISE_CATEGORIES.find(c => c.value === cat)?.stat;
    return STATS.find(s => s.key === stat)?.color ?? COLORS.textSecondary;
  };

  const selectedUnit = UNIT_TYPES.find(u => u.value === unitType);
  const partsOf = (ex: Exercise) => parseBodyParts(ex.body_parts);
  const filtersActive = search.trim() !== '' || catFilter !== 'all' || partFilter.length > 0;
  const shown = filterExercises(exercises, { search, category: catFilter, bodyParts: partFilter });

  return (
    <View style={styles.root}>
      <FlatList
        data={shown}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <SectionHeader title="Exercise Library"
              subtitle={filtersActive ? `${shown.length} / ${exercises.length} shown` : `${exercises.length} exercises`}
              action={{ label: '+ Create', onPress: () => setModal(true) }} />

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
                placeholder="Search name or description" placeholderTextColor={COLORS.textMuted} />
            </View>

            <View style={styles.dropRow}>
              <SystemDropdown
                label="Category"
                options={[{ value: 'all', label: 'All' }, ...EXERCISE_CATEGORIES]}
                value={catFilter}
                onChange={setCatFilter}
                style={styles.flex1}
              />

              <SystemMultiDropdown
                label="Body Parts"
                options={BODY_PARTS}
                values={partFilter}
                onChange={setPartFilter}
                style={styles.flex1}
              />
            </View>
          </>
        }
        ListEmptyComponent={<EmptyState icon="barbell"
          title={filtersActive ? 'No matching exercises' : 'No exercises yet'}
          subtitle={filtersActive ? 'Try a different search or filter.' : 'Create your first exercise.'} />}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: accentForCat(item.category) }]}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{item.name}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                  <Ionicons name="create" size={16} color={COLORS.accentCyan} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Ionicons name="close" size={18} color={COLORS.accentRed} />
                </TouchableOpacity>
              </View>
            </View>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            <View style={styles.tags}>
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>
                  {item.exp_per_unit ?? item.exp_reward} EXP / {item.exp_unit_count ?? 1} {item.unit_label ?? 'rep'}
                </Text>
              </View>
              <View style={[styles.tag, { borderColor: accentForCat(item.category) }]}>
                <Text style={[styles.tagTxt, { color: accentForCat(item.category) }]}>
                  {item.stat_type.toUpperCase()}
                </Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>{item.unit_label ?? item.category}</Text>
              </View>
            </View>
            {partsOf(item).length > 0 && (
              <View style={styles.tags}>
                {partsOf(item).map(p => (
                  <View key={p} style={styles.partTag}>
                    <Text style={styles.partTagTxt}>{bodyPartLabel(p)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ NEW EXERCISE</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
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

              {/* EXP per N units */}
              <View style={styles.row}>
                <SystemInput
                  label="EXP Gained"
                  value={expPerUnit}
                  onChangeText={setExpPerUnit}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1"
                  style={styles.flex1}
                />
                <View style={styles.perLabel}>
                  <Text style={styles.perLabelTxt}>per</Text>
                </View>
                <SystemInput
                  label={`${selectedUnit?.suffix ?? 'units'} done`}
                  value={expUnitCount}
                  onChangeText={setExpUnitCount}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 10"
                  style={styles.flex1}
                />
              </View>
              <Text style={styles.expHint}>
                {Number(expPerUnit) || 0} EXP per {Number(expUnitCount) || 1} {selectedUnit?.suffix ?? 'units'}.{' '}
                Example: 50 {selectedUnit?.suffix ?? 'units'} ={'  '}
                {(((Number(expPerUnit) || 0) / (Number(expUnitCount) || 1)) * 50).toFixed(1)} EXP
              </Text>

              {/* Category */}
              <SystemDropdown
                label="Category"
                options={EXERCISE_CATEGORIES}
                value={category}
                onChange={(v) => {
                  setCategory(v);
                  const c = EXERCISE_CATEGORIES.find(x => x.value === v);
                  if (c) setStatType(c.stat);
                }}
              />

              {/* Stat boost */}
              <Text style={styles.selectLbl}>STAT BOOST</Text>
              <View style={styles.chips}>
                {STATS.map(s => (
                  <TouchableOpacity key={s.key}
                    style={[styles.chip, statType === s.key && styles.chipOn]}
                    onPress={() => setStatType(s.key)}>
                    <View style={styles.chipRow}>
                      <Ionicons name={s.icon} size={12} color={s.color} />
                      <Text style={[styles.chipTxt, statType === s.key && styles.chipTxtOn]}>{s.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <SystemInput
                label={`EXP needed for +1 ${statType.toUpperCase()} point`}
                value={expPerStatPt}
                onChangeText={setExpPerStatPt}
                keyboardType="decimal-pad"
                placeholder="e.g. 20"
              />
              <Text style={styles.expHint}>
                Every {expPerStatPt || '20'} EXP from this exercise = +1 {statType.toUpperCase()}.
                Example: earn {Number(expPerStatPt || 20) * 3} EXP → +3 {statType.toUpperCase()}
              </Text>

              {/* Body parts */}
              <SystemMultiDropdown
                label="Body Parts"
                options={BODY_PARTS}
                values={bodyParts}
                onChange={setBodyParts}
              />
              <Text style={styles.expHint}>Select every muscle group this exercise targets.</Text>

              <View style={styles.row}>
                <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                  onPress={() => { resetForm(); setModal(false); }} />
                <SystemButton title="Create" style={styles.flex1}
                  onPress={handleCreate} loading={loading} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT EXERCISE MODAL ── */}
      <Modal visible={editModal} animationType="slide" transparent onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ EDIT EXERCISE</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}>
              <SystemInput label="Name" value={editName} onChangeText={setEditName} />
              <SystemInput label="Description" value={editDesc} onChangeText={setEditDesc} multiline />

              <Text style={styles.selectLbl}>UNIT TYPE</Text>
              <View style={styles.chips}>
                {UNIT_TYPES.map(u => (
                  <TouchableOpacity key={u.value}
                    style={[styles.chip, editUnitType === u.value && styles.chipOn]}
                    onPress={() => setEditUnitType(u.value)}>
                    <Text style={[styles.chipTxt, editUnitType === u.value && styles.chipTxtOn]}>{u.label}</Text>
                    <Text style={styles.chipDesc}>{u.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <SystemInput label="EXP Gained" value={editExpPerUnit} onChangeText={setEditExpPerUnit}
                  keyboardType="decimal-pad" style={styles.flex1} />
                <View style={styles.perLabel}>
                  <Text style={styles.perLabelTxt}>per</Text>
                </View>
                <SystemInput
                  label={`${UNIT_TYPES.find(u => u.value === editUnitType)?.suffix ?? 'units'} done`}
                  value={editExpUnitCount} onChangeText={setEditExpUnitCount}
                  keyboardType="decimal-pad" style={styles.flex1} />
              </View>

              <SystemDropdown
                label="Category"
                options={EXERCISE_CATEGORIES}
                value={editCategory}
                onChange={(v) => {
                  setEditCategory(v);
                  const c = EXERCISE_CATEGORIES.find(x => x.value === v);
                  if (c) setEditStatType(c.stat);
                }}
              />

              <Text style={styles.selectLbl}>STAT BOOST</Text>
              <View style={styles.chips}>
                {STATS.map(s => (
                  <TouchableOpacity key={s.key}
                    style={[styles.chip, editStatType === s.key && styles.chipOn]}
                    onPress={() => setEditStatType(s.key)}>
                    <View style={styles.chipRow}>
                      <Ionicons name={s.icon} size={12} color={s.color} />
                      <Text style={[styles.chipTxt, editStatType === s.key && styles.chipTxtOn]}>{s.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <SystemInput
                label={`EXP needed for +1 ${editStatType.toUpperCase()} point`}
                value={editExpPerStatPt}
                onChangeText={setEditExpPerStatPt}
                keyboardType="decimal-pad"
                placeholder="e.g. 20"
              />
              <Text style={styles.expHint}>
                Every {editExpPerStatPt || '20'} EXP from this exercise = +1 {editStatType.toUpperCase()}.
                Example: earn {Number(editExpPerStatPt || 20) * 3} EXP → +3 {editStatType.toUpperCase()}
              </Text>

              {/* Body parts */}
              <SystemMultiDropdown
                label="Body Parts"
                options={BODY_PARTS}
                values={editBodyParts}
                onChange={setEditBodyParts}
              />
              <Text style={styles.expHint}>Select every muscle group this exercise targets.</Text>

              <View style={styles.row}>
                <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                  onPress={() => { setEditModal(false); setEditTarget(null); }} />
                <SystemButton title="Save" style={styles.flex1}
                  onPress={handleSaveEdit} loading={editLoading} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bgPrimary },
  list:       { padding: 16, paddingBottom: 100 },
  card:       { backgroundColor: COLORS.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderMain, borderLeftWidth: 3, padding: 13, marginBottom: 9 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardName:   { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  cardDesc:   { color: COLORS.textSecondary, fontSize: 12, marginBottom: 7 },
  tags:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  tag:        { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  tagTxt:     { color: COLORS.accentCyan, fontSize: 10, fontWeight: '700' },
  partTag:    { borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  partTagTxt: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },

  searchRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, marginBottom: 14, gap: 8 },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 11 },
  dropRow:    { flexDirection: 'row', gap: 12 },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '95%' },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },

  selectLbl:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  chip:       { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  chipRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipOn:     { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}18` },
  chipTxt:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTxtOn:  { color: COLORS.accentCyan },
  chipDesc:   { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },
  expHint:    { color: COLORS.textMuted, fontSize: 11, marginBottom: 14, fontStyle: 'italic' },

  row:        { flexDirection: 'row', gap: 12, marginBottom: 6 },
  flex1:      { flex: 1 },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn:     { padding: 4 },

  perLabel:    { justifyContent: 'flex-end', paddingBottom: 14, alignItems: 'center', paddingHorizontal: 6 },
  perLabelTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
});

export default ExercisesScreen;