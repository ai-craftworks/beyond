/**
 * src/components/ExerciseDetailSheet.tsx
 * ======================================
 * Full read view for one workout, opened by tapping a library card.
 * Shows everything the compact row omits — media, description, EXP formula,
 * unit table, body parts and groups — plus the Edit / Delete actions.
 *
 * Presentational only: the parent screen owns the edit modal, the delete
 * confirm and the reload (onEdit / onDelete / onClose callbacks).
 */

import React from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemButton } from './UIComponents';
import MediaViewer from './MediaViewer';
import { COLORS, EXERCISE_CATEGORIES, expBadgeLabel, parseUnits, parseBodyParts, parseGroupIds, statAccent, bodyPartLabel } from '../constants/game';
import { Exercise, Group } from '../database/Database';

interface ExerciseDetailSheetProps {
  exercise: Exercise | null;
  groups: Group[];
  onClose: () => void;
  onEdit: (ex: Exercise) => void;
  onDelete: (ex: Exercise) => void;
}

const ExerciseDetailSheet: React.FC<ExerciseDetailSheetProps> = ({
  exercise, groups, onClose, onEdit, onDelete,
}) => {
  const insets = useSafeAreaInsets();
  if (!exercise) return null;

  const accent = statAccent(exercise.category);
  const categoryLabel =
    EXERCISE_CATEGORIES.find(c => c.value === exercise.category)?.label ?? exercise.category;

  const units = (() => {
    const parsed = parseUnits(exercise.units);
    if (parsed.length > 0) return parsed;
    return [{ type: exercise.unit_type ?? 'reps', label: exercise.unit_label ?? 'reps', default: 0 }];
  })();
  const primaryUnit = exercise.primary_unit ?? exercise.unit_type;

  const parts = parseBodyParts(exercise.body_parts);
  const groupIds = parseGroupIds(exercise.groups);
  const hasMedia = !!exercise.media_uri && (exercise.media_type === 'image' || exercise.media_type === 'video');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>◆ WORKOUT</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}>
            {hasMedia && (
              <View style={styles.mediaWrap}>
                <MediaViewer mediaType={exercise.media_type} mediaUri={exercise.media_uri} />
              </View>
            )}

            <Text style={styles.name}>{exercise.name}</Text>
            {!!exercise.description && <Text style={styles.desc}>{exercise.description}</Text>}

            <View style={styles.chips}>
              <View style={[styles.chip, { borderColor: COLORS.accentCyan }]}>
                <Text style={[styles.chipTxt, { color: COLORS.accentCyan }]}>{expBadgeLabel(exercise)}</Text>
              </View>
              <View style={[styles.chip, { borderColor: accent }]}>
                <Text style={[styles.chipTxt, { color: accent }]}>{exercise.stat_type?.toUpperCase()}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={[styles.chipTxt, { color: COLORS.textSecondary }]}>{categoryLabel}</Text>
              </View>
            </View>

            <Text style={styles.sectionLbl}>UNITS</Text>
            <View style={styles.chips}>
              {units.map(u => {
                const isPrimary = primaryUnit === u.type;
                return (
                  <View key={u.type} style={[styles.chip, isPrimary && styles.chipPrimary]}>
                    <Text style={[styles.chipTxt, isPrimary && styles.chipTxtPrimary]}>
                      {u.label}{u.default > 0 ? ` · ${u.default}` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>

            {parts.length > 0 && (
              <>
                <Text style={styles.sectionLbl}>BODY PARTS</Text>
                <View style={styles.chips}>
                  {parts.map(p => (
                    <View key={p} style={styles.chipSoft}>
                      <Text style={styles.chipSoftTxt}>{bodyPartLabel(p)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {groupIds.length > 0 && (
              <>
                <Text style={styles.sectionLbl}>GROUPS</Text>
                <View style={styles.chips}>
                  {groupIds.map(gid => {
                    const g = groups.find(x => x.id === gid);
                    if (!g) return null;
                    return (
                      <View key={gid} style={[styles.chip, { borderColor: g.color }]}>
                        <View style={[styles.dot, { backgroundColor: g.color }]} />
                        <Text style={[styles.chipTxt, { color: g.color }]}>{g.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.actions}>
              <SystemButton title="Edit" icon="create-outline" variant="ghost"
                style={styles.flex1} onPress={() => onEdit(exercise)} />
              <SystemButton title="Delete" icon="trash-outline" variant="danger"
                style={styles.flex1} onPress={() => onDelete(exercise)} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '92%' },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 16, textAlign: 'center' },

  mediaWrap:  { marginBottom: 14 },
  name:       { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  desc:       { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },

  sectionLbl: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 5, paddingHorizontal: 9, paddingVertical: 4 },
  chipTxt:    { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  chipPrimary:{ borderColor: COLORS.accentGold },
  chipTxtPrimary: { color: COLORS.accentGold },
  chipSoft:   { borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 5, paddingHorizontal: 9, paddingVertical: 4 },
  chipSoftTxt:{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  dot:        { width: 6, height: 6, borderRadius: 3 },

  actions:    { flexDirection: 'row', gap: 12, marginTop: 22 },
  flex1:      { flex: 1 },
});

export default ExerciseDetailSheet;
