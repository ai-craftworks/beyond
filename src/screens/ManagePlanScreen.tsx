/**
 * src/screens/ManagePlanScreen.tsx
 * ==================================
 * Manage a workout plan: toggle active, review assigned exercises, add/remove.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPlanExercises, removeExerciseFromPlan, updatePlan,
  cancelTodayPendingSessions, Plan, PlanExercise,
} from '../database/Database';
import { SectionHeader } from '../components/UIComponents';
import WorkoutRow from '../components/WorkoutRow';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, parseUnitValues, formatUnitValues, statColor } from '../constants/game';
import { expForUnits } from '../utils/math';
import { specsOf, primarySpecOf } from '../utils/units';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'ManagePlan'>;
type Nav   = NativeStackNavigationProp<RootStackParamList>;

const peExp = (pe: PlanExercise): number => {
  const specs = specsOf(pe.units, pe.unit_type ?? 'reps');
  const primary = primarySpecOf(pe.units, pe.primary_unit, pe.unit_type ?? 'reps');
  return expForUnits(
    parseUnitValues(pe.unit_values), specs, primary,
    pe.exp_per_unit ?? 2, pe.exp_unit_count ?? 1, pe.sets,
  );
};

const peLabel = (pe: PlanExercise): string =>
  formatUnitValues(parseUnitValues(pe.unit_values)) || `${pe.target} ${pe.unit_label ?? 'reps'}`;

const ManagePlanScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const [plan, setPlan]               = useState<Plan>(route.params.plan);
  const [planExercises, setPlanEx]    = useState<PlanExercise[]>([]);
  const [loading, setLoading]         = useState(true);

  const loadExercises = async () => {
    setPlanEx(await getPlanExercises(plan.id!));
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadExercises(); }, [plan.id]));

  const handleToggleActive = async () => {
    const next = plan.is_active ? 0 : 1;
    if (next === 0) await cancelTodayPendingSessions(plan.id!);
    await updatePlan(plan.id!, { is_active: next });
    setPlan(prev => ({ ...prev, is_active: next }));
  };

  const handleRemoveExercise = (peId: number) =>
    Alert.alert('Remove', 'Remove this exercise from the plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => { await removeExerciseFromPlan(peId); await loadExercises(); },
      },
    ]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        {/* Active toggle */}
        <View style={styles.activeRow}>
          <View>
            <Text style={styles.activeLbl}>ACTIVE</Text>
            <Text style={styles.activeHint}>Generates daily sessions when on</Text>
          </View>
          <Switch
            value={!!plan.is_active}
            onValueChange={handleToggleActive}
            trackColor={{ true: COLORS.accentCyan, false: COLORS.borderMain }}
            thumbColor={plan.is_active ? COLORS.bgPrimary : COLORS.textMuted}
          />
        </View>

        {/* Exercise list */}
        <SectionHeader title="Exercises" subtitle={`${planExercises.length} assigned`}
          action={{ label: '+ Add', onPress: () => navigation.navigate('WorkoutSelect', {
            mode: 'plan', planId: plan.id!, planName: plan.name,
          }) }} />

        {loading ? (
          <ActivityIndicator color={COLORS.accentCyan} style={{ marginTop: 20 }} />
        ) : planExercises.length === 0 ? (
          <Text style={styles.noEx}>No exercises yet.</Text>
        ) : (
          planExercises.map(pe => (
            <WorkoutRow
              key={pe.id}
              title={pe.exercise_name ?? ''}
              meta={`${pe.sets} sets × ${peLabel(pe)}`}
              accent={statColor(pe.stat_type)}
              exp={`+${peExp(pe).toFixed(0)} EXP`}
              trailing={
                <TouchableOpacity onPress={() => handleRemoveExercise(pe.id!)} style={styles.removeBtn}>
                  <Ionicons name="close" size={18} color={COLORS.accentRed} />
                </TouchableOpacity>
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:    { padding: 16 },

  activeRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim, marginBottom: 16 },
  activeLbl:  { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  activeHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  noEx:       { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  removeBtn:  { padding: 6 },
});

export default ManagePlanScreen;
