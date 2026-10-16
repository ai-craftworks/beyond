/**
 * src/components/GroupManagerModal.tsx
 * =====================================
 * Add / rename / delete organizational groups for a kind ('exercise' | 'plan').
 * Groups never affect EXP or ranks — they only make long lists easier to find.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Group, getGroups, createGroup, renameGroup, deleteGroup,
} from '../database/Database';
import { COLORS, GroupKind, groupColorForIndex } from '../constants/game';
import { SystemButton } from './UIComponents';
import { playSound } from '../utils/sounds';

interface Props {
  visible: boolean;
  kind: GroupKind;
  title: string;
  onClose: () => void;
  onChanged?: () => void;
}

const GroupManagerModal: React.FC<Props> = ({ visible, kind, title, onClose, onChanged }) => {
  const insets = useSafeAreaInsets();
  const [groups, setGroups]   = useState<Group[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName]   = useState('');
  const [busy, setBusy]       = useState(false);

  const load = async () => setGroups(await getGroups(kind));

  useEffect(() => { if (visible) { load(); setNewName(''); setEditingId(null); } }, [visible, kind]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createGroup(kind, name, groupColorForIndex(groups.length));
      setNewName('');
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const startRename = (g: Group) => {
    playSound('click');
    setEditingId(g.id!);
    setEditName(g.name);
  };

  const saveRename = async () => {
    if (editingId == null) return;
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    await renameGroup(editingId, name);
    setEditingId(null);
    await load();
    onChanged?.();
  };

  const remove = (g: Group) =>
    Alert.alert('Delete Group', `Remove group "${g.name}"?\n\nItems stay; they just lose this group.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteGroup(g.id!);
          await load();
          onChanged?.();
        },
      },
    ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.hdr}>
            <Text style={styles.sheetTitle}>◆ {title.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => { playSound('click'); onClose(); }}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Groups are just labels for finding things — they don't affect EXP or ranks.</Text>

          {/* Add new */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="New group name..."
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <SystemButton title="Add" style={styles.addBtn} onPress={handleAdd} disabled={busy || !newName.trim()} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {groups.length === 0 ? (
              <Text style={styles.empty}>No groups yet. Create one above.</Text>
            ) : (
              groups.map(g => (
                <View key={g.id} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: g.color }]} />
                  {editingId === g.id ? (
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
                    <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                  )}

                  {editingId === g.id ? (
                    <TouchableOpacity onPress={saveRename} style={styles.iconBtn}>
                      <Ionicons name="checkmark" size={18} color={COLORS.accentGreen} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => startRename(g)} style={styles.iconBtn}>
                      <Ionicons name="create" size={16} color={COLORS.accentCyan} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { playSound('click'); remove(g); }} style={styles.iconBtn}>
                    <Ionicons name="trash" size={16} color={COLORS.accentRed} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <SystemButton title="Done" variant="ghost" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── GroupPicker ──────────────────────────────

export const GroupPicker: React.FC<{
  label?: string;
  groups: Group[];
  selected: number[];
  onChange: (ids: number[]) => void;
}> = ({ label = 'Groups', groups, selected, onChange }) => {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <View style={styles.pickerWrap}>
      <Text style={styles.pickerLabel}>{label}</Text>
      {groups.length === 0 ? (
        <Text style={styles.pickerEmpty}>No groups yet — add some from the Groups button.</Text>
      ) : (
        <View style={styles.pickerChips}>
          {groups.map(g => {
            const on = selected.includes(g.id!);
            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.pickerChip, { borderColor: on ? g.color : COLORS.borderMain },
                  on && { backgroundColor: `${g.color}22` }]}
                onPress={() => { playSound('click'); toggle(g.id!); }}
                activeOpacity={0.75}
              >
                <View style={[styles.pickerDot, { backgroundColor: g.color }]} />
                <Text style={[styles.pickerChipTxt, on && { color: g.color }]}>{g.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '88%' },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  hdr:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  hint:       { color: COLORS.textMuted, fontSize: 11, marginTop: 8, marginBottom: 14 },

  addRow:     { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 },
  addInput:   { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: COLORS.textPrimary, fontSize: 14 },
  addBtn:     { paddingHorizontal: 18, minHeight: 46, paddingVertical: 0 },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  dot:        { width: 12, height: 12, borderRadius: 6 },
  name:       { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  editInput:  { flex: 1, color: COLORS.textPrimary, fontSize: 14, borderBottomWidth: 1, borderBottomColor: COLORS.accentCyan, paddingVertical: 2 },
  iconBtn:    { padding: 4 },
  empty:      { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },

  pickerWrap:   { marginBottom: 14 },
  pickerLabel:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  pickerEmpty:  { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic' },
  pickerChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pickerChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  pickerDot:    { width: 8, height: 8, borderRadius: 4 },
  pickerChipTxt:{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
});

export default GroupManagerModal;
