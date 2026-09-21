/**
 * src/screens/ProfileScreen.tsx
 * ===============================
 * Full player profile: rank banner, all stats, earned titles, session history.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPlayer, Player, getTitles, EarnedTitle, getRecentSessions, Session, getSessionSummary, resetAllData } from '../database/Database';
import { SystemPanel, SectionHeader, StatRow, ExpBar } from '../components/UIComponents';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getRankForLevel, STATS, parseUnitValues, formatUnitValues } from '../constants/game';
import { sumExp, expToNextRemaining } from '../utils/math';

const amountLabel = (ex: any): string =>
  formatUnitValues(parseUnitValues(ex.actual_units)) || `${ex.actual_amount} ${ex.unit_label ?? 'reps'}`;

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

const ProfileScreen: React.FC = () => {
  const [player,   setPlayer]   = useState<Player | null>(null);
  const [titles,   setTitles]   = useState<EarnedTitle[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<number, any>>({});

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    const [p, t, s] = await Promise.all([getPlayer(), getTitles(), getRecentSessions(15)]);
    setPlayer(p);
    setTitles(t);
    setSessions(s);
  };

  const toggleSession = async (sessionId: number) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionId);
    // Always re-fetch — bonus exercises can be added after session completion
    const detail = await getSessionSummary(sessionId);
    setSessionDetails(prev => ({ ...prev, [sessionId]: detail }));
  };

  if (!player) return null;

  const rank       = getRankForLevel(player.level);
  const completed  = sessions.filter(s => s.status === 'completed').length;
  const totalExp   = sumExp(sessions);

  const handleReset = () => {
    Alert.alert(
      '⚠ Reset All Data',
      'This will permanently delete your player, all exercises, plans, sessions, and titles. You will start from scratch.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            await resetAllData();
            navigation.replace('Registration');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* ── Rank banner ── */}
      <View style={[styles.rankBanner, { borderColor: rank.color }]}>
        <Text style={[styles.bigRank, { color: rank.color }]}>{rank.rank}</Text>
        <View style={styles.bannerRight}>
          <Text style={styles.bannerName}>{player.name}</Text>
          <Text style={[styles.bannerRankLbl, { color: rank.color }]}>{rank.label}</Text>
          <Text style={styles.bannerTitle}>「{player.title}」</Text>
          <Text style={styles.bannerLevel}>Lv. {player.level}</Text>
        </View>
      </View>

      {/* EXP bar */}
      <SystemPanel>
        <ExpBar current={player.exp} max={player.exp_to_next} />
        <Text style={styles.expHint}>{expToNextRemaining(player.exp, player.exp_to_next)} EXP to Level {player.level + 1}</Text>
      </SystemPanel>

      {/* Stats */}
      <SystemPanel>
        <SectionHeader title="Status Window" subtitle="All attributes" />
        {STATS.map(s => (
          <StatRow key={s.key} icon={s.icon} label={s.label}
            value={(player as any)[s.key]} color={s.color} showBar
            maxValue={Math.max(100, (player as any)[s.key])} />
        ))}
      </SystemPanel>

      {/* Achievements summary */}
      <SystemPanel>
        <SectionHeader title="Achievements" />
        <View style={styles.achieveRow}>
          {[
            { label: 'Sessions\nCompleted', value: completed,    color: COLORS.accentCyan   },
            { label: 'Total EXP\nEarned',  value: totalExp,     color: COLORS.accentGold   },
            { label: 'Titles\nEarned',     value: titles.length, color: COLORS.accentPurple },
          ].map(item => (
            <View key={item.label} style={styles.achieveBox}>
              <Text style={[styles.achieveVal, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.achieveLbl}>{item.label}</Text>
            </View>
          ))}
        </View>
      </SystemPanel>

      {/* Titles */}
      <SystemPanel>
        <SectionHeader title="Titles" subtitle={`${titles.length} earned`} />
        {titles.length === 0
          ? <Text style={styles.noData}>Complete sessions to earn titles, Hunter.</Text>
          : titles.map(t => (
            <View key={t.id} style={styles.titleRow}>
              <View style={styles.titleLeft}>
                <Text style={styles.titleName}>「{t.title}」</Text>
                <Text style={styles.titleDesc}>{t.description}</Text>
              </View>
              <Text style={styles.titleDate}>
                {new Date(t.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ))}
      </SystemPanel>

      {/* Session history */}
      <SystemPanel>
        <SectionHeader title="Recent Sessions" subtitle="Last 15" />
        {sessions.length === 0
          ? <Text style={styles.noData}>No sessions yet.</Text>
          : sessions.map(s => {
            const isExpanded = expandedSession === s.id;
            const detail = sessionDetails[s.id!];
            return (
              <View key={s.id}>
                <TouchableOpacity
                  style={styles.sessionRow}
                  onPress={() => toggleSession(s.id!)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionPlan}>{s.plan_name}</Text>
                    <Text style={styles.sessionDate}>{s.date}</Text>
                  </View>
                  <View style={styles.sessionRight}>
                    {s.total_exp > 0 && <Text style={styles.sessionExp}>+{s.total_exp} EXP</Text>}
                    <Text style={[styles.sessionStatus,
                      { color: s.status === 'completed' ? COLORS.accentGreen : COLORS.textMuted }]}>
                      {s.status.toUpperCase()}
                    </Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>

                {/* Expanded exercise detail */}
                {isExpanded && detail && (
                  <View style={styles.sessionDetail}>
                    {detail.exercises.map((ex: any, i: number) => (
                      <View key={i} style={styles.sessionExRow}>
                        <View style={styles.sessionExDot}>
                          {ex.is_completed
                            ? <Ionicons name="checkmark" size={12} color={COLORS.accentGreen} />
                            : <Ionicons name="ellipse" size={12} color={COLORS.textMuted} />}
                        </View>
                        <Text style={[styles.sessionExName,
                          !ex.is_completed && { color: COLORS.textMuted }]}>
                          {ex.name}
                        </Text>
                        {ex.is_completed && (
                          <Text style={styles.sessionExAmt}>
                            {amountLabel(ex)}  +{ex.exp_reward} EXP
                          </Text>
                        )}
                      </View>
                    ))}
                    <View style={styles.sessionExRow}>
                      <Text style={[styles.sessionExDot, { color: COLORS.accentCyan }]}>Σ</Text>
                      <Text style={[styles.sessionExName, { color: COLORS.textSecondary }]}>Session Total (incl. bonus)</Text>
                      <Text style={[styles.sessionExAmt, { color: COLORS.accentCyan }]}>
                        +{s.total_exp} EXP
                      </Text>
                    </View>
                    {detail.bonuses.length > 0 && (
                      <>
                        <Text style={styles.sessionBonusLabel}>BONUS</Text>
                        {detail.bonuses.map((ex: any, i: number) => (
                          <View key={i} style={styles.sessionExRow}>
                            <View style={styles.sessionExDot}>
                              {ex.is_completed
                                ? <Ionicons name="star" size={12} color={COLORS.accentGold} />
                                : <Ionicons name="star-outline" size={12} color={COLORS.textMuted} />}
                            </View>
                            <Text style={[styles.sessionExName,
                              !ex.is_completed && { color: COLORS.textMuted }]}>
                              {ex.name}
                            </Text>
                            {ex.is_completed && (
                              <Text style={styles.sessionExAmt}>
                                {amountLabel(ex)}  +{ex.exp_reward} EXP
                              </Text>
                            )}
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
      </SystemPanel>

      {/* Reset button */}
      <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
        <Ionicons name="warning" size={16} color={COLORS.accentRed} />
        <Text style={styles.resetBtnText}>Reset All Data & Start Fresh</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:      { padding: 16, paddingBottom: 100 },

  rankBanner:   { backgroundColor: COLORS.bgSecondary, borderWidth: 1.5, borderRadius: 14, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bigRank:      { fontSize: 76, fontWeight: '900', letterSpacing: -2, marginRight: 16, opacity: 0.9 },
  bannerRight:  { flex: 1 },
  bannerName:   { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 3 },
  bannerRankLbl:{ fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  bannerTitle:  { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 5 },
  bannerLevel:  { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  expHint:      { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6 },

  achieveRow:   { flexDirection: 'row', gap: 10 },
  achieveBox:   { flex: 1, alignItems: 'center', backgroundColor: COLORS.bgTertiary, borderRadius: 8, paddingVertical: 14 },
  achieveVal:   { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  achieveLbl:   { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },

  noData:       { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },

  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim, gap: 8 },
  titleLeft:    { flex: 1 },
  titleName:    { color: COLORS.accentGold, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  titleDesc:    { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  titleDate:    { color: COLORS.textMuted, fontSize: 11 },

  sessionRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim },
  sessionInfo:  { flex: 1 },
  sessionPlan:  { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  sessionDate:  { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  sessionRight: { alignItems: 'flex-end', gap: 2 },
  sessionExp:   { color: COLORS.accentCyan, fontSize: 12, fontWeight: '700' },
  sessionStatus:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  sessionDetail:      { backgroundColor: COLORS.bgTertiary, borderRadius: 8, padding: 10, marginBottom: 6, marginTop: -4 },
  sessionExRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  sessionExDot:       { width: 16, alignItems: 'center' },
  sessionExName:      { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
  sessionExAmt:       { color: COLORS.accentCyan, fontSize: 11, fontWeight: '600' },
  sessionBonusLabel:  { color: COLORS.accentGold, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 6, marginBottom: 2 },

  resetBtn: {
    marginTop: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.accentRed,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  resetBtnText: {
    color: COLORS.accentRed,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ProfileScreen;
