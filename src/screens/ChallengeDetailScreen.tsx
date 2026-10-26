/**
 * src/screens/ChallengeDetailScreen.tsx
 * ======================================
 * One challenge: window, verdict, and per-workout goals with live volume,
 * extra/pending amounts, and a required daily pace while the window is open.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  deleteChallengeGoal, getChallenge, getChallengeActivity, getChallengeGoals,
  type Challenge, type ChallengeGoal,
} from '../database/Database';
import {
  EmptyState, SectionHeader, SystemButton, SystemPanel,
} from '../components/UIComponents';
import ActionBar from '../components/ActionBar';
import ChallengeFormModal from '../components/ChallengeFormModal';
import AddChallengeGoalModal from '../components/AddChallengeGoalModal';
import { COLORS, unitSuffix } from '../constants/game';
import {
  buildChallengeProgress, challengeCountdown, CHALLENGE_STATUS_META, fmtQty,
  type ChallengeProgress, type GoalProgress,
} from '../utils/challenges';
import { fmtShortDate, todayDateStr } from '../utils/dates';
import { hapticWarning } from '../utils/haptics';
import type { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ChallengeDetail'>;

const ChallengeDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const [loaded, setLoaded]       = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [goals, setGoals]         = useState<ChallengeGoal[]>([]);
  const [progress, setProgress]   = useState<ChallengeProgress | null>(null);
  const [editOpen, setEditOpen]   = useState(false);
  const [goalOpen, setGoalOpen]   = useState(false);
  const [editGoal, setEditGoal]   = useState<ChallengeGoal | null>(null);

  const load = async () => {
    const id = route.params.challengeId;
    const ch = await getChallenge(id);
    if (!ch) {
      setLoaded(true);
      navigation.goBack();
      return;
    }
    const [gs, activity] = await Promise.all([
      getChallengeGoals(id),
      getChallengeActivity(ch.start_date, ch.end_date),
    ]);
    setChallenge(ch);
    setGoals(gs);
    setProgress(buildChallengeProgress(ch, gs, activity, todayDateStr()));
    setLoaded(true);
  };

  useFocusEffect(useCallback(() => { load(); }, [route.params.challengeId]));

  useEffect(() => {
    if (challenge) navigation.setOptions({ title: challenge.name });
  }, [challenge, navigation]);

  const confirmDeleteGoal = (goal: ChallengeGoal) => {
    hapticWarning();
    Alert.alert('Remove Goal?', `Stop tracking "${goal.exercise_name}" for this challenge.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChallengeGoal(goal.id!);
            await load();
          } catch (e) {
            console.error('delete challenge goal error:', e);
            Alert.alert('Error', 'Could not remove the goal.');
          }
        },
      },
    ]);
  };

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  if (!challenge || !progress) return <View style={styles.root} />;

  const meta = CHALLENGE_STATUS_META[progress.status];
  const pct = Math.round(progress.overallPercent);
  const editable = !progress.ended;
  const showResult = progress.ended || progress.status === 'success';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { borderColor: `${meta.color}66` }]}>
          <View style={styles.heroTop}>
            <View style={[styles.statusPill, { borderColor: meta.color }]}>
              <Text style={[styles.statusTxt, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.heroTime}>{challengeCountdown(challenge, progress, todayDateStr())}</Text>
          </View>

          <Text style={styles.heroTitle}>{challenge.name}</Text>
          {!!challenge.description && <Text style={styles.heroDesc}>{challenge.description}</Text>}
          <Text style={styles.heroDates}>
            {fmtShortDate(challenge.start_date)} — {fmtShortDate(challenge.end_date)}
          </Text>

          <View style={styles.heroBarTrack}>
            <View style={[styles.heroBarFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
          </View>

          <View style={styles.heroStats}>
            <HeroStat value={`${progress.goalsMet}/${progress.goalsTotal}`} label="GOALS" />
            <View style={styles.heroDivider} />
            <HeroStat value={`${pct}%`} label="COMPLETE" color={meta.color} />
            <View style={styles.heroDivider} />
            <HeroStat value={String(progress.daysTrained)} label="TRAINING DAYS" />
          </View>
        </View>

        {showResult && (
          <SystemPanel glow={progress.status === 'success'}>
            <SectionHeader
              title="Result"
              subtitle={`${progress.goalsMet} of ${progress.goalsTotal} goals · ${progress.daysTrained} training day${progress.daysTrained === 1 ? '' : 's'}`}
            />
            <Text style={[styles.verdict, { color: meta.color }]}>
              {progress.status === 'success' ? 'CHALLENGE CLEARED' : 'CHALLENGE FAILED'}
            </Text>
            <Text style={styles.verdictSub}>
              {progress.status === 'success'
                ? 'Every goal was met before the window closed.'
                : `${progress.goalsTotal - progress.goalsMet} goal${progress.goalsTotal - progress.goalsMet === 1 ? '' : 's'} fell short at the deadline.`}
            </Text>
            {progress.goals.map(gp => {
              const g = gp.goal as ChallengeGoal;
              return (
                <View key={gp.goal.id ?? g.exercise_id} style={styles.resultRow}>
                  <Text style={styles.resultName} numberOfLines={1}>{g.exercise_name}</Text>
                  <Text style={[styles.resultVal, { color: gp.met ? COLORS.accentGreen : COLORS.accentRed }]}>
                    {gp.met
                      ? (gp.over > 0
                        ? `+${fmtQty(gp.over)} ${unitSuffix(g.unit_type)} extra`
                        : 'Exactly on target')
                      : `${fmtQty(gp.remaining)} ${unitSuffix(g.unit_type)} short`}
                  </Text>
                </View>
              );
            })}
          </SystemPanel>
        )}

        <SectionHeader
          title="Goals"
          subtitle={goals.length === 0
            ? 'Add workouts to start tracking'
            : editable ? `${goals.length} tracked · tap a goal to edit` : `${goals.length} tracked`}
        />

        {goals.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="No goals yet"
            subtitle={editable
              ? 'Add a workout and a target to begin this challenge.'
              : 'This challenge ended without any goals.'}
          />
        ) : (
          progress.goals.map(gp => (
            <GoalCard
              key={gp.goal.id ?? `${gp.goal.exercise_id}-${gp.goal.unit_type}`}
              gp={gp}
              editable={editable}
              daysLeft={progress.daysLeft}
              active={progress.status === 'active'}
              onEdit={() => {
                const g = goals.find(x => x.id === gp.goal.id);
                if (!g) return;
                setEditGoal(g);
                setGoalOpen(true);
              }}
              onDelete={() => {
                const g = goals.find(x => x.id === gp.goal.id);
                if (g) confirmDeleteGoal(g);
              }}
            />
          ))
        )}
      </ScrollView>

      <ActionBar
        stacked
        style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}
        label={`${progress.goalsMet}/${progress.goalsTotal} GOALS`}
        hint={challengeCountdown(challenge, progress, todayDateStr())}
        secondary={{ label: 'Edit', onPress: () => setEditOpen(true) }}
      >
        {editable && (
          <SystemButton
            title="Add Goal"
            icon="add"
            style={styles.barBtn}
            textStyle={styles.barBtnTxt}
            onPress={() => { setEditGoal(null); setGoalOpen(true); }}
          />
        )}
      </ActionBar>

      <ChallengeFormModal
        visible={editOpen}
        challenge={challenge}
        lockDates={progress.ended}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); load(); }}
        onDeleted={() => navigation.goBack()}
      />

      <AddChallengeGoalModal
        visible={goalOpen}
        challenge={challenge}
        goals={goals}
        goal={editGoal}
        onClose={() => { setGoalOpen(false); setEditGoal(null); }}
        onSaved={() => { setGoalOpen(false); setEditGoal(null); load(); }}
      />
    </View>
  );
};

const HeroStat: React.FC<{ value: string; label: string; color?: string }> = ({ value, label, color }) => (
  <View style={styles.heroStat}>
    <Text style={[styles.heroStatValue, color ? { color } : null]}>{value}</Text>
    <Text style={styles.heroStatLabel}>{label}</Text>
  </View>
);

const GoalCard: React.FC<{
  gp: GoalProgress;
  editable: boolean;
  active: boolean;
  daysLeft: number;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ gp, editable, active, daysLeft, onEdit, onDelete }) => {
  const goal = gp.goal as ChallengeGoal;
  const color = gp.met ? COLORS.accentGreen : COLORS.accentCyan;
  const pace = active && !gp.met
    ? Math.ceil(gp.remaining / Math.max(1, daysLeft + 1))
    : null;

  return (
    <TouchableOpacity
      style={styles.goalCard}
      activeOpacity={editable ? 0.8 : 1}
      disabled={!editable}
      onPress={onEdit}
    >
      <View style={styles.goalTop}>
        <Text style={styles.goalName} numberOfLines={1}>{goal.exercise_name}</Text>
        <Text style={[styles.goalPct, { color }]}>{Math.round(gp.percent)}%</Text>
        {editable && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.goalVals}>
        {fmtQty(gp.achieved)} / {fmtQty(goal.target)} {unitSuffix(goal.unit_type)}
        {goal.exercise_exists === 0 ? '  ·  workout removed from library' : ''}
      </Text>

      <View style={styles.goalBarTrack}>
        <View style={[styles.goalBarFill, { width: `${Math.round(gp.percent)}%`, backgroundColor: color }]} />
      </View>

      <View style={styles.goalBottom}>
        <Text style={[styles.goalDelta, { color: gp.met ? COLORS.accentGreen : COLORS.accentGold }]}>
          {gp.met
            ? (gp.over > 0 ? `+${fmtQty(gp.over)} ${unitSuffix(goal.unit_type)} extra` : 'Goal met')
            : `${fmtQty(gp.remaining)} ${unitSuffix(goal.unit_type)} to go`}
        </Text>
        {pace !== null && (
          <Text style={styles.goalPace}>≈ {fmtQty(pace)} / day</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16 },
  loading: { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },

  hero:      { backgroundColor: COLORS.bgSecondary, borderWidth: 1.5, borderRadius: 14, padding: 18, marginBottom: 14 },
  heroTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  statusPill:{ borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  heroTime:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  heroTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  heroDesc:  { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroDates: { color: COLORS.textMuted, fontSize: 11, marginTop: 8, marginBottom: 12 },

  heroBarTrack: { height: 8, backgroundColor: COLORS.bgTertiary, borderRadius: 4, overflow: 'hidden' },
  heroBarFill:  { height: '100%', borderRadius: 4 },

  heroStats:     { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  heroStat:      { flex: 1, alignItems: 'center' },
  heroStatValue: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
  heroStatLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 3, textAlign: 'center' },
  heroDivider:   { width: 1, height: 26, backgroundColor: COLORS.borderDim },

  verdict:    { color: COLORS.accentGreen, fontSize: 16, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  verdictSub: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 },
  resultRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, gap: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDim },
  resultName: { flex: 1, color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
  resultVal:  { fontSize: 11, fontWeight: '700' },

  goalCard:     { backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 13, marginBottom: 9 },
  goalTop:      { flexDirection: 'row', alignItems: 'center', gap: 9 },
  goalName:     { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  goalPct:      { fontSize: 12, fontWeight: '800' },
  goalVals:     { color: COLORS.textMuted, fontSize: 11, marginTop: 3, marginBottom: 9 },
  goalBarTrack: { height: 5, backgroundColor: COLORS.bgTertiary, borderRadius: 3, overflow: 'hidden' },
  goalBarFill:  { height: '100%', borderRadius: 3 },
  goalBottom:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 10 },
  goalDelta:    { fontSize: 11, fontWeight: '700' },
  goalPace:     { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },

  actionBar:  { paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.borderMain },
  barBtn:     { flex: 1 },
  barBtnTxt:  { fontSize: 13, letterSpacing: 1 },
});

export default ChallengeDetailScreen;
