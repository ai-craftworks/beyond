/**
 * src/components/TutorialsSection.tsx
 * ==================================
 * The tutorials list for one martial art (or for the global collection when
 * martialArtId is 0): tutorial cards, unassigned legacy notes, and the
 * create/edit modal. Extracted from MartialArtDetailScreen so the global
 * Tutorials screen renders the exact same UI.
 */

import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getTutorials, getUnassignedNotes, parseNoteMedia, Tutorial, Note } from '../database/Database';
import { SectionHeader, EmptyState } from './UIComponents';
import TutorialFormModal from './TutorialFormModal';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { playSound } from '../utils/sounds';
import { fmtShortDate } from '../utils/dates';
import { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TutorialsSection: React.FC<{ martialArtId: number }> = ({ martialArtId }) => {
  const navigation = useNavigation<Nav>();

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [unassignedNotes, setUnassignedNotes] = useState<Note[]>([]);
  const [tutorialModal, setTutorialModal] = useState(false);
  const [tutorialInitial, setTutorialInitial] = useState<Tutorial | null>(null);

  const load = async () => {
    const [t, n] = await Promise.all([
      getTutorials(martialArtId), getUnassignedNotes(martialArtId),
    ]);
    setTutorials(t);
    setUnassignedNotes(n);
  };

  useFocusEffect(useCallback(() => { load(); }, [martialArtId]));

  return (
    <>
      <SectionHeader
        title="Tutorials"
        subtitle={`${tutorials.length} tutorial${tutorials.length === 1 ? '' : 's'}`}
        action={{ label: '+ New Tutorial', onPress: () => { setTutorialInitial(null); setTutorialModal(true); } }}
      />

      {tutorials.length === 0 && unassignedNotes.length === 0 ? (
        <EmptyState icon="book-outline"
          title="No tutorials yet"
          subtitle="A tutorial is a titled series of notes — theory, principles, drills, references." />
      ) : (
        tutorials.map(tut => (
          <TouchableOpacity
            key={tut.id}
            style={styles.tutCard}
            activeOpacity={0.8}
            onPress={() => { playSound('navigate'); navigation.navigate('TutorialDetail', { tutorialId: tut.id! }); }}
          >
            <View style={styles.tutMain}>
              <Text style={styles.tutTitle} numberOfLines={1}>{tut.title}</Text>
              {!!tut.description && (
                <Text style={styles.tutDesc} numberOfLines={2}>{tut.description}</Text>
              )}
              <View style={styles.tutMeta}>
                <Ionicons name="documents-outline" size={11} color={COLORS.textMuted} />
                <Text style={styles.tutMetaTxt}>
                  {tut.note_count ?? 0} note{(tut.note_count ?? 0) === 1 ? '' : 's'}
                </Text>
                <Ionicons name="calendar-outline" size={11} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                <Text style={styles.tutMetaTxt}>{fmtShortDate(tut.updated_at || tut.created_at || '') || '—'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))
      )}

      {unassignedNotes.length > 0 && (<>
        <SectionHeader title="Unassigned Notes"
          subtitle={`${unassignedNotes.length} note${unassignedNotes.length === 1 ? '' : 's'} not in any tutorial`} />
        {unassignedNotes.map(note => {
          const attachments = parseNoteMedia(note.media).length;
          const date = fmtShortDate(note.updated_at || note.created_at || '');
          return (
            <TouchableOpacity
              key={note.id}
              style={styles.noteCard}
              activeOpacity={0.8}
              onPress={() => { playSound('navigate'); navigation.navigate('NoteDetail', { noteId: note.id! }); }}
            >
              <View style={styles.noteMain}>
                <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                {!!note.body && <Text style={styles.notePreview} numberOfLines={2}>{note.body}</Text>}
                <View style={styles.noteMeta}>
                  <Ionicons name="calendar-outline" size={11} color={COLORS.textMuted} />
                  <Text style={styles.noteMetaTxt}>{date || '—'}</Text>
                  {attachments > 0 && (
                    <>
                      <Ionicons name="attach" size={12} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                      <Text style={styles.noteMetaTxt}>{attachments}</Text>
                    </>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </>)}

      <TutorialFormModal
        visible={tutorialModal}
        martialArtId={martialArtId}
        initial={tutorialInitial}
        onClose={() => setTutorialModal(false)}
        onSaved={load}
      />
    </>
  );
};

const styles = StyleSheet.create({
  tutCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 13, marginBottom: 8, gap: 10 },
  tutMain:   { flex: 1 },
  tutTitle:  { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  tutDesc:   { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  tutMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tutMetaTxt:{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },

  noteCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 13, marginBottom: 8, gap: 10 },
  noteMain:  { flex: 1 },
  noteTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  notePreview:{ color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  noteMeta:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noteMetaTxt:{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
});

export default TutorialsSection;
