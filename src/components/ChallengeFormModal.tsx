/**
 * src/components/ChallengeFormModal.tsx
 * ======================================
 * Create / edit a challenge (name, description, date window). The window is
 * entered through the in-app calendar sheet and stored as UTC date-only
 * strings, matching sessions.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Challenge } from '../database/Database';
import { createChallenge, deleteChallenge, updateChallenge } from '../database/Database';
import { COLORS } from '../constants/game';
import { SystemButton, SystemInput } from './UIComponents';
import ActionBar from './ActionBar';
import CalendarSheet from './CalendarSheet';
import { addDaysUTC, diffDaysUTC, fmtShortDate, isDateOnly, todayDateStr } from '../utils/dates';
import { hapticSuccess, hapticWarning } from '../utils/haptics';

interface Props {
  visible: boolean;
  challenge?: Challenge | null;
  /** Freeze the start/end fields (window already closed). */
  lockDates?: boolean;
  onClose: () => void;
  onSaved: (id: number) => void;
  onDeleted?: (id: number) => void;
}

type DateTarget = 'start' | 'end';

const ChallengeFormModal: React.FC<Props> = ({
  visible, challenge, lockDates = false, onClose, onSaved, onDeleted,
}) => {
  const insets = useSafeAreaInsets();
  const isEdit = !!challenge?.id;

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart]             = useState(todayDateStr());
  const [end, setEnd]                 = useState(addDaysUTC(todayDateStr(), 29));
  const [dateTarget, setDateTarget]   = useState<DateTarget | null>(null);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!visible) return;
    const today = todayDateStr();
    setName(challenge?.name ?? '');
    setDescription(challenge?.description ?? '');
    setStart(challenge?.start_date ?? today);
    setEnd(challenge?.end_date ?? addDaysUTC(today, 29));
    setDateTarget(null);
    setSaving(false);
  }, [visible, challenge]);

  const persist = async () => {
    const payload = {
      name: name.trim(),
      description: description.trim(),
      start_date: start,
      end_date: end,
    };
    setSaving(true);
    try {
      let id: number;
      if (isEdit && challenge?.id) {
        await updateChallenge(challenge.id, payload);
        id = challenge.id;
      } else {
        id = await createChallenge(payload);
      }
      hapticSuccess();
      onSaved(id);
      onClose();
    } catch (e) {
      console.error('save challenge error:', e);
      Alert.alert('Error', 'Could not save the challenge. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return Alert.alert('System', 'Challenge name required.');
    if (!isDateOnly(start) || !isDateOnly(end)) {
      return Alert.alert('System', 'Pick a valid start and end date.');
    }
    if (end < start) return Alert.alert('System', 'The end date must be on or after the start date.');

    const datesChanged = isEdit && (start !== challenge!.start_date || end !== challenge!.end_date);
    const alreadyStarted = todayDateStr() >= (challenge?.start_date ?? todayDateStr());
    if (datesChanged && alreadyStarted) {
      Alert.alert(
        'Adjust the window?',
        'Changing the dates changes which logged workouts count toward this challenge.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: () => { persist(); } },
        ]
      );
      return;
    }
    persist();
  };

  const confirmDelete = () => {
    if (!challenge?.id) return;
    hapticWarning();
    Alert.alert(
      'Delete Challenge?',
      `"${challenge.name}" and its goals will be removed. Logged workouts are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChallenge(challenge.id!);
              onDeleted?.(challenge.id!);
              onClose();
            } catch (e) {
              console.error('delete challenge error:', e);
              Alert.alert('Error', 'Could not delete the challenge.');
            }
          },
        },
      ]
    );
  };

  const durationDays = isDateOnly(start) && isDateOnly(end) ? diffDaysUTC(start, end) + 1 : 0;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{isEdit ? '◆ EDIT CHALLENGE' : '◆ NEW CHALLENGE'}</Text>

            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <SystemInput
                label="Challenge Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Hundred Push-Up Trial"
              />
              <SystemInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional..."
                multiline
              />

              <Text style={styles.sectionLbl}>Window</Text>
              <TouchableOpacity
                style={[styles.dateField, lockDates && styles.dateFieldLocked]}
                activeOpacity={0.75}
                disabled={lockDates}
                onPress={() => setDateTarget('start')}
              >
                <View style={styles.dateFieldMain}>
                  <Text style={styles.dateFieldLbl}>Start</Text>
                  <Text style={styles.dateFieldTxt}>{fmtShortDate(start)}</Text>
                </View>
                <Ionicons name="calendar-outline" size={17} color={lockDates ? COLORS.textMuted : COLORS.accentCyan} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateField, lockDates && styles.dateFieldLocked]}
                activeOpacity={0.75}
                disabled={lockDates}
                onPress={() => setDateTarget('end')}
              >
                <View style={styles.dateFieldMain}>
                  <Text style={styles.dateFieldLbl}>End</Text>
                  <Text style={styles.dateFieldTxt}>{fmtShortDate(end)}</Text>
                </View>
                <Ionicons name="calendar-outline" size={17} color={lockDates ? COLORS.textMuted : COLORS.accentCyan} />
              </TouchableOpacity>
              <Text style={styles.hint}>
                {lockDates
                  ? 'The window is closed — dates can no longer change.'
                  : durationDays > 0
                    ? `${durationDays} day${durationDays === 1 ? '' : 's'} · the end date is inclusive.`
                    : 'Pick a start and end date.'}
              </Text>

              {isEdit && (
                <>
                  <View style={styles.divider} />
                  <SystemButton
                    title="Delete Challenge"
                    variant="danger"
                    icon="trash-outline"
                    onPress={confirmDelete}
                  />
                  <Text style={styles.hint}>
                    Removes the challenge and its goals. Logged workouts stay in your history.
                  </Text>
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
                title={isEdit ? 'Save' : 'Create'}
                style={styles.flex1}
                loading={saving}
                disabled={saving}
                onPress={handleSave}
              />
            </ActionBar>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CalendarSheet
        visible={dateTarget !== null}
        value={dateTarget === 'end' ? end : start}
        min={dateTarget === 'end' ? start : undefined}
        title={dateTarget === 'end' ? 'End date' : 'Start date'}
        onSelect={d => {
          if (dateTarget === 'end') {
            setEnd(d);
          } else {
            setStart(d);
            if (end < d) setEnd(d);
          }
        }}
        onClose={() => setDateTarget(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '88%' },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },
  body:       { flexShrink: 1 },
  footer:     { marginTop: 16 },
  flex1:      { flex: 1 },

  sectionLbl:    { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  dateField:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10 },
  dateFieldLocked: { opacity: 0.5 },
  dateFieldMain: { flex: 1, paddingRight: 10 },
  dateFieldLbl:  { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  dateFieldTxt:  { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  hint:          { color: COLORS.textMuted, fontSize: 11, marginBottom: 16 },

  divider: { height: 1, backgroundColor: COLORS.borderDim, marginVertical: 16 },
});

export default ChallengeFormModal;
