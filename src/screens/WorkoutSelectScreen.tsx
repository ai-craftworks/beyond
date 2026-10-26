/**
 * src/screens/WorkoutSelectScreen.tsx
 * ====================================
 * Full-screen workout picker used by three flows:
 *   - mode 'plan'  → add a workout to a plan (with sets + target units)
 *   - mode 'bonus' → add a bonus quest to a session (with target units)
 *   - mode 'skill' → tag one or more workouts to a martial-art skill (multi-select)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
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
import ActionBar from '../components/ActionBar';
import WorkoutRow from '../components/WorkoutRow';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, EXERCISE_CATEGORIES, BODY_PARTS, unitSuffix, statAccent, expBadgeLabel, workoutMetaLine } from '../constants/game';
import { expForUnits, UnitValue, UnitSpec } from '../utils/math';
import { specsOf, primarySpecOf } from '../utils/units';
import { filterExercises } from '../utils/filterExercises';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'WorkoutSelect'>;
type Nav   = NativeStackNavigationProp<RootStackParamList>;

/** A row in the picker list: either a workout, or the target panel that sits
 *  directly underneath the selected workout. */
type PickerRow =
  | { kind: 'exercise'; ex: Exercise }
  | { kind: 'target' };

interface TargetPanelProps {
  isPlan: boolean;
  sets: string;
  onChangeSets: (v: string) => void;
  specs: UnitSpec[];
  primary: string;
  values: Record<string, string>;
  onChangeValue: (type: string, value: string) => void;
  previewExp: number;
}

/**
 * The TARGET box: sets + per-unit targets + EXP preview.
 * Rendered inline, right below the workout the user picked, so the unit setup
 * is never below the fold. The commit action lives in the pinned bar.
 */
const TargetPanel: React.FC<TargetPanelProps> = ({
  isPlan, sets, onChangeSets, specs, primary, values, onChangeValue, previewExp,
}) => (
  <View style={styles.targetPanel}>
    <View style={styles.targetHeader}>
      <Text style={styles.selectLbl}>TARGET</Text>
      <Text style={styles.targetHint}>Prefilled from the workout defaults</Text>
    </View>

    {isPlan && (
      <SystemInput label="Sets" value={sets} onChangeText={onChangeSets} keyboardType="numeric" />
    )}

    {specs.map(s => {
      const isPrimary = s.type === primary;
      return (
        <View key={s.type} style={styles.unitRow}>
          <Text style={styles.unitRowLbl}>{unitSuffix(s.type)}{isPrimary ? ' · EXP' : ''}</Text>
          <TextInput
            style={styles.unitRowInput}
            value={values[s.type] ?? ''}
            onChangeText={v => onChangeValue(s.type, v)}
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

    <Text style={styles.confirmHint}>Confirm with ADD below</Text>
  </View>
);

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

  const exShown = useMemo(
    () => filterExercises(exercises, { search, category: cat, bodyParts: parts, groups: groupFilter.map(Number) }),
    [exercises, search, cat, parts, groupFilter],
  );

  // The target panel is a list row of its own, inserted directly underneath
  // the selected workout so the unit setup is never below the fold.
  const rows: PickerRow[] = useMemo(() => {
    const out: PickerRow[] = [];
    for (const ex of exShown) {
      out.push({ kind: 'exercise', ex });
      if (!isSkill && selected?.id === ex.id) out.push({ kind: 'target' });
    }
    return out;
  }, [exShown, selected, isSkill]);

  // FlatList only re-renders its cells when `data` or `extraData` changes.
  // `data` changes on selection; this key changes whenever the target inputs
  // do, so the panel's values and EXP preview stay live while typing.
  const targetKey = useMemo(() => `${JSON.stringify(unitVals)}|${sets}`, [unitVals, sets]);

  const filterCount = (cat !== 'all' ? 1 : 0) + (parts.length > 0 ? 1 : 0) + (groupFilter.length > 0 ? 1 : 0);
  const resetFilters = () => { setCat('all'); setParts([]); setGroupFilter([]); };
  const togglePart = (v: string) => setParts(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleGroupF = (v: string) => setGroupFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const listHeader = (
    <View>
      {/* The native header already names the target plan/skill */}
      {mode === 'bonus' && (
        <Text style={styles.planTag}>BONUS QUEST</Text>
      )}

      {/* Filters */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search workouts" placeholderTextColor={COLORS.textMuted} />
        <FilterButton count={filterCount} onPress={() => setFiltersOpen(true)} />
      </View>

      <Text style={styles.selectLbl}>{isSkill ? 'SELECT WORKOUTS TO TAG' : 'SELECT WORKOUT'}</Text>
    </View>
  );

  // The pinned bar mirrors whatever this mode is waiting on: how many
  // workouts are tagged, or which workout + target is about to be committed.
  const targetSummary = specs
    .map(s => `${Number(unitVals[s.type]) || 0} ${unitSuffix(s.type)}`)
    .join(' × ');

  const barLabel = isSkill
    ? (pickedIds.length === 0 ? 'No workouts selected' : `${pickedIds.length} selected`)
    : (selected ? selected.name : 'No workout selected');

  const barHint = isSkill
    ? (pickedIds.length === 0 ? 'Tap a workout to tag it' : 'Tap a tagged workout again to remove it')
    : (selected
      ? `${isPlan ? `${Number(sets) || 0} sets · ` : ''}${targetSummary} · ≈ ${previewExp} EXP`
      : 'Pick a workout to set its target');

  const barTitle = isSkill
    ? (pickedIds.length > 0 ? `Add ${pickedIds.length} Workout${pickedIds.length === 1 ? '' : 's'}` : 'Add Workouts')
    : (mode === 'bonus' ? 'Add Bonus' : 'Add');

  const barDisabled = isSkill ? pickedIds.length === 0 : !selected;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        data={rows}
        keyExtractor={item => (item.kind === 'target' ? 'target' : String(item.ex.id))}
        extraData={targetKey}
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={COLORS.accentCyan} style={{ marginVertical: 24 }} />
          ) : (
            <EmptyState icon="barbell" title="No workouts match" subtitle="Try a different search or filter." />
          )
        }
        renderItem={({ item }) => {
          if (item.kind === 'target') {
            return (
              <TargetPanel
                isPlan={isPlan}
                sets={sets}
                onChangeSets={setSets}
                specs={specs}
                primary={primary}
                values={unitVals}
                onChangeValue={(type, value) => setUnitVals(prev => ({ ...prev, [type]: value }))}
                previewExp={previewExp}
              />
            );
          }

          const ex = item.ex;
          const tagged = isSkill && taggedIds.includes(ex.id!);
          const picked = isSkill && pickedIds.includes(ex.id!);
          const isOn   = isSkill ? (tagged || picked) : selected?.id === ex.id;
          return (
            <WorkoutRow
              title={ex.name}
              meta={workoutMetaLine(ex)}
              accent={statAccent(ex.category)}
              exp={expBadgeLabel(ex)}
              state={tagged ? 'dimmed' : isOn ? 'selected' : 'default'}
              onPress={tagged ? undefined : () => selectExercise(ex)}
              trailing={
                isSkill ? (
                  <Ionicons
                    name={tagged ? 'checkmark-circle' : picked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={tagged ? COLORS.accentGreen : picked ? COLORS.accentCyan : COLORS.textMuted}
                  />
                ) : isOn ? (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.accentCyan} />
                ) : undefined
              }
            />
          );
        }}
      />

      <ActionBar
        stacked
        style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}
        label={barLabel}
        hint={barHint}
      >
        <SystemButton
          title={barTitle}
          style={styles.barBtn}
          textStyle={styles.barBtnTxt}
          onPress={handleConfirm}
          loading={submitting}
          disabled={barDisabled}
        />
      </ActionBar>

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
    </KeyboardAvoidingView>
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

  targetPanel: { backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.accentCyan, borderRadius: 10, padding: 12, marginBottom: 10 },
  targetHeader:{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  targetHint:  { color: COLORS.textMuted, fontSize: 10, fontStyle: 'italic' },

  unitRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  unitRowLbl:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', width: 80 },
  unitRowInput: { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: COLORS.textPrimary, fontSize: 14 },

  expPreview:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, marginBottom: 4 },
  confirmHint: { color: COLORS.textMuted, fontSize: 10, fontStyle: 'italic', textAlign: 'center' },

  actionBar:   { paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.borderMain },
  barBtn:      { flex: 1 },
  barBtnTxt:   { fontSize: 13, letterSpacing: 1 },
});

export default WorkoutSelectScreen;
