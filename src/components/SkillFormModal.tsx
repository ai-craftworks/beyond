/**
 * src/components/SkillFormModal.tsx
 * ===================================
 * Shared create/edit form for a skill under a martial art, including the
 * image/GIF/video demo picker. Used by MartialArtDetail and SkillDetail.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SystemButton, SystemInput } from './UIComponents';
import MediaViewer from './MediaViewer';
import { COLORS } from '../constants/game';
import { Skill, SkillMediaType, createSkill, updateSkill } from '../database/Database';
import { pickSkillMedia, deleteMedia } from '../utils/media';

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
  const [mediaType, setMedia]   = useState<SkillMediaType>('none');
  const [mediaUri, setMediaUri] = useState('');
  const [picking, setPicking]   = useState(false);
  const [saving, setSaving]     = useState(false);

  // The media URI currently stored in the DB (edit mode) — never delete on cancel.
  const originalUri = initial?.media_uri ?? '';

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setDesc(initial?.description ?? '');
    setMedia(initial?.media_type ?? 'none');
    setMediaUri(initial?.media_uri ?? '');
  }, [visible, initial]);

  // Discard an uncommitted picked file when the sheet closes without saving.
  const discardPending = () => {
    if (mediaUri && mediaUri !== originalUri) deleteMedia(mediaUri);
  };

  const handleClose = () => {
    discardPending();
    onClose();
  };

  const handlePick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickSkillMedia();
      if (picked) {
        if (mediaUri && mediaUri !== originalUri) deleteMedia(mediaUri);
        setMedia(picked.type);
        setMediaUri(picked.uri);
      }
    } catch (e) {
      console.error('pick media error:', e);
      Alert.alert('Error', 'Could not attach that media file.');
    } finally {
      setPicking(false);
    }
  };

  const handleRemoveMedia = () => {
    if (mediaUri && mediaUri !== originalUri) deleteMedia(mediaUri);
    setMedia('none');
    setMediaUri('');
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('System', 'Skill name required.');
    setSaving(true);
    try {
      if (initial) {
        if (originalUri && originalUri !== mediaUri) deleteMedia(originalUri);
        await updateSkill(initial.id!, {
          name: name.trim(), description: desc.trim(), media_type: mediaType, media_uri: mediaUri,
        });
      } else {
        await createSkill({
          martial_art_id: martialArtId,
          name: name.trim(), description: desc.trim(), media_type: mediaType, media_uri: mediaUri,
        });
      }
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

            <Text style={styles.selectLbl}>DEMO MEDIA</Text>
            {mediaUri ? (
              <>
                <MediaViewer mediaType={mediaType} mediaUri={mediaUri} />
                <View style={styles.mediaActions}>
                  <TouchableOpacity style={styles.mediaBtn} onPress={handlePick} disabled={picking}>
                    <Ionicons name="swap-horizontal" size={15} color={COLORS.accentCyan} />
                    <Text style={styles.mediaBtnTxt}>Replace</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mediaBtn} onPress={handleRemoveMedia}>
                    <Ionicons name="trash-outline" size={15} color={COLORS.accentRed} />
                    <Text style={[styles.mediaBtnTxt, { color: COLORS.accentRed }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.pickBox} onPress={handlePick} disabled={picking} activeOpacity={0.75}>
                {picking
                  ? <ActivityIndicator color={COLORS.accentCyan} />
                  : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={26} color={COLORS.accentCyan} />
                      <Text style={styles.pickBoxTxt}>Pick image, GIF or video</Text>
                    </>
                  )}
              </TouchableOpacity>
            )}

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

  selectLbl:    { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },

  pickBox:      { height: 130, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderMain, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.bgTertiary, marginBottom: 8 },
  pickBoxTxt:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  mediaActions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 4 },
  mediaBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  mediaBtnTxt:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600' },

  row:          { flexDirection: 'row', gap: 12, marginTop: 14 },
  flex1:        { flex: 1 },
});

export default SkillFormModal;
