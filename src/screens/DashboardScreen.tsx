/**
 * src/screens/DashboardScreen.tsx
 * =================================
 * Home screen: player card, EXP bar, today's quests, quick nav.
 * Auto-generates sessions from active plans every time it focuses.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Animated, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPlayer, Player, getTodaySessions, Session,
  getPlans, createSession, populateSessionExercises,
  getMissedSessions, applyMissedSessionPenalty,
  Plan, getPlanExerciseCounts, hasSessionToday,
} from '../database/Database';
import { SystemPanel, SectionHeader, StatRow, ExpBar, RankBadge, EmptyState, IonName } from '../components/UIComponents';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getRankForLevel, STATS } from '../constants/game';
import { RootStackParamList, TabParamList } from '../../App';
import { playSound } from '../utils/sounds';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface PickerPlan { plan: Plan; count: number; added: boolean; }

const DashboardScreen: React.FC = () => {
  const navigation                  = useNavigation<Nav>();
  const insets                      = useSafeAreaInsets();
  const [player, setPlayer]         = useState<Player | null>(null);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerPlans, setPickerPlans]     = useState<PickerPlan[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadData = async () => {
    const p = await getPlayer();
    setPlayer(p);
    await checkMissedPenalties();
    await generateTodaySessions();
    setSessions(await getTodaySessions());
  };

  // Finds sessions from previous days still marked 'pending' and applies their penalty
  const checkMissedPenalties = async () => {
    const missed = await getMissedSessions();
    if (missed.length === 0) return;
    let totalDeducted = 0;
    let penalisedCount = 0;
    for (const session of missed) {
      const deducted = await applyMissedSessionPenalty(session.id!);
      if (deducted > 0) {
        totalDeducted += deducted;
        penalisedCount++;
      }
    }
    if (penalisedCount > 0) {
      playSound('penalty');
      Alert.alert(
        '⚠ Quest Missed',
        `You missed ${penalisedCount} quest${penalisedCount > 1 ? 's' : ''}.\n-${totalDeducted} EXP penalty applied.`,
        [{ text: 'Understood', style: 'destructive' }]
      );
    }
  };

  const generateTodaySessions = async () => {
    const today    = new Date().toISOString().split('T')[0];
    const todayDay = DAY_NAMES[new Date().getDay()];
    const plans    = await getPlans();
    const existing = await getTodaySessions();

    for (const plan of plans) {
      if (!plan.is_active) continue;
      const days: string[] = JSON.parse(plan.repeat_days || '[]');
      // No days = manual-only plan; never auto-generate (add via "+ Add Plan").
      if (days.length === 0) continue;
      // skip if today not in schedule
      if (!days.includes(todayDay)) continue;
      // skip if session already exists today for this plan
      if (existing.some(s => s.plan_id === plan.id && s.date === today)) continue;

      const sessionId = await createSession(plan);
      await populateSessionExercises(sessionId, plan.id!);
    }
  };

  const openPlanPicker = async () => {
    const [plans, counts, todaySessions] = await Promise.all([
      getPlans(), getPlanExerciseCounts(), getTodaySessions(),
    ]);
    setPickerPlans(plans.map(p => ({
      plan: p,
      count: counts[p.id!] ?? 0,
      added: todaySessions.some(s => s.plan_id === p.id),
    })));
    setPickerVisible(true);
  };

  const addPlanToToday = async (plan: Plan) => {
    if (await hasSessionToday(plan.id!)) {
      Alert.alert('System', 'This plan is already in today\u2019s quests.');
      setPickerVisible(false);
      return;
    }
    const sessionId = await createSession(plan, true);
    await populateSessionExercises(sessionId, plan.id!);
    setPickerVisible(false);
    setSessions(await getTodaySessions());
    playSound('questStart');
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!player) return null;

  const rank     = getRankForLevel(player.level);
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const doneCount = sessions.filter(s => s.status === 'completed').length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentCyan} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Animated.Text style={[styles.sysTag, { opacity: pulseAnim }]}>◈ SYSTEM STATUS ◈</Animated.Text>
        <Text style={styles.dateText}>{todayStr}</Text>
      </View>

      {/* Player card */}
      <SystemPanel glow>
        <View style={styles.playerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{player.name[0].toUpperCase()}</Text>
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player.name}</Text>
            <View style={styles.rankRow}>
              <RankBadge rank={rank.rank} color={rank.color} small />
              <Text style={[styles.rankLabel, { color: rank.color }]}>{rank.label}</Text>
            </View>
            <Text style={styles.playerTitle}>「{player.title}」</Text>
          </View>
          <View style={styles.levelBlock}>
            <Text style={styles.levelLbl}>LV</Text>
            <Text style={[styles.levelNum, { color: rank.color }]}>{player.level}</Text>
          </View>
        </View>
        <ExpBar current={player.exp} max={player.exp_to_next} />
      </SystemPanel>

      {/* Stats */}
      <SystemPanel>
        <SectionHeader title="Stats" subtitle="Current attributes" />
        {STATS.map(s => (
          <StatRow key={s.key} icon={s.icon} label={s.label}
            value={(player as any)[s.key]} color={s.color} showBar
            maxValue={Math.max(100, (player as any)[s.key])} />
        ))}
      </SystemPanel>

      {/* Today's quests */}
      <SystemPanel>
        <SectionHeader
          title="Today's Quests"
          subtitle={`${doneCount}/${sessions.length} completed`}
          action={{ label: '+ Add Plan', onPress: openPlanPicker }}
        />
        {sessions.length === 0 ? (
          <EmptyState icon="diamond" title="No quests today"
            subtitle="Tap + Add Plan to begin." />
        ) : (
          sessions.map(s => (
            <QuestCard
              key={s.id} session={s}
              onPress={() => navigation.navigate('Session', { sessionId: s.id! })}
            />
          ))
        )}
      </SystemPanel>

      {/* Quick nav */}
      <View style={styles.quickNav}>
        {([
          { icon: 'barbell', label: 'Exercises', screen: 'Exercises' as const },
          { icon: 'list',    label: 'Plans',     screen: 'Plans'     as const },
          { icon: 'person',  label: 'Profile',   screen: 'Profile'   as const },
        ] as const).map(item => (
          <TouchableOpacity key={item.label} style={styles.quickBtn}
            onPress={() => navigation.navigate(item.screen)}>
            <Ionicons name={item.icon} size={22} color={COLORS.accentCyan} />
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add Plan to today modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHdr}>
              <Text style={styles.sheetTitle}>◆ ADD PLAN TO TODAY</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>Add any plan for today only — no schedule needed.</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {pickerPlans.length === 0 ? (
                <Text style={styles.pickerEmpty}>No plans yet. Create one from the Plans tab.</Text>
              ) : (
                pickerPlans.map(({ plan, count, added }) => {
                  const noEx = count === 0;
                  const disabled = added || noEx;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.pickerRow, disabled && styles.pickerRowDisabled]}
                      disabled={disabled}
                      activeOpacity={0.75}
                      onPress={() => addPlanToToday(plan)}
                    >
                      <View style={styles.pickerInfo}>
                        <Text style={styles.pickerName}>{plan.name}</Text>
                        <Text style={styles.pickerMeta}>
                          {count} exercise{count === 1 ? '' : 's'}
                          {plan.is_active ? '  ·  ACTIVE' : '  ·  MANUAL'}
                        </Text>
                      </View>
                      {added
                        ? <Text style={styles.pickerAdded}>ADDED</Text>
                        : noEx
                          ? <Text style={styles.pickerNoEx}>NO EXERCISES</Text>
                          : <Ionicons name="add-circle" size={22} color={COLORS.accentCyan} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerFooter}
              onPress={() => { setPickerVisible(false); navigation.navigate('Plans'); }}
            >
              <Ionicons name="create-outline" size={16} color={COLORS.accentCyan} />
              <Text style={styles.pickerFooterTxt}>Create New Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ── QuestCard ──────────────────────────────────

const QuestCard: React.FC<{ session: Session; onPress: () => void }> = ({ session, onPress }) => {
  const col = { pending: COLORS.textSecondary, in_progress: COLORS.accentCyan, completed: COLORS.accentGreen, skipped: COLORS.textMuted }[session.status];
  const statusIcons: Record<string, IonName> = { pending: 'ellipse', in_progress: 'radio-button-on', completed: 'checkmark-circle', skipped: 'close-circle' };
  const statusIcon = statusIcons[session.status];
  const lbl = { pending: 'PENDING', in_progress: 'IN PROGRESS', completed: 'COMPLETED', skipped: 'SKIPPED' }[session.status];
  const done = session.status === 'skipped';
  return (
    <TouchableOpacity style={styles.questCard} onPress={onPress} disabled={done} activeOpacity={0.8}>
      <View style={styles.questLeft}>
        <Text style={styles.questName}>{session.plan_name}</Text>
        <View style={styles.questStatusRow}>
          <Ionicons name={statusIcon} size={12} color={col} />
          <Text style={[styles.questStatus, { color: col }]}>{lbl}</Text>
          {!!session.is_manual && <Text style={styles.questManual}>· MANUAL</Text>}
        </View>
      </View>
      {done
        ? <Text style={styles.questExp}>+{session.total_exp} EXP</Text>
        : <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16, paddingBottom: 100 },

  header:    { alignItems: 'center', paddingVertical: 14, marginBottom: 4 },
  sysTag:    { color: COLORS.accentCyan, fontSize: 11, fontWeight: '700', letterSpacing: 4, marginBottom: 3 },
  dateText:  { color: COLORS.textMuted, fontSize: 12 },

  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: `${COLORS.accentCyan}18`, borderWidth: 1.5, borderColor: COLORS.accentCyan, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { color: COLORS.accentCyan, fontSize: 22, fontWeight: '800' },
  playerInfo:  { flex: 1 },
  playerName:  { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 3 },
  rankRow:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
  rankLabel:   { fontSize: 11, fontWeight: '600' },
  playerTitle: { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic' },
  levelBlock:  { alignItems: 'center' },
  levelLbl:    { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  levelNum:    { fontSize: 38, fontWeight: '900', lineHeight: 44 },

  questCard:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim },
  questLeft:   { flex: 1 },
  questName:   { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  questStatus: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginLeft: 4 },
  questStatusRow: { flexDirection: 'row', alignItems: 'center' },
  questExp:    { color: COLORS.accentGreen, fontSize: 13, fontWeight: '700' },

  quickNav:    { flexDirection: 'row', gap: 10 },
  quickBtn:    { flex: 1, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, paddingVertical: 14, alignItems: 'center', gap: 5 },
  quickLabel:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },

  questManual: { color: COLORS.accentGold, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginLeft: 5 },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '85%' },
  handle:      { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  sheetSub:    { color: COLORS.textMuted, fontSize: 11, marginTop: 6, marginBottom: 12, fontStyle: 'italic' },
  pickerEmpty: { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
  pickerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim, gap: 10 },
  pickerRowDisabled: { opacity: 0.5 },
  pickerInfo:  { flex: 1 },
  pickerName:  { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  pickerMeta:  { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  pickerAdded: { color: COLORS.accentGreen, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  pickerNoEx:  { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  pickerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.accentCyan, borderRadius: 8 },
  pickerFooterTxt: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
});

export default DashboardScreen;
