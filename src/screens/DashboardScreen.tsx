/**
 * src/screens/DashboardScreen.tsx
 * =================================
 * Home screen: player card, EXP bar, today's quests, quick nav.
 * Auto-generates sessions from active plans every time it focuses.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Animated, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getPlayer, Player, getTodaySessions, Session,
  getPlans, createSession, populateSessionExercises,
  getMissedSessions, applyMissedSessionPenalty,   // ← add these two
} from '../database/Database';
import { SystemPanel, SectionHeader, StatRow, ExpBar, RankBadge, EmptyState } from '../components/UIComponents';
import { COLORS, getRankForLevel, STATS } from '../constants/game';
import { RootStackParamList, TabParamList } from '../../App';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DashboardScreen: React.FC = () => {
  const navigation                  = useNavigation<Nav>();
  const [player, setPlayer]         = useState<Player | null>(null);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    for (const session of missed) {
      const deducted = await applyMissedSessionPenalty(session.id!);
      if (deducted > 0) {
        // Brief alert so player knows they were penalised
        Alert.alert(
          '⚠ Quest Missed',
          `You missed a quest from ${session.date}.\n-${deducted} EXP penalty applied.`,
          [{ text: 'Understood', style: 'destructive' }]
        );
      }
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
      // skip if today not in schedule (empty = every day)
      if (days.length > 0 && !days.includes(todayDay)) continue;
      // skip if session already exists today for this plan
      if (existing.some(s => s.plan_id === plan.id && s.date === today)) continue;

      const sessionId = await createSession(plan);
      await populateSessionExercises(sessionId, plan.id!);
    }
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
          action={{ label: '+ New Plan', onPress: () => navigation.navigate('Plans') }}
        />
        {sessions.length === 0 ? (
          <EmptyState icon="🗡️" title="No quests today"
            subtitle="Activate a plan to begin." />
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
          { icon: '🏋️', label: 'Exercises', screen: 'Exercises' as const },
          { icon: '📋', label: 'Plans',     screen: 'Plans'     as const },
          { icon: '🏆', label: 'Profile',   screen: 'Profile'   as const },
        ] as const).map(item => (
          <TouchableOpacity key={item.label} style={styles.quickBtn}
            onPress={() => navigation.navigate(item.screen)}>
            <Text style={styles.quickIcon}>{item.icon}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

// ── QuestCard ──────────────────────────────────

const QuestCard: React.FC<{ session: Session; onPress: () => void }> = ({ session, onPress }) => {
  const col = { pending: COLORS.textSecondary, in_progress: COLORS.accentCyan, completed: COLORS.accentGreen, skipped: COLORS.textMuted }[session.status];
  const lbl = { pending: '○ PENDING', in_progress: '◉ IN PROGRESS', completed: '✓ COMPLETED', skipped: '✗ SKIPPED' }[session.status];
  const done = session.status === 'completed' || session.status === 'skipped';
  return (
    <TouchableOpacity style={styles.questCard} onPress={onPress} disabled={done} activeOpacity={0.7}>
      <View style={styles.questLeft}>
        <Text style={styles.questName}>{session.plan_name}</Text>
        <Text style={[styles.questStatus, { color: col }]}>{lbl}</Text>
      </View>
      {done
        ? <Text style={styles.questExp}>+{session.total_exp} EXP</Text>
        : <Text style={styles.questArrow}>▶</Text>}
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
  questStatus: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  questExp:    { color: COLORS.accentGreen, fontSize: 13, fontWeight: '700' },
  questArrow:  { color: COLORS.accentCyan, fontSize: 18 },

  quickNav:    { flexDirection: 'row', gap: 10 },
  quickBtn:    { flex: 1, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, paddingVertical: 14, alignItems: 'center', gap: 5 },
  quickIcon:   { fontSize: 22 },
  quickLabel:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
});

export default DashboardScreen;
