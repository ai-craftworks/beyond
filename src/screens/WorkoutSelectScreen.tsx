/**
 * src/screens/WorkoutSelectScreen.tsx
 * ====================================
 * Full-screen workout picker used by three flows:
 *   - mode 'plan'  → add a workout to a plan (with sets + target units)
 *   - mode 'bonus' → add a bonus quest to a session (with target units)
 *   - mode 'skill' → tag one or more workouts to a martial-art skill (multi-select)
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getExercises, getPlanExercises, addExerciseToPlan,
  addBonusExerciseToSession, addExerciseToSkill,
  getTaggedExerciseIdsForSkill, Exercise, getGroups, Group,
} from '../database/Database';
import { SystemButton, SystemInput, EmptyState, FilterSheet, FilterSection, FilterChip, FilterButton } from '../components/UIComponents';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, EXERCISE_CATEGORIES, BODY_PARTS, parseBodyParts, bodyPartLabel, unitSuffix } from '../constants/game';
import { expForUnits, UnitValue } from '../utils/math';
import { specsOf, primarySpecOf } from '../utils/units';
import { filterExercises } from '../utils/filterExercises';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'WorkoutSelect'>;
type Nav   = NativeStackNavigationProp<RootStackParamList>;

const WorkoutSelectScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const mode       = route.params.mode;
  const isPlan     = mode === 'plan';
  const skillId    = mode === 'skill' ? route.params.skillId : null;
  const isSkill    = skillId !== null;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected]   = useState<Exercise | null>(null);
  const [sets, setSets]           = useState('3');
  const [unitVals, setUnitVals]   = useState<Record<string, string>>({});
  const [taggedIds, setTaggedIds] = useState<number[]>([]);
  const [pickedIds, setPickedIds] = useState<number[]>([]);

  // List search / filters
  const [search, setSearch] = useState('');
  const [cat, setCat]       = useState('all');
  const [parts, setParts]   = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [exs, tagged, grps] = await Promise.all([
        getExercises(),
        isSkill ? getTaggedExerciseIdsForSkill(skillId!) : Promise.resolve<number[]>([]),
        getGroups('exercise'),
      ]);
      setExercises(exs);
      setTaggedIds(tagged);
      setGroups(grps);
      setLoading(false);
    })();
  }, [isSkill, skillId]);

  const selectExercise = (ex: Exercise) => {
    if (isSkill) {
      if (taggedIds.includes(ex.id!)) return;
      setPickedIds(prev => prev.includes(ex.id!) ? prev.filter(i => i !== ex.id!) : [...prev, ex.id!]);
      return;
    }
    setSelected(ex);
    const defaults: Record<string, string> = {};
    for (const s of specsOf(ex.units, ex.unit_type ?? 'reps')) {
      defaults[s.type] = s.default ? String(s.default) : '';
    }
    setUnitVals(defaults);
  };

  const specs   = selected ? specsOf(selected.units, selected.unit_type ?? 'reps') : [];
  const primary = selected ? primarySpecOf(selected.units, selected.primary_unit, selected.unit_type ?? 'reps') : 'reps';
  const values: UnitValue[] = specs.map(s => ({ type: s.type, value: Number(unitVals[s.type]) || 0 }));
  const previewExp = selected
    ? expForUnits(values, specs, primary, selected.exp_per_unit ?? 2, selected.exp_unit_count ?? 1,
        isPlan ? (Number(sets) || 1) : 1)
    : 0;

  const handleConfirm = async () => {
    if (isSkill) {
      if (pickedIds.length === 0) return Alert.alert('System', 'Select at least one workout.');
      setSubmitting(true);
      try {
        for (const id of pickedIds) await addExerciseToSkill(skillId!, id);
        navigation.goBack();
      } catch (e) {
        console.error('tag workouts error:', e);
        Alert.alert('Error', 'Failed to tag workouts. Please try again.');
        setSubmitting(false);
      }
      return;
    }

    if (!selected) return Alert.alert('System', 'Select an exercise first.');
    if (isPlan && (isNaN(Number(sets)) || Number(sets) < 1)) {
      return Alert.alert('System', 'Enter valid sets.');
    }
    const primaryVal = Number(unitVals[primary]);
    if (isNaN(primaryVal) || primaryVal < 1) {
      return Alert.alert('System', `Enter a valid ${unitSuffix(primary)} target.`);
    }
    const unitValues = JSON.stringify(values);
    setSubmitting(true);
    try {
      if (mode === 'plan') {
        const { planId } = route.params;
        const orderIndex = (await getPlanExercises(planId)).length;
        await addExerciseToPlan({
          plan_id: planId,
          exercise_id: selected.id!,
          sets: Number(sets),
          target: primaryVal,
          unit_values: unitValues,
          order_index: orderIndex,
        });
      } else if (mode === 'bonus') {
        await addBonusExerciseToSession(route.params.sessionId, selected, primaryVal, unitValues);
      }
      navigation.goBack();
    } catch (e) {
      console.error('add workout error:', e);
      Alert.alert('Error', 'Failed to add workout. Please try again.');
      setSubmitting(false);
    }
  };

  const exShown = filterExercises(exercises, { search, category: cat, bodyParts: parts, groups: groupFilter.map(Number) });
  const filterCount = (cat !== 'all' ? 1 : 0) + (parts.length > 0 ? 1 : 0) + (groupFilter.length > 0 ? 1 : 0);
  const resetFilters = () => { setCat('all'); setParts([]); setGroupFilter([]); };
  const togglePart = (v: string) => setParts(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleGroupF = (v: string) => setGroupFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isPlan && (
          <Text style={styles.planTag}>PLAN · {route.params.planName}</Text>
        )}
        {mode === 'skill' && (
          <Text style={styles.planTag}>TAG WORKOUTS · {route.params.skillName}</Text>
        )}

        {/* Filters */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search workouts" placeholderTextColor={COLORS.textMuted} />
          <FilterButton count={filterCount} onPress={() => setFiltersOpen(true)} />
        </View>

        <Text style={styles.selectLbl}>{isSkill ? 'SELECT WORKOUTS TO TAG' : 'SELECT WORKOUT'}</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.accentCyan} style={{ marginVertical: 24 }} />
        ) : exShown.length === 0 ? (
          <EmptyState icon="barbell" title="No workouts match" subtitle="Try a different search or filter." />
        ) : (
          exShown.map(ex => {
            const tagged = isSkill && taggedIds.includes(ex.id!);
            const picked = isSkill && pickedIds.includes(ex.id!);
            const isOn   = isSkill ? (tagged || picked) : selected?.id === ex.id;
            return (
              <TouchableOpacity
                key={ex.id}
                style={[styles.exPickItem, isOn && styles.exPickItemOn, tagged && styles.exPickItemTagged]}
                onPress={() => selectExercise(ex)}
                disabled={tagged}
                activeOpacity={0.75}
              >
                <View style={styles.exPickInfo}>
                  <Text style={[styles.exPickTxt, isOn && styles.exPickTxtOn]}>{ex.name}</Text>
                  {parseBodyParts(ex.body_parts).length > 0 && (
                    <Text style={styles.exPickParts}>
                      {parseBodyParts(ex.body_parts).map(p => bodyPartLabel(p)).join(' · ')}
                    </Text>
                  )}
                </View>
                {isSkill ? (
                  <View style={styles.checkWrap}>
                    {tagged
                      ? <Ionicons name="checkmark-circle" size={20} color={COLORS.accentGreen} />
                      : <Ionicons name={picked ? 'checkbox' : 'square-outline'} size={20}
                          color={picked ? COLORS.accentCyan : COLORS.textMuted} />}
                  </View>
                ) : (
                  <Text style={styles.exPickExp}>
                    +{ex.exp_per_unit} EXP/{ex.exp_unit_count ?? 1} {unitSuffix(ex.primary_unit ?? ex.unit_type ?? 'reps')}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* Values (plan / bonus only) */}
        {!isSkill && selected && (
          <>
            <Text style={styles.selectLbl}>TARGET</Text>
            {isPlan && (
              <SystemInput label="Sets" value={sets} onChangeText={setSets} keyboardType="numeric" />
            )}
            {specs.map(s => {
              const isPrimary = s.type === primary;
              return (
                <View key={s.type} style={styles.unitRow}>
                  <Text style={styles.unitRowLbl}>{unitSuffix(s.type)}{isPrimary ? ' · EXP' : ''}</Text>
                  <TextInput
                    style={styles.unitRowInput}
                    value={unitVals[s.type] ?? ''}
                    onChangeText={v => setUnitVals(prev => ({ ...prev, [s.type]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              );
            })}
            <Text style={styles.expPreview}>
              ≈ {previewExp} EXP{isPlan && Number(sets) > 1 ? ` · ${Number(sets)} sets` : ''}
            </Text>
          </>
        )}

        <View style={styles.row}>
          <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={() => navigation.goBack()} />
          <SystemButton
            title={isSkill
              ? `Add ${pickedIds.length} Workout${pickedIds.length === 1 ? '' : 's'}`
              : isPlan ? 'Add' : 'Add Bonus'}
            style={styles.flex1}
            onPress={handleConfirm}
            loading={submitting}
            disabled={isSkill ? pickedIds.length === 0 : !selected}
          />
        </View>
      </ScrollView>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={resetFilters}
      >
        <FilterSection label="Category">
          <FilterChip label="All" active={cat === 'all'} onPress={() => setCat('all')} />
          {EXERCISE_CATEGORIES.map(c => (
            <FilterChip key={c.value} label={c.label}
              active={cat === c.value}
              onPress={() => setCat(cat === c.value ? 'all' : c.value)} />
          ))}
        </FilterSection>

        <FilterSection label="Body Parts">
          {BODY_PARTS.map(b => (
            <FilterChip key={b.value} label={b.label} active={parts.includes(b.value)}
              onPress={() => togglePart(b.value)} />
          ))}
        </FilterSection>

        <FilterSection label="Groups">
          {groups.length === 0 ? (
            <Text style={styles.filterEmpty}>No groups yet — create some from the Groups screen.</Text>
          ) : groups.map(g => (
            <FilterChip key={g.id} label={g.name} color={g.color}
              active={groupFilter.includes(String(g.id))}
              onPress={() => toggleGroupF(String(g.id))} />
          ))}
        </FilterSection>
      </FilterSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:     { padding: 16 },

  planTag:     { color: COLORS.accentCyan, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 14 },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, marginBottom: 14, gap: 8 },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 11 },
  filterEmpty: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' },
  dropRow:     { flexDirection: 'row', gap: 12 },

  selectLbl:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 6, textTransform: 'uppercase' },

  exPickItem:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 8, marginBottom: 5 },
  exPickItemOn:{ borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}12` },
  exPickItemTagged: { borderColor: `${COLORS.accentGreen}66`, backgroundColor: `${COLORS.accentGreen}0D`, opacity: 0.8 },
  exPickInfo:  { flex: 1, paddingRight: 8 },
  exPickTxt:   { color: COLORS.textSecondary, fontSize: 14, flex: 1 },
  exPickTxtOn: { color: COLORS.accentCyan },
  exPickParts: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  exPickExp:   { color: COLORS.textMuted, fontSize: 12 },
  checkWrap:   { paddingLeft: 4 },

  unitRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  unitRowLbl:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', width: 80 },
  unitRowInput: { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: COLORS.textPrimary, fontSize: 14 },

  expPreview:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, marginBottom: 10 },
  row:         { flexDirection: 'row', gap: 12, marginTop: 16 },
  flex1:       { flex: 1 },
});

export default WorkoutSelectScreen;
