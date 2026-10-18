/**
 * src/components/SkillFormModal.tsx
 * ===================================
 * Shared create/edit form for a skill under a martial art, including the
 * image/GIF/video demo picker. Used by MartialArtDetail and SkillDetail.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemButton, SystemInput, SystemMultiDropdown } from './UIComponents';
import MediaField from './MediaField';
import { COLORS } from '../constants/game';
import {
  Skill, MediaType, SkillGroup, createSkill, updateSkill,
  getSkillGroups, getSkillGroupIds, setSkillGroupIds,
} from '../database/Database';
import { deleteMedia } from '../utils/media';

interface SkillFormModalProps {
  visible: boolean;
  martialArtId: number;
  initial: Skill | null;
  onClose: () => void;
  onSaved: () => void;
}

const SkillFormModal: React.FC<SkillFormModalProps> = ({
  visible, martialArtId, initial, onClose, onSaved,
}) => {
  const insets = useSafeAreaInsets();

  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [mediaType, setMedia]   = useState<MediaType>('none');
  const [mediaUri, setMediaUri] = useState('');
  const [saving, setSaving]     = useState(false);
  const [groupOptions, setGroupOptions] = useState<SkillGroup[]>([]);
  const [selGroups, setSelGroups]       = useState<string[]>([]);

  // The media URI currently stored in the DB (edit mode) — never delete on cancel.
  const originalUri = initial?.media_uri ?? '';

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setDesc(initial?.description ?? '');
    setMedia(initial?.media_type ?? 'none');
    setMediaUri(initial?.media_uri ?? '');
    setSelGroups([]);
    getSkillGroups(martialArtId).then(setGroupOptions).catch(() => setGroupOptions([]));
    if (initial?.id) {
      getSkillGroupIds(initial.id).then(ids => setSelGroups(ids.map(String))).catch(() => {});
    }
  }, [visible, initial, martialArtId]);

  // Discard an uncommitted picked file when the sheet closes without saving.
  const discardPending = () => {
    if (mediaUri && mediaUri !== originalUri) deleteMedia(mediaUri);
  };

  const handleClose = () => {
    discardPending();
    onClose();
  };

  // Replacing or clearing an uncommitted pick deletes it; the DB-stored
  // original is never touched here (it is handled on save).
  const handleMediaChange = (next: { type: MediaType; uri: string }) => {
    if (mediaUri && mediaUri !== originalUri && next.uri !== mediaUri) deleteMedia(mediaUri);
    setMedia(next.type);
    setMediaUri(next.uri);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('System', 'Skill name required.');
    setSaving(true);
    try {
      let skillId: number;
      if (initial) {
        if (originalUri && originalUri !== mediaUri) deleteMedia(originalUri);
        await updateSkill(initial.id!, {
          name: name.trim(), description: desc.trim(), media_type: mediaType, media_uri: mediaUri,
        });
        skillId = initial.id!;
      } else {
        skillId = await createSkill({
          martial_art_id: martialArtId,
          name: name.trim(), description: desc.trim(), media_type: mediaType, media_uri: mediaUri,
        });
      }
      await setSkillGroupIds(skillId, selGroups.map(Number));
      onSaved();
      onClose();
    } catch (e) {
      console.error('save skill error:', e);
      Alert.alert('Error', 'Failed to save skill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>◆ {initial ? 'EDIT' : 'NEW'} SKILL</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}>
            <SystemInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Roundhouse Kick" />
            <SystemInput label="Description" value={desc} onChangeText={setDesc}
              placeholder="Optional..." multiline />

            <SystemMultiDropdown
              label="Groups"
              placeholder="None"
              options={groupOptions.map(g => ({ value: String(g.id), label: g.name, color: g.color }))}
              values={selGroups}
              onChange={setSelGroups}
            />

            <MediaField
              mediaType={mediaType}
              mediaUri={mediaUri}
              onChange={handleMediaChange}
            />

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
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '92%' },
  handle:       { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },

  row:          { flexDirection: 'row', gap: 12, marginTop: 14 },
  flex1:        { flex: 1 },
});

export default SkillFormModal;
