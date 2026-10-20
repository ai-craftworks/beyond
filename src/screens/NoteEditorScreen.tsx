/**
 * src/screens/NoteEditorScreen.tsx
 * =================================
 * Full-screen note editor: title, a large writing area that grows with the
 * content, attachments and a tutorial picker (move the note between
 * tutorials, or unassign it). Reached from a tutorial's series or a note's
 * reading view; draws its own Cancel / Save top bar.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, BackHandler, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getNote, getTutorial, getTutorials, createNote, updateNote, setNoteTutorial,
  Tutorial, NoteMedia,
} from '../database/Database';
import { SystemInput, SystemDropdown } from '../components/UIComponents';
import NoteMediaField from '../components/NoteMediaField';
import { COLORS } from '../constants/game';
import { deleteMedia } from '../utils/media';
import { RootStackParamList } from '../../App';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Route = RouteProp<RootStackParamList, 'NoteEditor'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'NoteEditor'>;

const NoteEditorScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const { tutorialId, noteId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [artId, setArtId]     = useState<number | null>(null);

  const [title, setTitle]     = useState('');
  const [body, setBody]       = useState('');
  const [bodyHeight, setBodyHeight] = useState(260);
  const [items, setItems]     = useState<NoteMedia[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selTutorial, setSelTutorial] = useState<string>(
    tutorialId != null ? String(tutorialId) : ''
  );

  // Attachment URIs already stored in the DB — never delete these on cancel.
  const originalUris = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (noteId != null) {
          const n = await getNote(noteId);
          if (!n) { navigation.goBack(); return; }
          if (!alive) return;
          setTitle(n.title);
          setBody(n.body);
          const parsed: NoteMedia[] = JSON.parse(n.media || '[]');
          setItems(Array.isArray(parsed) ? parsed : []);
          originalUris.current = new Set(parsed.map(m => m.uri));
          setArtId(n.martial_art_id);
          setSelTutorial(n.tutorial_id != null ? String(n.tutorial_id) : '');
          setTutorials(await getTutorials(n.martial_art_id));
        } else if (tutorialId != null) {
          const t = await getTutorial(tutorialId);
          if (!t) { navigation.goBack(); return; }
          if (!alive) return;
          setArtId(t.martial_art_id);
          setTutorials(await getTutorials(t.martial_art_id));
          setSelTutorial(String(tutorialId));
        } else {
          navigation.goBack();
          return;
        }
      } catch (e) {
        console.error('load note editor error:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [noteId, tutorialId]);

  /** Deletes picked files that are not stored in the DB yet. */
  const discardUncommitted = () => {
    for (const m of items) {
      if (!originalUris.current.has(m.uri)) deleteMedia(m.uri);
    }
  };

  const handleCancel = () => {
    discardUncommitted();
    navigation.goBack();
  };

  // Android back button behaves like Cancel (discards uncommitted picks).
  // No dep array: re-subscribes each render so it always sees fresh state.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => sub.remove();
  });

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('System', 'Note title required.');
    if (artId == null) return;
    setSaving(true);
    try {
      const media = JSON.stringify(items);
      const nextTutorialId = selTutorial ? Number(selTutorial) : null;
      if (noteId != null) {
        await updateNote(noteId, { title: title.trim(), body, media });
        // Sync placement — the picker may have moved it (or unassigned it).
        const current = await getNote(noteId);
        if ((current?.tutorial_id ?? null) !== nextTutorialId) {
          await setNoteTutorial(noteId, nextTutorialId);
        }
        // The replaced attachments are no longer referenced — free their files.
        for (const uri of originalUris.current) {
          if (!items.some(m => m.uri === uri)) deleteMedia(uri);
        }
      } else {
        await createNote({
          martial_art_id: artId,
          title: title.trim(),
          body,
          media,
          tutorial_id: nextTutorialId,
        });
      }
      navigation.goBack();
    } catch (e) {
      console.error('save note error:', e);
      Alert.alert('Error', 'Failed to save the note.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={handleCancel} disabled={saving}>
          <Text style={styles.topCancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{noteId != null ? 'EDIT NOTE' : 'NEW NOTE'}</Text>
        <TouchableOpacity style={styles.topBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={COLORS.accentCyan} />
            : <Text style={styles.topSave}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SystemInput label="Title" value={title} onChangeText={setTitle}
          placeholder="Note title" />

        <SystemDropdown
          label="Tutorial"
          placeholder="Unassigned"
          options={tutorials.map(t => ({ value: String(t.id), label: t.title }))}
          value={selTutorial}
          onChange={setSelTutorial}
        />

        <Text style={styles.bodyLabel}>NOTE</Text>
        <TextInput
          style={[styles.bodyInput, { minHeight: bodyHeight }]}
          value={body}
          onChangeText={setBody}
          placeholder="Start writing… Paragraphs, principles, drills, corrections…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          textAlignVertical="top"
          onContentSizeChange={e =>
            setBodyHeight(Math.max(260, e.nativeEvent.contentSize.height + 8))
          }
        />
        <Text style={styles.charCount}>{body.length} characters</Text>

        <NoteMediaField items={items} onChange={setItems} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bgPrimary },
  loadRoot:  { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },

  topBar:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: COLORS.bgSecondary, borderBottomWidth: 1, borderBottomColor: COLORS.borderMain,
  },
  topBtn:    { minWidth: 64, minHeight: 32, justifyContent: 'center' },
  topCancel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  topTitle:  { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  topSave:   { color: COLORS.accentCyan, fontSize: 14, fontWeight: '800', textAlign: 'right' },

  scroll:    { flex: 1 },
  content:   { padding: 16 },

  bodyLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  bodyInput: {
    backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain,
    borderRadius: 10, padding: 14, paddingTop: 14,
    color: COLORS.textPrimary, fontSize: 15, lineHeight: 24,
  },
  charCount: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'right', marginTop: 6, marginBottom: 14 },
});

export default NoteEditorScreen;
