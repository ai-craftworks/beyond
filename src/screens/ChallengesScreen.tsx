/**
 * src/screens/ChallengesScreen.tsx
 * =================================
 * Personal challenges: a date window plus per-workout volume goals, scored
 * from the workouts already logged in the quest log. Reached from the sidebar.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getAllChallengeGoals, getChallengeActivity, getChallenges,
  type Challenge, type ChallengeGoal,
} from '../database/Database';
import { EmptyState, SegmentedTabs, SystemButton, SystemPanel } from '../components/UIComponents';
import ActionBar from '../components/ActionBar';
import ChallengeFormModal from '../components/ChallengeFormModal';
import { COLORS } from '../constants/game';
import {
  buildChallengeProgress, challengeCountdown, CHALLENGE_STATUS_META, type ChallengeProgress,
} from '../utils/challenges';
import { fmtShortDate, todayDateStr } from '../utils/dates';
import type { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'active' | 'upcoming' | 'finished';

interface Row {
  challenge: Challenge;
  progress: ChallengeProgress;
}

const ChallengesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    const [challenges, goals] = await Promise.all([getChallenges(), getAllChallengeGoals()]);
    if (challenges.length === 0) {
      setRows([]);
      return;
    }
    const from = challenges.reduce((min, c) => (c.start_date < min ? c.start_date : min), challenges[0].start_date);
    const to = challenges.reduce((max, c) => (c.end_date > max ? c.end_date : max), challenges[0].end_date);
    const activity = await getChallengeActivity(from, to);

    const goalsBy = new Map<number, ChallengeGoal[]>();
    for (const g of goals) {
      const list = goalsBy.get(g.challenge_id) ?? [];
      list.push(g);
      goalsBy.set(g.challenge_id, list);
    }

    const today = todayDateStr();
    setRows(challenges.map(challenge => ({
      challenge,
      progress: buildChallengeProgress(
        challenge,
        goalsBy.get(challenge.id!) ?? [],
        activity,
        today
      ),
    })));
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const counts = useMemo(() => ({
    active:   rows.filter(r => r.progress.status === 'active').length,
    upcoming: rows.filter(r => r.progress.status === 'upcoming').length,
    success:  rows.filter(r => r.progress.status === 'success').length,
    failed:   rows.filter(r => r.progress.status === 'failed').length,
  }), [rows]);

  const filtered = useMemo(() => {
    const matches = (status: ChallengeProgress['status']) =>
      tab === 'active' ? status === 'active'
        : tab === 'upcoming' ? status === 'upcoming'
          : status === 'success' || status === 'failed';

    return rows
      .filter(r => matches(r.progress.status))
      .sort((a, b) => {
        if (tab === 'upcoming') return a.challenge.start_date.localeCompare(b.challenge.start_date);
        if (tab === 'finished') return b.challenge.end_date.localeCompare(a.challenge.end_date);
        return a.challenge.end_date.localeCompare(b.challenge.end_date);
      });
  }, [rows, tab]);

  const emptyCopy = {
    active:   { title: 'No active challenges', subtitle: 'Create one and set the workouts you need to beat.' },
    upcoming: { title: 'Nothing on the horizon', subtitle: 'Schedule a challenge with a future start date.' },
    finished: { title: 'No finished challenges', subtitle: 'Cleared and failed trials will appear here.' },
  }[tab];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>CHALLENGES</Text>
          <Text style={styles.heroSub}>Set a goal. Beat the clock.</Text>
        </View>

        <SystemPanel>
          <View style={styles.statsRow}>
            <StatCell label="ACTIVE" value={counts.active} color={COLORS.accentCyan} />
            <View style={styles.statDivider} />
            <StatCell label="SUCCESS" value={counts.success} color={COLORS.accentGreen} />
            <View style={styles.statDivider} />
            <StatCell label="FAILED" value={counts.failed} color={COLORS.accentRed} />
          </View>
        </SystemPanel>

        <SegmentedTabs
          tabs={[
            { key: 'active', label: counts.active > 0 ? `Active · ${counts.active}` : 'Active' },
            { key: 'upcoming', label: counts.upcoming > 0 ? `Upcoming · ${counts.upcoming}` : 'Upcoming' },
            { key: 'finished', label: counts.success + counts.failed > 0 ? `Finished · ${counts.success + counts.failed}` : 'Finished' },
          ]}
          value={tab}
          onChange={k => setTab(k as Tab)}
        />

        {filtered.length === 0 ? (
          <EmptyState icon="trophy-outline" title={emptyCopy.title} subtitle={emptyCopy.subtitle} />
        ) : (
          filtered.map(({ challenge, progress }) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              progress={progress}
              onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id! })}
            />
          ))
        )}
      </ScrollView>

      <ActionBar
        stacked
        style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}
        label={counts.active > 0 ? `${counts.active} ACTIVE` : 'NO ACTIVE CHALLENGES'}
        hint="Progress updates from every logged quest"
      >
        <SystemButton
          title="New Challenge"
          icon="add"
          style={styles.barBtn}
          textStyle={styles.barBtnTxt}
          onPress={() => setCreateOpen(true)}
        />
      </ActionBar>

      <ChallengeFormModal
        visible={createOpen}
        challenge={null}
        onClose={() => setCreateOpen(false)}
        onSaved={id => navigation.navigate('ChallengeDetail', { challengeId: id })}
      />
    </View>
  );
};

const StatCell: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const countdownLabel = (challenge: Challenge, progress: ChallengeProgress): string =>
  challengeCountdown(challenge, progress, todayDateStr());

const ChallengeCard: React.FC<{
  challenge: Challenge;
  progress: ChallengeProgress;
  onPress: () => void;
}> = ({ challenge, progress, onPress }) => {
  const meta = CHALLENGE_STATUS_META[progress.status];
  const pct = Math.round(progress.overallPercent);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: meta.color }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{challenge.name}</Text>
        <View style={[styles.statusPill, { borderColor: meta.color }]}>
          <Text style={[styles.statusTxt, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <Text style={styles.cardDates}>
        {fmtShortDate(challenge.start_date)} — {fmtShortDate(challenge.end_date)}
      </Text>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.cardGoals}>
          {progress.goalsMet}/{progress.goalsTotal} goal{progress.goalsTotal === 1 ? '' : 's'} · {pct}%
        </Text>
        <Text style={[styles.cardTime, progress.status === 'failed' && { color: COLORS.accentRed }]}>
          {countdownLabel(challenge, progress)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16 },

  hero:      { backgroundColor: COLORS.bgSecondary, borderWidth: 1.5, borderColor: COLORS.borderMain, borderRadius: 14, padding: 18, marginBottom: 14, alignItems: 'center' },
  heroTitle: { color: COLORS.accentCyan, fontSize: 15, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  heroSub:   { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },

  statsRow:     { flexDirection: 'row', alignItems: 'center' },
  statCell:     { flex: 1, alignItems: 'center' },
  statValue:    { fontSize: 22, fontWeight: '800' },
  statLabel:    { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 3 },
  statDivider:  { width: 1, height: 30, backgroundColor: COLORS.borderDim },

  card:         { backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderLeftWidth: 3, borderRadius: 10, padding: 14, marginBottom: 10 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName:     { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  statusPill:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt:    { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  cardDates:    { color: COLORS.textMuted, fontSize: 11, marginTop: 4, marginBottom: 11 },

  barTrack:     { height: 6, backgroundColor: COLORS.bgTertiary, borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },

  cardBottom:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, gap: 10 },
  cardGoals:    { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  cardTime:     { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  actionBar:    { paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.borderMain },
  barBtn:       { flex: 1 },
  barBtnTxt:    { fontSize: 13, letterSpacing: 1 },
});

export default ChallengesScreen;
