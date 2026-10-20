/**
 * src/screens/NoteDetailScreen.tsx
 * =================================
 * One note's reading view: title, well-typeset body (paragraph spacing,
 * comfortable line height) and its attachments (image/GIF/video), plus
 * Edit / Delete actions. Reached from a tutorial's series or the
 * unassigned notes section of a martial art.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getNote, getMartialArt, deleteNote, parseNoteMedia, Note, MartialArt,
} from '../database/Database';
import { SystemButton, SectionHeader, EmptyState } from '../components/UIComponents';
import MediaViewer from '../components/MediaViewer';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { deleteMedia } from '../utils/media';
import { fmtShortDate } from '../utils/dates';
import { playSound } from '../utils/sounds';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'NoteDetail'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'NoteDetail'>;

const NoteDetailScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const { noteId } = route.params;

  const [note, setNote]         = useState<Note | null>(null);
  const [art, setArt]           = useState<MartialArt | null>(null);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    const n = await getNote(noteId);
    if (!n) {
      // Deleted elsewhere — never leave a spinner hanging.
      navigation.goBack();
      return;
    }
    setNote(n);
    setArt(await getMartialArt(n.martial_art_id));
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [noteId]));

  const handleDelete = () =>
    Alert.alert('Delete Note', `Remove "${note?.title}"? Its attachments are deleted too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const uris = await deleteNote(noteId);
            uris.forEach(deleteMedia);
            navigation.goBack();
          } catch (e) {
            console.error('delete note error:', e);
            Alert.alert('Error', 'Could not delete the note.');
          }
        },
      },
    ]);

  if (loading) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={styles.loadRoot}>
        <Text style={styles.missingTxt}>This note no longer exists.</Text>
        <SystemButton title="Go Back" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const attachments = parseNoteMedia(note.media);
  const created = fmtShortDate(note.created_at ?? '');
  const updated = fmtShortDate(note.updated_at ?? '');
  // Blank lines separate paragraphs — rendered as spaced blocks for readability.
  const paragraphs = note.body
    ? note.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    : [];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.tagRow}>
          {!!art && (
            <TouchableOpacity
              style={[styles.chip, { borderColor: art.color, backgroundColor: `${art.color}18` }]}
              onPress={() => { playSound('navigate'); navigation.goBack(); }}
            >
              <View style={[styles.chipDot, { backgroundColor: art.color }]} />
              <Text style={[styles.chipTxt, { color: art.color }]}>{art.name.toUpperCase()}</Text>
            </TouchableOpacity>
          )}
          {!!note.tutorial_title && (
            <TouchableOpacity
              style={[styles.chip, { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}18` }]}
              onPress={() => { playSound('navigate'); navigation.navigate('TutorialDetail', { tutorialId: note.tutorial_id! }); }}
            >
              <Ionicons name="book-outline" size={10} color={COLORS.accentCyan} />
              <Text style={[styles.chipTxt, { color: COLORS.accentCyan }]} numberOfLines={1}>
                {note.tutorial_title}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.title}>{note.title}</Text>
        <Text style={styles.dateLine}>
          {created ? `Added ${created}` : ''}
          {updated ? `${created ? '  ·  ' : ''}Updated ${updated}` : ''}
        </Text>

        <View style={styles.bodyBlock}>
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <Text key={i} style={[styles.paragraph, i > 0 && styles.paragraphGap]}>{p}</Text>
            ))
          ) : (
            <Text style={styles.bodyEmpty}>No text in this note.</Text>
          )}
        </View>

        <View style={styles.actions}>
          <SystemButton title="Edit Note" icon="create-outline" variant="ghost"
            style={styles.flex1}
            onPress={() => navigation.navigate('NoteEditor', {
              noteId,
              tutorialId: note.tutorial_id ?? undefined,
            })} />
          <SystemButton title="Delete" icon="trash-outline" variant="danger"
            style={styles.flex1} onPress={handleDelete} />
        </View>

        {attachments.length > 0 && (
          <>
            <SectionHeader
              title="Attachments"
              subtitle={`${attachments.length} item${attachments.length === 1 ? '' : 's'}`}
            />
            {attachments.map((m, i) => (
              <View key={`${m.uri}-${i}`} style={styles.mediaWrap}>
                <MediaViewer mediaType={m.type} mediaUri={m.uri} />
              </View>
            ))}
          </>
        )}

        {attachments.length === 0 && (
          <EmptyState icon="attach-outline" title="No attachments"
            subtitle="Edit the note to add images, GIFs or videos." />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:   { padding: 16 },
  loadRoot:  { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingTxt: { color: COLORS.textMuted, fontSize: 14, marginBottom: 4 },

  tagRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 200 },
  chipDot:   { width: 6, height: 6, borderRadius: 3 },
  chipTxt:   { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title:     { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  dateLine:  { color: COLORS.textMuted, fontSize: 11, marginBottom: 16 },

  bodyBlock: { marginBottom: 6 },
  paragraph: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 25 },
  paragraphGap: { marginTop: 14 },
  bodyEmpty: { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: 6 },

  actions:   { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 8 },
  flex1:     { flex: 1 },

  mediaWrap: { marginBottom: 10 },
});

export default NoteDetailScreen;
