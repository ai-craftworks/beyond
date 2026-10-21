/**
 * src/screens/TutorialDetailScreen.tsx
 * =====================================
 * One tutorial: title, description and its ordered series of notes.
 * Notes are numbered (01, 02, ...) in reading order and can be moved
 * up/down; tapping one opens its reading view. Reached from the
 * Tutorials tab of a martial art.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTutorial, getTutorialNotes, deleteTutorial, moveNote, parseNoteMedia,
  Tutorial, Note,
} from '../database/Database';
import { SystemButton, SectionHeader, EmptyState } from '../components/UIComponents';
import TutorialFormModal from '../components/TutorialFormModal';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { playSound } from '../utils/sounds';
import { fmtShortDate } from '../utils/dates';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'TutorialDetail'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'TutorialDetail'>;

const TutorialDetailScreen: React.FC = () => {
  const route         = useRoute<Route>();
  const navigation    = useNavigation<Nav>();
  const insets        = useSafeAreaInsets();
  const { tutorialId } = route.params;

  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [notes, setNotes]       = useState<Note[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [moving, setMoving]     = useState(false);

  const load = async () => {
    const [t, n] = await Promise.all([getTutorial(tutorialId), getTutorialNotes(tutorialId)]);
    if (!t) {
      // Deleted elsewhere — never leave a spinner hanging.
      navigation.goBack();
      return;
    }
    setTutorial(t);
    setNotes(n);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [tutorialId]));

  const handleDelete = () =>
    Alert.alert(
      'Delete Tutorial',
      `Remove "${tutorial?.title}"? Its notes will survive as unassigned notes on this martial art.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTutorial(tutorialId);
              navigation.goBack();
            } catch (e) {
              console.error('delete tutorial error:', e);
              Alert.alert('Error', 'Could not delete the tutorial.');
            }
          },
        },
      ]
    );

  const handleMove = async (note: Note, direction: 'up' | 'down') => {
    if (moving) return;
    setMoving(true);
    try {
      await moveNote(note.id!, direction);
      await load();
    } catch (e) {
      console.error('move note error:', e);
    } finally {
      setMoving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  if (!tutorial) {
    return (
      <View style={styles.loadRoot}>
        <Text style={styles.missingTxt}>This tutorial no longer exists.</Text>
        <SystemButton title="Go Back" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        {/* Tutorial header */}
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>TUTORIAL</Text>
          <Text style={styles.heroTitle}>{tutorial.title}</Text>
          {!!tutorial.description && <Text style={styles.heroDesc}>{tutorial.description}</Text>}
          <Text style={styles.heroMeta}>
            {notes.length} note{notes.length === 1 ? '' : 's'}
            {fmtShortDate(tutorial.updated_at || tutorial.created_at || '')
              ? `  ·  updated ${fmtShortDate(tutorial.updated_at || tutorial.created_at || '')}`
              : ''}
          </Text>
        </View>

        <View style={styles.actions}>
          <SystemButton title="Edit" icon="create-outline" variant="ghost"
            style={styles.flex1} onPress={() => setEditModal(true)} />
          <SystemButton title="Delete" icon="trash-outline" variant="danger"
            style={styles.flex1} onPress={handleDelete} />
        </View>

        <SectionHeader
          title="Series"
          subtitle={notes.length === 0 ? 'No notes yet' : 'Tap a note to read it · arrows reorder'}
          action={{ label: '+ Add Note', onPress: () => navigation.navigate('NoteEditor', { tutorialId }) }}
        />

        {notes.length === 0 ? (
          <EmptyState icon="documents-outline"
            title="Empty tutorial"
            subtitle="Add the first note to start the series." />
        ) : (
          notes.map((note, i) => {
            const attachments = parseNoteMedia(note.media).length;
            const date = fmtShortDate(note.updated_at || note.created_at || '');
            return (
              <View key={note.id} style={styles.noteRow}>
                <TouchableOpacity
                  style={styles.noteCard}
                  activeOpacity={0.8}
                  onPress={() => { playSound('navigate'); navigation.navigate('NoteDetail', { noteId: note.id! }); }}
                >
                  <Text style={styles.noteIndex}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <View style={styles.noteMain}>
                    <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                    {!!note.body && <Text style={styles.notePreview} numberOfLines={1}>{note.body}</Text>}
                    <View style={styles.noteMeta}>
                      <Ionicons name="calendar-outline" size={10} color={COLORS.textMuted} />
                      <Text style={styles.noteMetaTxt}>{date || '—'}</Text>
                      {attachments > 0 && (
                        <>
                          <Ionicons name="attach" size={11} color={COLORS.textMuted} style={{ marginLeft: 6 }} />
                          <Text style={styles.noteMetaTxt}>{attachments}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.moveCol}>
                  <TouchableOpacity
                    style={[styles.moveBtn, i === 0 && styles.moveBtnOff]}
                    disabled={i === 0 || moving}
                    onPress={() => handleMove(note, 'up')}
                  >
                    <Ionicons name="chevron-up" size={15}
                      color={i === 0 ? COLORS.borderMain : COLORS.accentCyan} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moveBtn, i === notes.length - 1 && styles.moveBtnOff]}
                    disabled={i === notes.length - 1 || moving}
                    onPress={() => handleMove(note, 'down')}
                  >
                    <Ionicons name="chevron-down" size={15}
                      color={i === notes.length - 1 ? COLORS.borderMain : COLORS.accentCyan} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

      </ScrollView>

      <TutorialFormModal
        visible={editModal}
        martialArtId={tutorial.martial_art_id}
        initial={tutorial}
        onClose={() => setEditModal(false)}
        onSaved={load}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:   { padding: 16 },
  loadRoot:  { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingTxt:{ color: COLORS.textMuted, fontSize: 14, marginBottom: 4 },

  hero:      { backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 14, padding: 16, marginBottom: 12 },
  heroKicker:{ color: COLORS.accentCyan, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '800', marginBottom: 6 },
  heroDesc:  { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  heroMeta:  { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },

  actions:   { flexDirection: 'row', gap: 12, marginBottom: 8 },
  flex1:     { flex: 1 },

  noteRow:   { flexDirection: 'row', alignItems: 'stretch', marginBottom: 8, gap: 6 },
  noteCard:  { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 12, gap: 12 },
  noteIndex: { color: COLORS.accentCyan, fontSize: 15, fontWeight: '800', letterSpacing: 0.5, minWidth: 24, textAlign: 'center' },
  noteMain:  { flex: 1 },
  noteTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  notePreview:{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  noteMeta:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noteMetaTxt:{ color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },

  moveCol:   { justifyContent: 'center', gap: 4 },
  moveBtn:   { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderMain, backgroundColor: COLORS.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  moveBtnOff:{ opacity: 0.5 },
});

export default TutorialDetailScreen;
