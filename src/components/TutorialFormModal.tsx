/**
 * src/components/TutorialFormModal.tsx
 * ====================================
 * Bottom-sheet create/edit form for a tutorial (a titled series of notes
 * under a martial art). Description is optional — it says what the tutorial
 * covers.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemButton, SystemInput } from './UIComponents';
import { COLORS } from '../constants/game';
import { Tutorial, createTutorial, updateTutorial } from '../database/Database';

interface TutorialFormModalProps {
  visible: boolean;
  martialArtId: number;
  initial: Tutorial | null;
  onClose: () => void;
  onSaved: () => void;
}

const TutorialFormModal: React.FC<TutorialFormModalProps> = ({
  visible, martialArtId, initial, onClose, onSaved,
}) => {
  const insets = useSafeAreaInsets();

  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setDesc(initial?.description ?? '');
    setSaving(false);
  }, [visible, initial]);

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('System', 'Tutorial title required.');
    setSaving(true);
    try {
      if (initial) {
        await updateTutorial(initial.id!, { title: title.trim(), description: desc.trim() });
      } else {
        await createTutorial({
          martial_art_id: martialArtId,
          title: title.trim(),
          description: desc.trim(),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error('save tutorial error:', e);
      Alert.alert('Error', 'Failed to save tutorial.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>◆ {initial ? 'EDIT' : 'NEW'} TUTORIAL</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}>
            <SystemInput label="Title" value={title} onChangeText={setTitle}
              placeholder="e. g. Stance & Footwork" />
            <SystemInput label="Description" value={desc} onChangeText={setDesc}
              placeholder="What is this tutorial about? (optional)" multiline />

            <View style={styles.row}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={onClose} />
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

export default TutorialFormModal;
