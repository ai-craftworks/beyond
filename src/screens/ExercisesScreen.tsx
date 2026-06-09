import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createExercise, deleteExercise, Exercise, getExercises } from '../database/Database';
import { SystemButton, SystemInput, SectionHeader, EmptyState } from '../components/UIComponents';
import { COLORS, EXERCISE_CATEGORIES, STATS, UNIT_TYPES } from '../constants/game';

const ExercisesScreen: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [modal, setModal]         = useState(false);
  const [loading, setLoading]     = useState(false);

  const [name, setName]               = useState('');
  const [desc, setDesc]               = useState('');
  const [unitType, setUnitType]       = useState('reps');
  const [expPerUnit, setExpPerUnit]   = useState('2');
  const [statType, setStatType]       = useState('strength');
  const [statReward, setStatRew]      = useState('1');
  const [category, setCategory]       = useState('strength');

  useFocusEffect(useCallback(() => { load(); }, []));
  const load = async () => setExercises(await getExercises());

  const resetForm = () => {
    setName(''); setDesc(''); setUnitType('reps'); setExpPerUnit('2');
    setStatType('strength'); setStatRew('1'); setCategory('strength');
  };

  const handleCreate = async () => {
    if (!name.trim())                                    return Alert.alert('System', 'Exercise name required.');
    if (isNaN(Number(expPerUnit)) || Number(expPerUnit) <= 0) return Alert.alert('System', 'Enter a valid EXP per unit (must be greater than 0).');
    if (isNaN(Number(statReward)))                       return Alert.alert('System', 'Enter a valid stat value.');
    const unit = UNIT_TYPES.find(u => u.value === unitType)!;
    setLoading(true);
    try {
      await createExercise({
        name:         name.trim(),
        description:  desc.trim(),
        exp_reward:   Number(expPerUnit),  // kept for compat
        unit_type:    unitType,
        exp_per_unit: Number(expPerUnit),
        unit_label:   unit.suffix,
        stat_type:    statType,
        stat_reward:  Number(statReward),
        category,
      });
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

  const accentForCat = (cat: string) => {
    const stat = EXERCISE_CATEGORIES.find(c => c.value === cat)?.stat;
    return STATS.find(s => s.key === stat)?.color ?? COLORS.textSecondary;
  };

  const selectedUnit = UNIT_TYPES.find(u => u.value === unitType);
  const expPreview = Number(expPerUnit || 0);

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
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: accentForCat(item.category) }]}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{item.name}</Text>
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            <View style={styles.tags}>
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>
                  +{item.exp_per_unit ?? item.exp_reward} EXP/{item.unit_label ?? 'rep'}
                </Text>
              </View>
              <View style={[styles.tag, { borderColor: accentForCat(item.category) }]}>
                <Text style={[styles.tagTxt, { color: accentForCat(item.category) }]}>
                  {item.stat_type.toUpperCase()} +{item.stat_reward}
                </Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>{item.unit_label ?? item.category}</Text>
              </View>
            </View>
          </View>
        )}
      />

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.sheet}>
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

              {/* EXP per unit */}
              <SystemInput
                label={`EXP per ${selectedUnit?.suffix ?? 'unit'}`}
                value={expPerUnit}
                onChangeText={setExpPerUnit}
                keyboardType="decimal-pad"
                placeholder="e.g. 2"
              />
              <Text style={styles.expHint}>
                {expPreview} EXP per {selectedUnit?.suffix ?? 'unit'} · 10 {selectedUnit?.suffix ?? 'units'} = {expPreview * 10} EXP
              </Text>

              {/* Category */}
              <Text style={styles.selectLbl}>CATEGORY</Text>
              <View style={styles.chips}>
                {EXERCISE_CATEGORIES.map(c => (
                  <TouchableOpacity key={c.value}
                    style={[styles.chip, category === c.value && styles.chipOn]}
                    onPress={() => { setCategory(c.value); setStatType(c.stat); }}>
                    <Text style={[styles.chipTxt, category === c.value && styles.chipTxtOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Stat boost */}
              <Text style={styles.selectLbl}>STAT BOOST</Text>
              <View style={styles.chips}>
                {STATS.map(s => (
                  <TouchableOpacity key={s.key}
                    style={[styles.chip, statType === s.key && styles.chipOn]}
                    onPress={() => setStatType(s.key)}>
                    <Text style={[styles.chipTxt, statType === s.key && styles.chipTxtOn]}>{s.icon} {s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <SystemInput
                label="Stat +Value"
                value={statReward}
                onChangeText={setStatRew}
                keyboardType="numeric"
              />

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
  deleteBtn:  { color: COLORS.accentRed, fontSize: 16, fontWeight: '700', paddingLeft: 8 },

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
  expHint:    { color: COLORS.textMuted, fontSize: 11, marginBottom: 14, fontStyle: 'italic' },

  row:        { flexDirection: 'row', gap: 12, marginBottom: 6 },
  flex1:      { flex: 1 },
});

export default ExercisesScreen;