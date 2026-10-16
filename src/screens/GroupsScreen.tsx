/**
 * src/screens/GroupsScreen.tsx
 * =============================
 * Dedicated manager + browser for organizational groups.
 *
 * - Segmented toggle between Workout groups and Plan groups.
 * - Create / rename / delete groups (only place that manages them).
 * - Tap a group to expand it inline and see everything inside.
 *
 * Groups are purely organizational — they never affect EXP or ranks.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Group, Exercise, Plan,
  getGroups, createGroup, renameGroup, deleteGroup, getExercises, getPlans,
} from '../database/Database';
import {
  SystemButton, EmptyState,
} from '../components/UIComponents';
import {
  COLORS, EXERCISE_CATEGORIES, STATS, GroupKind, groupColorForIndex,
  parseGroupIds, unitSuffix,
} from '../constants/game';
import { RootStackParamList } from '../../App';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Groups'>;

const accentForCat = (cat: string): string => {
  const stat = EXERCISE_CATEGORIES.find(c => c.value === cat)?.stat;
  return STATS.find(s => s.key === stat)?.color ?? COLORS.textSecondary;
};

const GroupsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const insets     = useSafeAreaInsets();

  const [kind, setKind] = useState<GroupKind>(route.params?.kind ?? 'exercise');

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [exGroups, setExGroups]   = useState<Group[]>([]);
  const [planGroups, setPlanGroups] = useState<Group[]>([]);

  const [newName, setNewName]     = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName]   = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [exs, pls, eg, pg] = await Promise.all([
      getExercises(), getPlans(), getGroups('exercise'), getGroups('plan'),
    ]);
    setExercises(exs);
    setPlans(pls);
    setExGroups(eg);
    setPlanGroups(pg);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const groups = kind === 'exercise' ? exGroups : planGroups;

  const membersOf = (gid: number) =>
    (kind === 'exercise' ? exercises : plans).filter(it => parseGroupIds(it.groups).includes(gid));

  const switchKind = (k: GroupKind) => {
    setKind(k);
    setExpandedId(null);
    setEditingId(null);
    setNewName('');
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('System', 'A group with this name already exists.');
      return;
    }
    try {
      await createGroup(kind, name, groupColorForIndex(groups.length));
      setNewName('');
      await load();
    } catch (e) {
      console.error('createGroup error:', e);
      Alert.alert('Error', 'Could not create the group. Please try again.');
    }
  };

  const startRename = (g: Group) => {
    setEditingId(g.id!);
    setEditName(g.name);
  };

  const saveRename = async () => {
    if (editingId == null) return;
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    try {
      const ok = await renameGroup(editingId, name);
      if (!ok) {
        Alert.alert('System', 'A group with that name already exists.');
        return;           // keep the editor open so the name can be fixed
      }
      setEditingId(null);
      await load();
    } catch (e) {
      console.error('renameGroup error:', e);
      Alert.alert('Error', 'Could not rename the group. Please try again.');
    }
  };

  const remove = (g: Group) =>
    Alert.alert('Delete Group', `Remove group "${g.name}"?\n\nItems stay; they just lose this group.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroup(g.id!);
            if (expandedId === g.id) setExpandedId(null);
            await load();
          } catch (e) {
            console.error('deleteGroup error:', e);
            Alert.alert('Error', 'Could not delete the group. Please try again.');
          }
        },
      },
    ]);

  const toggleExpand = (gid: number) =>
    setExpandedId(prev => (prev === gid ? null : gid));

  const openPlan = (plan: Plan) => navigation.navigate('ManagePlan', { plan });

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Segment toggle */}
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, kind === 'exercise' && styles.segBtnOn]}
            onPress={() => switchKind('exercise')} activeOpacity={0.8}
          >
            <Ionicons name="barbell-outline" size={15}
              color={kind === 'exercise' ? COLORS.accentCyan : COLORS.textSecondary} />
            <Text style={[styles.segTxt, kind === 'exercise' && styles.segTxtOn]}>Workouts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, kind === 'plan' && styles.segBtnOn]}
            onPress={() => switchKind('plan')} activeOpacity={0.8}
          >
            <Ionicons name="list-outline" size={15}
              color={kind === 'plan' ? COLORS.accentCyan : COLORS.textSecondary} />
            <Text style={[styles.segTxt, kind === 'plan' && styles.segTxtOn]}>Plans</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Groups are just labels for finding things — they don't affect EXP or ranks.
        </Text>

        {/* Add new */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newName}
            onChangeText={setNewName}
            placeholder={kind === 'exercise' ? 'New workout group...' : 'New plan group...'}
            placeholderTextColor={COLORS.textMuted}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <SystemButton title="Add" style={styles.addBtn} onPress={handleAdd} disabled={!newName.trim()} />
        </View>

        {groups.length === 0 ? (
          <EmptyState icon="pricetags-outline"
            title="No groups yet"
            subtitle={kind === 'exercise'
              ? 'Create a group above to organise your workouts.'
              : 'Create a group above to organise your plans.'} />
        ) : (
          groups.map(g => {
            const members = membersOf(g.id!);
            const expanded = expandedId === g.id;
            const editing  = editingId === g.id;
            return (
              <View key={g.id} style={[styles.card, expanded && { borderColor: g.color }]}>
                <View style={styles.cardHdr}>
                  <TouchableOpacity style={styles.cardHdrMain} onPress={() => toggleExpand(g.id!)} activeOpacity={0.8}>
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
                        {members.length} {kind === 'exercise' ? (members.length === 1 ? 'workout' : 'workouts') : (members.length === 1 ? 'plan' : 'plans')}
                      </Text>
                    )}
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>

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

                {expanded && (
                  <View style={styles.members}>
                    {members.length === 0 ? (
                      <Text style={styles.memberEmpty}>
                        Nothing in this group yet. Assign it while creating or editing {kind === 'exercise' ? 'a workout' : 'a plan'}.
                      </Text>
                    ) : kind === 'exercise' ? (
                      (members as Exercise[]).map(m => (
                        <View key={m.id} style={styles.memberRow}>
                          <View style={[styles.memberAccent, { backgroundColor: accentForCat(m.category) }]} />
                          <Ionicons name="barbell-outline" size={14} color={accentForCat(m.category)} />
                          <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                          <Text style={styles.memberMeta}>
                            +{m.exp_per_unit ?? m.exp_reward} / {m.exp_unit_count ?? 1} {unitSuffix(m.primary_unit ?? m.unit_type ?? 'reps')}
                          </Text>
                        </View>
                      ))
                    ) : (
                      (members as Plan[]).map(m => (
                        <TouchableOpacity key={m.id} style={styles.memberRow}
                          onPress={() => openPlan(m)} activeOpacity={0.75}>
                          <Ionicons name="list-outline" size={14} color={COLORS.accentCyan} />
                          <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                          <View style={[styles.miniPill, m.is_active ? styles.miniPillOn : null]}>
                            <Text style={[styles.miniPillTxt, { color: m.is_active ? COLORS.accentCyan : COLORS.textMuted }]}>
                              {m.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:    { padding: 16 },

  segment:    { flexDirection: 'row', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 4, gap: 4, marginBottom: 12 },
  segBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 7 },
  segBtnOn:   { backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderGlow },
  segTxt:     { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  segTxtOn:   { color: COLORS.accentCyan },

  hint:       { color: COLORS.textMuted, fontSize: 11, marginBottom: 16 },

  addRow:     { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 18 },
  addInput:   { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: COLORS.textPrimary, fontSize: 14 },
  addBtn:     { paddingHorizontal: 18, minHeight: 46, paddingVertical: 0 },

  card:       { backgroundColor: COLORS.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderMain, marginBottom: 10, overflow: 'hidden' },
  cardHdr:    { flexDirection: 'row', alignItems: 'center' },
  cardHdrMain:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 14 },
  dot:        { width: 12, height: 12, borderRadius: 6 },
  gName:      { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  count:      { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  editInput:  { flex: 1, color: COLORS.textPrimary, fontSize: 15, borderBottomWidth: 1, borderBottomColor: COLORS.accentCyan, paddingVertical: 2 },
  cardIcons:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10 },
  iconBtn:    { padding: 6 },

  members:    { borderTopWidth: 1, borderTopColor: COLORS.borderDim, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: COLORS.bgTertiary },
  memberRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  memberAccent: { width: 3, height: 16, borderRadius: 2 },
  memberName: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
  memberMeta: { color: COLORS.textMuted, fontSize: 11 },
  memberEmpty:{ color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic', paddingVertical: 8 },
  miniPill:   { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  miniPillOn: { backgroundColor: `${COLORS.accentCyan}18` },
  miniPillTxt:{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});

export default GroupsScreen;
