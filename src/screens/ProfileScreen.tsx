/**
 * src/screens/ProfileScreen.tsx
 * ===============================
 * Full player profile: rank banner, all stats, earned titles, session history.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPlayer, Player, getTitles, EarnedTitle, getRecentSessions, Session, getSessionSummary, resetAllData, getMartialArts, MartialArt } from '../database/Database';
import { SystemPanel, SectionHeader, StatRow, ExpBar, IonName } from '../components/UIComponents';
import WorkoutRow, { ExpBadge } from '../components/WorkoutRow';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getRankForLevel, getBeltForLevel, STATS, parseUnitValues, formatUnitValues } from '../constants/game';
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
  const [arts,     setArts]     = useState<MartialArt[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<number, any>>({});

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    const [p, t, s, a] = await Promise.all([getPlayer(), getTitles(), getRecentSessions(15), getMartialArts()]);
    setPlayer(p);
    setTitles(t);
    setSessions(s);
    setArts(a);
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
  const skillCount = arts.reduce((n, a) => n + (a.skill_count ?? 0), 0);

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

      {/* Dojo */}
      <SystemPanel>
        <SectionHeader
          title="Dojo"
          subtitle={arts.length > 0
            ? `${arts.length} art${arts.length === 1 ? '' : 's'} · ${skillCount} skill${skillCount === 1 ? '' : 's'}`
            : 'Martial proficiency'}
        />
        {arts.length === 0 ? (
          <Text style={styles.noData}>No martial arts yet. Start one in the Dojo tab.</Text>
        ) : (
          arts.map(art => {
            const belt = getBeltForLevel(art.level);
            return (
              <StatRow
                key={art.id}
                icon={art.icon as IonName}
                label={art.name}
                value={art.level}
                valueText={belt.belt}
                color={belt.color}
                showBar
                progress={art.exp / (art.exp_to_next || 1)}
              />
            );
          })
        )}
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
                <WorkoutRow
                  title={s.plan_name}
                  meta={s.date}
                  metaAccessory={
                    <Text style={[styles.sessionStatus, { color: s.status === 'completed' ? COLORS.accentGreen : COLORS.textMuted }]}>
                      {s.status.toUpperCase()}
                    </Text>
                  }
                  accent={s.status === 'completed' ? COLORS.accentGreen : s.status === 'in_progress' ? COLORS.accentCyan : COLORS.borderMain}
                  exp={s.total_exp > 0 ? `+${s.total_exp} EXP` : undefined}
                  badgeColor={s.status === 'completed' ? COLORS.accentGreen : COLORS.accentCyan}
                  onPress={() => toggleSession(s.id!)}
                  trailing={
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
                  }
                />

                {/* Expanded exercise detail */}
                {isExpanded && detail && (
                  <View style={styles.sessionDetail}>
                    {detail.exercises.map((ex: any, i: number) => (
                      <WorkoutRow
                        key={i}
                        state={ex.is_completed ? 'done' : 'pending'}
                        title={ex.name}
                        meta={ex.is_completed ? amountLabel(ex) : 'Not completed'}
                        accent={COLORS.accentGreen}
                        exp={ex.is_completed ? `+${ex.exp_reward} EXP` : undefined}
                        badgeColor={COLORS.accentGreen}
                        leading={
                          <View style={styles.sessionExDot}>
                            {ex.is_completed
                              ? <Ionicons name="checkmark" size={12} color={COLORS.accentGreen} />
                              : <Ionicons name="ellipse" size={12} color={COLORS.textMuted} />}
                          </View>
                        }
                      />
                    ))}
                    <View style={styles.sessionExRow}>
                      <Text style={[styles.sessionExDot, { color: COLORS.accentCyan }]}>Σ</Text>
                      <Text style={[styles.sessionExName, { color: COLORS.textSecondary }]}>Session Total (incl. bonus)</Text>
                      <ExpBadge text={`+${s.total_exp} EXP`} color={COLORS.accentCyan} />
                    </View>
                    {detail.bonuses.length > 0 && (
                      <>
                        <Text style={styles.sessionBonusLabel}>BONUS</Text>
                        {detail.bonuses.map((ex: any, i: number) => (
                          <WorkoutRow
                            key={i}
                            state={ex.is_completed ? 'done' : 'pending'}
                            title={ex.name}
                            meta={ex.is_completed ? amountLabel(ex) : 'Not completed'}
                            accent={COLORS.accentGold}
                            exp={ex.is_completed ? `+${ex.exp_reward} EXP` : undefined}
                            badgeColor={COLORS.accentGold}
                            leading={
                              <View style={styles.sessionExDot}>
                                {ex.is_completed
                                  ? <Ionicons name="star" size={12} color={COLORS.accentGold} />
                                  : <Ionicons name="star-outline" size={12} color={COLORS.textMuted} />}
                              </View>
                            }
                          />
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

  sessionStatus:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  sessionDetail:      { backgroundColor: COLORS.bgTertiary, borderRadius: 8, padding: 10, marginBottom: 6, marginTop: -4 },
  sessionExRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  sessionExDot:       { width: 16, alignItems: 'center' },
  sessionExName:      { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
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
