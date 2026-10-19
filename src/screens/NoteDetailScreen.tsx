/**
 * src/screens/NoteDetailScreen.tsx
 * =================================
 * One theory note: title, body text and its attachments (image/GIF/video),
 * plus Edit / Delete actions. Reached from the Notes tab of a martial art.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getNote, getMartialArt, deleteNote, parseNoteMedia, Note, MartialArt,
} from '../database/Database';
import { SystemButton, SectionHeader, EmptyState } from '../components/UIComponents';
import MediaViewer from '../components/MediaViewer';
import NoteFormModal from '../components/NoteFormModal';
import { COLORS } from '../constants/game';
import { deleteMedia } from '../utils/media';
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
  const [editModal, setEditModal] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, [noteId]));

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

  if (loading || !note) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  const attachments = parseNoteMedia(note.media);
  const created = (note.created_at ?? '').slice(0, 10);
  const updated = (note.updated_at ?? '').slice(0, 10);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        {!!art && (
          <Text style={[styles.artTag, { color: art.color }]}>{art.name.toUpperCase()}</Text>
        )}
        <Text style={styles.title}>{note.title}</Text>
        <Text style={styles.dateLine}>
          {created ? `Added ${created}` : ''}
          {updated ? `${created ? '  ·  ' : ''}Updated ${updated}` : ''}
        </Text>

        {note.body ? (
          <Text style={styles.body}>{note.body}</Text>
        ) : (
          <Text style={styles.bodyEmpty}>No text in this note.</Text>
        )}

        <View style={styles.actions}>
          <SystemButton title="Edit Note" icon="create-outline" variant="ghost"
            style={styles.flex1} onPress={() => setEditModal(true)} />
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

      <NoteFormModal
        visible={editModal}
        martialArtId={note.martial_art_id}
        initial={note}
        onClose={() => setEditModal(false)}
        onSaved={load}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:   { padding: 16 },
  loadRoot:  { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },

  artTag:    { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  title:     { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  dateLine:  { color: COLORS.textMuted, fontSize: 11, marginBottom: 14 },

  body:      { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 6 },
  bodyEmpty: { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: 6 },

  actions:   { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 8 },
  flex1:     { flex: 1 },

  mediaWrap: { marginBottom: 10 },
});

export default NoteDetailScreen;
