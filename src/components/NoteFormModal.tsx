/**
 * src/components/NoteFormModal.tsx
 * =================================
 * Shared create/edit form for a theory note under a martial art: title,
 * notes text and any number of image/GIF/video attachments. Used by
 * MartialArtDetail (create) and NoteDetail (edit).
 *
 * File lifecycle follows SkillFormModal: uncommitted picks are deleted when
 * the sheet closes without saving, and attachments removed during an edit are
 * deleted from disk only when the save actually lands.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemButton, SystemInput } from './UIComponents';
import NoteMediaField from './NoteMediaField';
import { COLORS } from '../constants/game';
import {
  Note, NoteMedia, createNote, updateNote, parseNoteMedia,
} from '../database/Database';
import { deleteMedia } from '../utils/media';

interface NoteFormModalProps {
  visible: boolean;
  martialArtId: number;
  initial: Note | null;
  onClose: () => void;
  onSaved: () => void;
}

const NoteFormModal: React.FC<NoteFormModalProps> = ({
  visible, martialArtId, initial, onClose, onSaved,
}) => {
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [body, setBody]         = useState('');
  const [items, setItems]       = useState<NoteMedia[]>([]);
  const [saving, setSaving]     = useState(false);

  // URIs already stored in the DB (edit mode) — never deleted by this form.
  const originalUris = new Set(parseNoteMedia(initial?.media).map(m => m.uri));

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setItems(parseNoteMedia(initial?.media));
  }, [visible, initial]);

  // An attachment removed before saving was either just picked (delete the
  // file now) or came from the DB (deleted on save instead).
  const handleItemsChange = (next: NoteMedia[]) => {
    const nextUris = new Set(next.map(m => m.uri));
    for (const it of items) {
      if (!nextUris.has(it.uri) && !originalUris.has(it.uri)) deleteMedia(it.uri);
    }
    setItems(next);
  };

  // Cancel: discard every uncommitted pick still on screen (picks removed
  // while editing were already deleted above); DB originals stay put.
  const handleClose = () => {
    for (const it of items) {
      if (!originalUris.has(it.uri)) deleteMedia(it.uri);
    }
    onClose();
  };

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('System', 'Note title required.');
    setSaving(true);
    try {
      const media = JSON.stringify(items);
      if (initial) {
        const finalUris = new Set(items.map(m => m.uri));
        for (const u of originalUris) if (!finalUris.has(u)) deleteMedia(u);
        await updateNote(initial.id!, { title: title.trim(), body: body.trim(), media });
      } else {
        await createNote({
          martial_art_id: martialArtId,
          title: title.trim(), body: body.trim(), media,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error('save note error:', e);
      Alert.alert('Error', 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>◆ {initial ? 'EDIT' : 'NEW'} NOTE</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}>
            <SystemInput label="Title" value={title} onChangeText={setTitle}
              placeholder="e.g. Stance fundamentals" />
            <SystemInput label="Notes" value={body} onChangeText={setBody}
              placeholder="Theory, principles, drills, corrections..." multiline />

            <NoteMediaField items={items} onChange={handleItemsChange} />

            <View style={styles.row}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={handleClose} />
              <SystemButton title={initial ? 'Save' : 'Create'} style={styles.flex1}
                onPress={handleSave} loading={saving} />
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
  sheetTitle: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },

  row:        { flexDirection: 'row', gap: 12, marginTop: 14 },
  flex1:      { flex: 1 },
});

export default NoteFormModal;
