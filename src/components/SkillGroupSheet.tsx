/**
 * src/components/SkillGroupSheet.tsx
 * ==================================
 * Bottom-sheet manager for a single martial art's skill groups
 * (e.g. Punching, Kicks, Takedowns). Create / rename / delete —
 * mirrors the GroupsScreen list, scoped to one art.
 * Skill→group assignment happens in SkillFormModal.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SystemButton, EmptyState } from './UIComponents';
import { COLORS, groupColorForIndex } from '../constants/game';
import {
  SkillGroup, getSkillGroups, createSkillGroup, renameSkillGroup, deleteSkillGroup,
} from '../database/Database';
import { playSound } from '../utils/sounds';

interface SkillGroupSheetProps {
  visible: boolean;
  martialArtId: number;
  onClose: () => void;
  onSaved: () => void;
}

const SkillGroupSheet: React.FC<SkillGroupSheetProps> = ({
  visible, martialArtId, onClose, onSaved,
}) => {
  const insets = useSafeAreaInsets();

  const [groups, setGroups] = useState<SkillGroup[]>([]);
  const [newName, setNewName]   = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName]   = useState('');

  useEffect(() => {
    if (visible) load();
    else { setNewName(''); setEditingId(null); setEditName(''); }
  }, [visible, martialArtId]);

  const load = async () => {
    try {
      setGroups(await getSkillGroups(martialArtId));
    } catch (e) {
      console.error('getSkillGroups error:', e);
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    playSound('click');
    try {
      await createSkillGroup(martialArtId, name, groupColorForIndex(groups.length));
      setNewName('');
      await load();
      onSaved();
    } catch (e) {
      console.error('createSkillGroup error:', e);
      Alert.alert('Error', 'Could not create the group. Please try again.');
    }
  };

  const startRename = (g: SkillGroup) => {
    playSound('click');
    setEditingId(g.id!);
    setEditName(g.name);
  };

  const saveRename = async () => {
    if (editingId == null) return;
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    try {
      const ok = await renameSkillGroup(editingId, name);
      if (!ok) {
        Alert.alert('System', 'A group with that name already exists in this martial art.');
        return;           // keep the editor open so the name can be fixed
      }
      playSound('click');
      setEditingId(null);
      await load();
      onSaved();
    } catch (e) {
      console.error('renameSkillGroup error:', e);
      Alert.alert('Error', 'Could not rename the group. Please try again.');
    }
  };

  const remove = (g: SkillGroup) =>
    Alert.alert('Delete Group', `Remove group "${g.name}"?\n\nSkills stay; they just lose this group.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteSkillGroup(g.id!);
            if (editingId === g.id) setEditingId(null);
            await load();
            onSaved();
          } catch (e) {
            console.error('deleteSkillGroup error:', e);
            Alert.alert('Error', 'Could not delete the group. Please try again.');
          }
        },
      },
    ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.hdr}>
            <Text style={styles.title}>◆ SKILL GROUPS</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Groups are just labels for finding skills — they don't affect EXP or belts.
          </Text>

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="New group (e.g. Punching)..."
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <SystemButton title="Add" style={styles.addBtn} onPress={handleAdd} disabled={!newName.trim()} />
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
            {groups.length === 0 ? (
              <EmptyState icon="pricetags-outline" title="No groups yet"
                subtitle="Create a group above, then assign skills while creating or editing them." />
            ) : (
              groups.map(g => {
                const editing = editingId === g.id;
                return (
                  <View key={g.id} style={styles.card}>
                    <View style={[styles.dot, { backgroundColor: g.color }]} />
                    {editing ? (
                      <TextInput
                        style={styles.editInput}
                        value={editName}
                        onChangeText={setEditName}
                        autoFocus
                        onSubmitEditing={saveRename}
                        returnKeyType="done"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    ) : (
                      <Text style={styles.gName} numberOfLines={1}>{g.name}</Text>
                    )}
                    {!editing && (
                      <Text style={styles.count}>
                        {g.member_count ?? 0} skill{(g.member_count ?? 0) === 1 ? '' : 's'}
                      </Text>
                    )}
                    <View style={styles.cardIcons}>
                      {editing ? (
                        <TouchableOpacity onPress={saveRename} style={styles.iconBtn}>
                          <Ionicons name="checkmark" size={18} color={COLORS.accentGreen} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => startRename(g)} style={styles.iconBtn}>
                          <Ionicons name="create" size={16} color={COLORS.accentCyan} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => remove(g)} style={styles.iconBtn}>
                        <Ionicons name="trash" size={16} color={COLORS.accentRed} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '80%' },
  handle:   { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  hdr:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:    { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  hint:     { color: COLORS.textMuted, fontSize: 11, marginTop: 8, marginBottom: 14, fontStyle: 'italic', lineHeight: 16 },

  addRow:   { flexDirection: 'row', gap: 10, marginBottom: 14 },
  addInput: { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 13 },
  addBtn:   { paddingHorizontal: 18 },

  list:     { flexGrow: 0 },

  card:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  dot:      { width: 10, height: 10, borderRadius: 5 },
  gName:    { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  count:    { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  cardIcons:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  iconBtn:  { padding: 6 },
  editInput:{ flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: COLORS.accentCyan, paddingVertical: 2 },
});

export default SkillGroupSheet;
