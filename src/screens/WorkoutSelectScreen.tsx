/**
 * src/screens/WorkoutSelectScreen.tsx
 * ====================================
 * Full-screen workout picker used by two flows:
 *   - mode 'plan'  → add a workout to a plan (with sets + target units)
 *   - mode 'bonus' → add a bonus quest to a session (with target units)
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
  addBonusExerciseToSession, Exercise,
} from '../database/Database';
import { SystemButton, SystemInput, SystemDropdown, SystemMultiDropdown, EmptyState } from '../components/UIComponents';
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
  const isPlan     = route.params.mode === 'plan';

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected]   = useState<Exercise | null>(null);
  const [sets, setSets]           = useState('3');
  const [unitVals, setUnitVals]   = useState<Record<string, string>>({});

  // List search / filters
  const [search, setSearch] = useState('');
  const [cat, setCat]       = useState('all');
  const [parts, setParts]   = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setExercises(await getExercises());
      setLoading(false);
    })();
  }, []);

  const selectExercise = (ex: Exercise) => {
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
      if (route.params.mode === 'plan') {
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
      } else {
        await addBonusExerciseToSession(route.params.sessionId, selected, primaryVal, unitValues);
      }
      navigation.goBack();
    } catch (e) {
      console.error('add workout error:', e);
      Alert.alert('Error', 'Failed to add workout. Please try again.');
      setSubmitting(false);
    }
  };

  const exShown = filterExercises(exercises, { search, category: cat, bodyParts: parts });

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

        {/* Filters */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search workouts" placeholderTextColor={COLORS.textMuted} />
        </View>

        <View style={styles.dropRow}>
          <SystemDropdown
            label="Category"
            options={[{ value: 'all', label: 'All' }, ...EXERCISE_CATEGORIES]}
            value={cat}
            onChange={setCat}
            style={styles.flex1}
          />
          <SystemMultiDropdown
            label="Body Parts"
            options={BODY_PARTS}
            values={parts}
            onChange={setParts}
            style={styles.flex1}
          />
        </View>

        <Text style={styles.selectLbl}>SELECT WORKOUT</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.accentCyan} style={{ marginVertical: 24 }} />
        ) : exShown.length === 0 ? (
          <EmptyState icon="barbell" title="No workouts match" subtitle="Try a different search or filter." />
        ) : (
          exShown.map(ex => (
            <TouchableOpacity
              key={ex.id}
              style={[styles.exPickItem, selected?.id === ex.id && styles.exPickItemOn]}
              onPress={() => selectExercise(ex)}
              activeOpacity={0.75}
            >
              <View style={styles.exPickInfo}>
                <Text style={[styles.exPickTxt, selected?.id === ex.id && styles.exPickTxtOn]}>{ex.name}</Text>
                {parseBodyParts(ex.body_parts).length > 0 && (
                  <Text style={styles.exPickParts}>
                    {parseBodyParts(ex.body_parts).map(p => bodyPartLabel(p)).join(' · ')}
                  </Text>
                )}
              </View>
              <Text style={styles.exPickExp}>
                +{ex.exp_per_unit} EXP/{ex.exp_unit_count ?? 1} {unitSuffix(ex.primary_unit ?? ex.unit_type ?? 'reps')}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {/* Values */}
        {selected && (
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
          <SystemButton title={isPlan ? 'Add' : 'Add Bonus'} style={styles.flex1}
            onPress={handleConfirm} loading={submitting} disabled={!selected} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:     { padding: 16 },

  planTag:     { color: COLORS.accentCyan, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 14 },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, marginBottom: 14, gap: 8 },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 11 },
  dropRow:     { flexDirection: 'row', gap: 12 },

  selectLbl:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 6, textTransform: 'uppercase' },

  exPickItem:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 8, marginBottom: 5 },
  exPickItemOn:{ borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}12` },
  exPickInfo:  { flex: 1, paddingRight: 8 },
  exPickTxt:   { color: COLORS.textSecondary, fontSize: 14, flex: 1 },
  exPickTxtOn: { color: COLORS.accentCyan },
  exPickParts: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  exPickExp:   { color: COLORS.textMuted, fontSize: 12 },

  unitRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  unitRowLbl:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', width: 80 },
  unitRowInput: { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: COLORS.textPrimary, fontSize: 14 },

  expPreview:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, marginBottom: 10 },
  row:         { flexDirection: 'row', gap: 12, marginTop: 16 },
  flex1:       { flex: 1 },
});

export default WorkoutSelectScreen;
