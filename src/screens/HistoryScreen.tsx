/**
 * src/screens/HistoryScreen.tsx
 * =============================
 * Full session history — every quest ever run, grouped by month with a
 * sticky section header. Reachable from the Profile tab ("View All").
 *
 * Owns only read paths: sessions come from getAllSessions, per-row detail
 * from getSessionSummary on expand (same pattern as Profile's recent list).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, SectionList, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session, getAllSessions, getSessionSummary, LifetimeStats, getLifetimeStats } from '../database/Database';
import WorkoutRow from '../components/WorkoutRow';
import { SectionHeader, EmptyState } from '../components/UIComponents';
import { COLORS } from '../constants/game';
import { computeStreaks } from '../utils/stats';
import { fmtShortDate } from '../utils/dates';

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'skipped' | 'pending';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'completed',   label: 'Completed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'pending',     label: 'Pending' },
  { key: 'skipped',     label: 'Skipped' },
];

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface MonthSection {
  title: string;
  data: Session[];
}

const monthKey = (date: string): { key: string; title: string } => {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? '');
  if (!m) return { key: 'other', title: 'Other' };
  const y = m[1];
  const mo = MONTHS_LONG[Number(m[2]) - 1] ?? m[2];
  return { key: `${y}-${m[2]}`, title: `${mo} ${y}` };
};

const buildSections = (sessions: Session[]): MonthSection[] => {
  const out: MonthSection[] = [];
  let current: MonthSection | null = null;
  let currentKey = '';
  for (const s of sessions) {
    const { key, title } = monthKey(s.date);
    if (key !== currentKey || !current) {
      current = { title, data: [] };
      currentKey = key;
      out.push(current);
    }
    current.data.push(s);
  }
  return out;
};

const STATUS_COLOR: Record<string, string> = {
  completed: COLORS.accentGreen,
  in_progress: COLORS.accentCyan,
  skipped: COLORS.textMuted,
  pending: COLORS.accentGold,
};

const HistoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [lifetime, setLifetime] = useState<LifetimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, any>>({});

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const [s, life] = await Promise.all([getAllSessions(), getLifetimeStats()]);
        if (!alive) return;
        setSessions(s);
        setLifetime(life);
      } catch (e) {
        console.error('load history error:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  const shown = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  const sections = buildSections(shown);
  const streaks = lifetime ? computeStreaks(lifetime.completedDates) : null;

  const toggleRow = async (sessionId: number) => {
    if (expanded === sessionId) { setExpanded(null); return; }
    setExpanded(sessionId);
    if (!details[sessionId]) {
      try {
        const detail = await getSessionSummary(sessionId);
        setDetails(prev => ({ ...prev, [sessionId]: detail }));
      } catch (e) {
        console.error('load session summary error:', e);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator size="large" color={COLORS.accentCyan} />
      </View>
    );
  }

  return (
    <SectionList
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
      sections={sections}
      keyExtractor={item => String(item.id)}
      stickySectionHeadersEnabled
      ListHeaderComponent={
        <View>
          {streaks && (
            <View style={styles.streakRow}>
              <View style={styles.streakBox}>
                <Text style={[styles.streakVal, { color: COLORS.accentGreen }]}>{streaks.current}d</Text>
                <Text style={styles.streakLbl}>Current Streak</Text>
              </View>
              <View style={styles.streakBox}>
                <Text style={[styles.streakVal, { color: COLORS.accentGold }]}>{streaks.best}d</Text>
                <Text style={styles.streakLbl}>Best Streak</Text>
              </View>
              <View style={styles.streakBox}>
                <Text style={[styles.streakVal, { color: COLORS.accentCyan }]}>{lifetime?.completedDates.length ?? 0}</Text>
                <Text style={styles.streakLbl}>Training Days</Text>
              </View>
            </View>
          )}

          <SectionHeader title="Quest Log" subtitle={`${shown.length} session${shown.length === 1 ? '' : 's'}`} />

          <View style={styles.filterRow}>
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <Text
                  key={f.key}
                  style={[styles.filterChip, active && styles.filterChipOn]}
                  onPress={() => { setFilter(f.key); setExpanded(null); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter ${f.label}`}
                  accessibilityState={{ selected: active }}
                >
                  {f.label}
                </Text>
              );
            })}
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.monthHdr}>
          <Text style={styles.monthTxt}>{section.title}</Text>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="time-outline"
          title="No sessions yet"
          subtitle="Finish a quest and it will show up here."
        />
      }
      renderItem={({ item }) => {
        const isExpanded = expanded === item.id;
        const detail = details[item.id!];
        const statusColor = STATUS_COLOR[item.status] ?? COLORS.textMuted;
        return (
          <View>
            <WorkoutRow
              title={item.plan_name}
              meta={fmtShortDate(item.date)}
              metaAccessory={
                <Text style={[styles.status, { color: statusColor }]}>
                  {item.status.replace('_', ' ').toUpperCase()}
                </Text>
              }
              accent={statusColor}
              exp={item.total_exp > 0 ? `+${item.total_exp} EXP` : undefined}
              badgeColor={statusColor}
              onPress={() => toggleRow(item.id!)}
              trailing={
                <Text style={styles.chevron}>{isExpanded ? '▾' : '▸'}</Text>
              }
            />
            {isExpanded && detail && (
              <View style={styles.detail}>
                {detail.exercises.map((ex: any, i: number) => (
                  <View key={i} style={styles.detailRow}>
                    <Text
                      style={[styles.detailName, !ex.is_completed && styles.detailMuted]}
                      numberOfLines={1}
                    >
                      {ex.name}
                    </Text>
                    <Text style={[styles.detailAmt, !ex.is_completed && styles.detailMuted]}>
                      {ex.is_completed ? `+${ex.exp_reward} EXP` : '—'}
                    </Text>
                  </View>
                ))}
                {detail.bonuses.length > 0 && (
                  <Text style={styles.bonusLbl}>BONUS</Text>
                )}
                {detail.bonuses.map((ex: any, i: number) => (
                  <View key={i} style={styles.detailRow}>
                    <Text
                      style={[styles.detailName, styles.bonusName, !ex.is_completed && styles.detailMuted]}
                      numberOfLines={1}
                    >
                      {ex.name}
                    </Text>
                    <Text style={[styles.detailAmt, styles.bonusName, !ex.is_completed && styles.detailMuted]}>
                      {ex.is_completed ? `+${ex.exp_reward} EXP` : '—'}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLbl}>Session Total</Text>
                  <Text style={styles.totalVal}>+{item.total_exp} EXP</Text>
                </View>
              </View>
            )}
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bgPrimary },
  loadRoot:    { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },
  content:     { padding: 16 },

  streakRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  streakBox:   { flex: 1, alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, paddingVertical: 12 },
  streakVal:   { fontSize: 20, fontWeight: '800', marginBottom: 3 },
  streakLbl:   { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },

  filterRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterChip:  { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  filterChipOn:{ color: COLORS.bgPrimary, backgroundColor: COLORS.accentCyan, borderColor: COLORS.accentCyan },

  monthHdr:    { backgroundColor: COLORS.bgPrimary, paddingVertical: 10, marginTop: 8 },
  monthTxt:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },

  status:      { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  chevron:     { color: COLORS.textMuted, fontSize: 14 },

  detail:      { backgroundColor: COLORS.bgTertiary, borderRadius: 8, padding: 10, marginTop: -4, marginBottom: 6, gap: 4 },
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailName:  { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
  detailAmt:   { color: COLORS.accentGreen, fontSize: 12, fontWeight: '700' },
  detailMuted: { color: COLORS.textMuted },
  bonusLbl:    { color: COLORS.accentGold, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 6 },
  bonusName:   { color: COLORS.accentGold },
  totalRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.borderMain, marginTop: 6, paddingTop: 6 },
  totalLbl:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  totalVal:    { color: COLORS.accentCyan, fontSize: 13, fontWeight: '800' },
});

export default HistoryScreen;
