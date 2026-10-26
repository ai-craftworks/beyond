/**
 * src/components/AddChallengeGoalModal.tsx
 * =========================================
 * Pick a workout and set a cumulative target for a challenge. Goals are
 * stored as total volume over the challenge window; per-set units (reps,
 * distance, time) count every set, attribute units (weight/speed/calories)
 * count once per logged entry.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Challenge, ChallengeGoal, Exercise } from '../database/Database';
import { addChallengeGoal, getExercises, updateChallengeGoalTarget } from '../database/Database';
import { COLORS, unitPerSet, unitSuffix } from '../constants/game';
import { SystemButton, SystemDropdown, SystemInput } from './UIComponents';
import ActionBar from './ActionBar';
import WorkoutRow from './WorkoutRow';
import { specsOf } from '../utils/units';
import { hapticSuccess } from '../utils/haptics';

interface Props {
  visible: boolean;
  challenge: Challenge | null;
  goals: ChallengeGoal[];
  goal?: ChallengeGoal | null;
  onClose: () => void;
  onSaved: () => void;
}

const AddChallengeGoalModal: React.FC<Props> = ({
  visible, challenge, goals, goal, onClose, onSaved,
}) => {
  const insets = useSafeAreaInsets();
  const isEdit = !!goal?.id;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<number | null>(null);
  const [unit, setUnit]           = useState('');
  const [target, setTarget]       = useState('');
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setSaving(false);
    getExercises().then(setExercises).catch(() => setExercises([]));
    if (goal) {
      setSelected(goal.exercise_id);
      setUnit(goal.unit_type);
      setTarget(String(goal.target));
    } else {
      setSelected(null);
      setUnit('');
      setTarget('');
    }
  }, [visible, goal]);

  const selectedExercise = exercises.find(e => e.id === selected) ?? null;
  const selectedName = selectedExercise?.name ?? goal?.exercise_name ?? '';

  const usedUnits = useMemo(() => {
    if (selected == null) return [];
    return goals
      .filter(g => g.exercise_id === selected && g.id !== goal?.id)
      .map(g => g.unit_type);
  }, [goals, selected, goal]);

  const specs = useMemo(
    () => (selectedExercise ? specsOf(selectedExercise.units, selectedExercise.unit_type) : []),
    [selectedExercise]
  );

  const unitOptions = specs
    .filter(s => !usedUnits.includes(s.type))
    .map(s => ({
      value: s.type,
      label: `${s.label ?? s.type}${s.perSet ? ' · counts sets' : ''}`,
    }));

  const shownExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? exercises.filter(e => e.name.toLowerCase().includes(q)) : exercises;
    return list;
  }, [exercises, search]);

  const chooseExercise = (ex: Exercise) => {
    const exSpecs = specsOf(ex.units, ex.unit_type);
    const used = goals
      .filter(g => g.exercise_id === ex.id && g.id !== goal?.id)
      .map(g => g.unit_type);
    const firstFree = exSpecs.find(s => !used.includes(s.type)) ?? exSpecs[0];
    setSelected(ex.id!);
    setUnit(firstFree?.type ?? '');
    setTarget('');
  };

  const parsedTarget = Number(target.replace(',', '.'));
  const canSave = !!challenge && selected != null && !!unit
    && Number.isFinite(parsedTarget) && parsedTarget > 0 && !saving;

  const handleSave = async () => {
    if (!challenge || selected == null || !unit) {
      Alert.alert('System', 'Pick a workout and a unit first.');
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      Alert.alert('System', 'Enter a target greater than zero.');
      return;
    }
    setSaving(true);
    try {
      if (goal?.id) {
        await updateChallengeGoalTarget(goal.id, parsedTarget);
      } else {
        await addChallengeGoal({
          challenge_id: challenge.id!,
          exercise_id: selected,
          exercise_name: selectedName,
          unit_type: unit,
          target: parsedTarget,
        });
      }
      hapticSuccess();
      onSaved();
      onClose();
    } catch (e) {
      console.error('save challenge goal error:', e);
      Alert.alert('Error', 'Could not save the goal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const backToList = () => {
    setSelected(null);
    setUnit('');
    setTarget('');
  };

  const noFreeUnits = !isEdit && selected != null && unitOptions.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.hdr}>
            <Text style={styles.sheetTitle}>{isEdit ? '◆ EDIT GOAL' : '◆ ADD GOAL'}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {selected == null ? (
              <>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search workouts..."
                    placeholderTextColor={COLORS.textMuted}
                    autoCorrect={false}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {shownExercises.length === 0 ? (
                  <Text style={styles.empty}>
                    {exercises.length === 0 ? 'No workouts in your library yet.' : 'No workouts match that search.'}
                  </Text>
                ) : (
                  shownExercises.map(ex => {
                    const exSpecs = specsOf(ex.units, ex.unit_type);
                    return (
                      <WorkoutRow
                        key={ex.id}
                        title={ex.name}
                        meta={exSpecs.map(s => s.label).join('  ·  ')}
                        accent={COLORS.accentCyan}
                        leading={<Ionicons name="add-circle-outline" size={19} color={COLORS.accentCyan} />}
                        onPress={() => chooseExercise(ex)}
                      />
                    );
                  })
                )}
              </>
            ) : (
              <>
                <View style={styles.picked}>
                  <View style={styles.pickedMain}>
                    <Text style={styles.pickedLbl}>{isEdit ? 'Workout' : 'Selected workout'}</Text>
                    <Text style={styles.pickedName} numberOfLines={1}>{selectedName}</Text>
                  </View>
                  {!isEdit && (
                    <TouchableOpacity onPress={backToList} activeOpacity={0.75}>
                      <Text style={styles.changeTxt}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {isEdit ? (
                  <View style={styles.unitLocked}>
                    <Text style={styles.unitLockedLbl}>Unit</Text>
                    <Text style={styles.unitLockedTxt}>{unitSuffix(unit)}</Text>
                  </View>
                ) : (
                  <SystemDropdown
                    label="Goal Unit"
                    options={unitOptions}
                    value={unit}
                    onChange={setUnit}
                    placeholder={noFreeUnits ? 'Every unit already has a goal' : 'Select unit'}
                  />
                )}

                {noFreeUnits ? (
                  <Text style={styles.warn}>
                    This workout already has a goal for every one of its units. Edit the existing goal instead.
                  </Text>
                ) : (
                  <>
                    <SystemInput
                      label={`Target (${unitSuffix(unit || 'reps')})`}
                      value={target}
                      onChangeText={setTarget}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 1000"
                    />
                    <Text style={styles.hint}>
                      {unitPerSet(unit)
                        ? 'Total volume across the window — every set counts.'
                        : 'Total across the window — each logged value adds once (sets are not multiplied).'}
                    </Text>
                    {goal && (
                      <Text style={styles.hint}>
                        Lowering the target below what you have already logged completes the goal immediately.
                      </Text>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>

          <ActionBar style={styles.footer}>
            <SystemButton
              title="Cancel"
              variant="ghost"
              style={styles.flex1}
              onPress={onClose}
            />
            <SystemButton
              title={isEdit ? 'Save Goal' : 'Add Goal'}
              style={styles.flex1}
              disabled={!canSave}
              loading={saving}
              onPress={handleSave}
            />
          </ActionBar>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '88%' },
  handle:       { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  hdr:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle:   { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  body:         { flexShrink: 1 },
  footer:       { marginTop: 16 },
  flex1:        { flex: 1 },

  searchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, marginBottom: 14, gap: 8 },
  searchInput:  { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 11 },
  empty:        { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic', paddingVertical: 10 },

  picked:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  pickedMain:   { flex: 1, paddingRight: 10 },
  pickedLbl:    { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  pickedName:   { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  changeTxt:    { color: COLORS.accentCyan, fontSize: 12, fontWeight: '700' },

  unitLocked:     { backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  unitLockedLbl:  { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  unitLockedTxt:  { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },

  hint:         { color: COLORS.textMuted, fontSize: 11, marginBottom: 14 },
  warn:         { color: COLORS.accentGold, fontSize: 12, marginBottom: 14 },
});

export default AddChallengeGoalModal;
