/**
 * src/screens/SessionScreen.tsx
 * ==============================
 * The active workout session — the core gameplay loop.
 * Check off exercises, earn EXP, complete session, level up.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getSessionExercises, getPlayer, updatePlayer,
  updateSession, completeSessionExercise,
  SessionExercise, Player, saveTitle,
} from '../database/Database';
import { SystemPanel, SystemButton, ExpBar } from '../components/UIComponents';
import LevelUpModal from '../components/LevelUpModal';
import { COLORS, expRequiredForLevel, TITLE_CONDITIONS } from '../constants/game';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'Session'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'Session'>;

const SessionScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { sessionId } = route.params;

  const [exercises, setExercises]   = useState<SessionExercise[]>([]);
  const [player, setPlayer]         = useState<Player | null>(null);
  const [loading, setLoading]       = useState(true);
  const [finishing, setFinishing]   = useState(false);
  const [levelUpVisible, setLvlUp]  = useState(false);
  const [newTitle, setNewTitle]     = useState<string | undefined>();
  const [expGained, setExpGained]   = useState(0);

  // EXP flash overlay animation
  const flashAnim  = useRef(new Animated.Value(0)).current;
  const flashScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => { loadSession(); }, []);

  const loadSession = async () => {
    setLoading(true);
    const [exs, p] = await Promise.all([getSessionExercises(sessionId), getPlayer()]);
    setExercises(exs);
    setPlayer(p);
    setLoading(false);
    // Mark session in_progress
    await updateSession(sessionId, { status: 'in_progress', started_at: new Date().toISOString() });
  };

  const triggerFlash = () => {
    flashAnim.setValue(1);
    flashScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(flashAnim,  { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.spring(flashScale, { toValue: 1, friction: 4,   useNativeDriver: true }),
    ]).start();
  };

  const handleCompleteExercise = async (ex: SessionExercise) => {
    if (ex.is_completed) return;
    // Optimistic UI update
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, is_completed: 1 } : e));
    setExpGained(prev => prev + ex.exp_reward);
    triggerFlash();
    await completeSessionExercise(ex.id!);
  };

  const handleFinishSession = async () => {
    const done = exercises.filter(e => e.is_completed);
    if (done.length === 0) {
      Alert.alert('System', 'Complete at least one exercise first, Hunter.');
      return;
    }

    setFinishing(true);
    try {
      const p = await getPlayer();
      if (!p) return;

      // ── EXP calculation ──
      let totalExp = done.reduce((sum, e) => sum + e.exp_reward, 0);
      const allDone = done.length === exercises.length;
      if (allDone) totalExp = Math.floor(totalExp * 1.1); // 10% full-clear bonus

      // ── Stat gains from completed exercises ──
      const statDeltas: Record<string, number> = {};
      for (const ex of done) {
        const key = ex.stat_type;
        statDeltas[key] = (statDeltas[key] ?? 0) + ex.stat_reward;
      }

      // ── Level calculation ──
      const newTotalExp = p.total_exp + totalExp;
      let level     = 1;
      let remaining = newTotalExp;
      while (level < 100) {
        const needed = expRequiredForLevel(level);
        if (remaining < needed) break;
        remaining -= needed;
        level++;
      }
      const levelled = level > p.level;

      // ── Build player update ──
      const updates: Partial<Player> = {
        level,
        exp:       remaining,
        exp_to_next: expRequiredForLevel(level),
        total_exp: newTotalExp,
        strength:     Math.min((p.strength     + (statDeltas['strength']     ?? 0)), 9999),
        agility:      Math.min((p.agility      + (statDeltas['agility']      ?? 0)), 9999),
        endurance:    Math.min((p.endurance    + (statDeltas['endurance']    ?? 0)), 9999),
        intelligence: Math.min((p.intelligence + (statDeltas['intelligence'] ?? 0)), 9999),
        vitality:     Math.min((p.vitality     + (statDeltas['vitality']     ?? 0)), 9999),
      };

      // ── Title checks ──
      const snap = { level, strength: updates.strength!, agility: updates.agility!, endurance: updates.endurance!, intelligence: updates.intelligence!, vitality: updates.vitality! };
      let awardedTitle: string | undefined;
      for (const cond of TITLE_CONDITIONS) {
        if (cond.check(snap)) {
          const isNew = await saveTitle(cond.title, cond.description);
          if (isNew && !awardedTitle) {
            awardedTitle = cond.title;
            updates.title = cond.title;
          }
        }
      }

      // ── Persist ──
      await updatePlayer(updates);
      await updateSession(sessionId, {
        status: 'completed',
        total_exp: totalExp,
        completed_at: new Date().toISOString(),
      });

      setPlayer({ ...p, ...updates } as Player);
      setNewTitle(awardedTitle);

      if (levelled) {
        setLvlUp(true);
      } else {
        navigation.goBack();
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong completing the session.');
    } finally {
      setFinishing(false);
    }
  };

  if (loading || !player) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
        <Text style={styles.loadTxt}>Loading quest...</Text>
      </View>
    );
  }

  const completedCount = exercises.filter(e => e.is_completed).length;
  const progressPct    = exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0;

  return (
    <View style={styles.root}>
      {/* EXP gain flash */}
      <Animated.View style={[styles.flash, { opacity: flashAnim }]} pointerEvents="none">
        <Animated.Text style={[styles.flashTxt, { transform: [{ scale: flashScale }] }]}>
          +EXP
        </Animated.Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Session header */}
        <View style={styles.sessionHdr}>
          <Text style={styles.sessionTag}>◆ DAILY QUEST</Text>
          <Text style={styles.sessionProgress}>{completedCount} / {exercises.length}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
        </View>

        {/* Player EXP panel */}
        <SystemPanel style={styles.playerPanel}>
          <View style={styles.playerRow}>
            <View>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerLvl}>Level {player.level}</Text>
            </View>
            {expGained > 0 && (
              <View style={styles.expGainBadge}>
                <Text style={styles.expGainTxt}>+{expGained} EXP gained</Text>
              </View>
            )}
          </View>
          <ExpBar current={player.exp} max={player.exp_to_next} />
        </SystemPanel>

        {/* Exercise quest list */}
        <Text style={styles.questsLbl}>— QUESTS —</Text>
        {exercises.map((ex, idx) => (
          <ExerciseItem key={ex.id} exercise={ex} index={idx} onComplete={() => handleCompleteExercise(ex)} />
        ))}

        {/* Actions */}
        <SystemButton
          title={finishing ? 'Processing...' : '⚔  COMPLETE SESSION'}
          onPress={handleFinishSession}
          loading={finishing}
          disabled={completedCount === 0 || finishing}
          style={styles.finishBtn}
        />
        <SystemButton
          title="Abandon Session"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.abandonBtn}
        />
      </ScrollView>

      {/* Level-up modal */}
      {player && (
        <LevelUpModal
          visible={levelUpVisible}
          player={player}
          newTitle={newTitle}
          onClose={() => { setLvlUp(false); navigation.goBack(); }}
        />
      )}
    </View>
  );
};

// ── ExerciseItem ───────────────────────────────

const ExerciseItem: React.FC<{
  exercise: SessionExercise; index: number; onComplete: () => void;
}> = ({ exercise, index, onComplete }) => {
  const done = !!exercise.is_completed;
  const checkAnim = useRef(new Animated.Value(done ? 1 : 0)).current;

  const handlePress = () => {
    if (done) return;
    Animated.spring(checkAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    onComplete();
  };

  const scale = checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] });

  return (
    <TouchableOpacity
      style={[styles.questItem, done && styles.questItemDone]}
      onPress={handlePress} disabled={done} activeOpacity={0.75}
    >
      <Animated.View style={[styles.indicator, done && styles.indicatorDone, { transform: [{ scale }] }]}>
        {done
          ? <Text style={styles.checkMark}>✓</Text>
          : <Text style={styles.indexNum}>{index + 1}</Text>}
      </Animated.View>

      <View style={styles.questBody}>
        <Text style={[styles.questName, done && styles.questNameDone]}>{exercise.exercise_name}</Text>
        <Text style={styles.questSets}>{exercise.sets_total} sets × {exercise.reps} reps</Text>
      </View>

      <View style={[styles.expBadge, done && styles.expBadgeDone]}>
        <Text style={[styles.expBadgeTxt, done && styles.expBadgeTxtDone]}>+{exercise.exp_reward}</Text>
        <Text style={[styles.expBadgeLbl, done && styles.expBadgeTxtDone]}>EXP</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:     { padding: 16, paddingBottom: 60 },
  loadRoot:    { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt:     { color: COLORS.textSecondary, fontSize: 13 },

  flash:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${COLORS.accentCyan}12`, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 110, zIndex: 99 },
  flashTxt:    { color: COLORS.accentCyan, fontSize: 32, fontWeight: '900', letterSpacing: 3 },

  sessionHdr:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 10 },
  sessionTag:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  sessionProgress: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  progressBg:  { height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill:{ height: '100%', backgroundColor: COLORS.accentCyan, borderRadius: 2 },

  playerPanel: { marginBottom: 16 },
  playerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  playerName:  { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  playerLvl:   { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  expGainBadge:{ backgroundColor: `${COLORS.accentGreen}18`, borderWidth: 1, borderColor: COLORS.accentGreen, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  expGainTxt:  { color: COLORS.accentGreen, fontSize: 11, fontWeight: '700' },

  questsLbl:   { color: COLORS.textMuted, fontSize: 11, letterSpacing: 2, fontWeight: '600', textAlign: 'center', marginBottom: 12 },

  questItem:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 13, marginBottom: 8, gap: 11 },
  questItemDone:{ borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}07` },

  indicator:   { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: COLORS.accentCyan, alignItems: 'center', justifyContent: 'center' },
  indicatorDone:{ borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}18` },
  checkMark:   { color: COLORS.accentGreen, fontSize: 17, fontWeight: '700' },
  indexNum:    { color: COLORS.accentCyan,  fontSize: 14, fontWeight: '700' },

  questBody:   { flex: 1 },
  questName:   { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  questNameDone:{ color: COLORS.textMuted, textDecorationLine: 'line-through' },
  questSets:   { color: COLORS.textSecondary, fontSize: 12 },

  expBadge:    { alignItems: 'center', backgroundColor: `${COLORS.accentCyan}12`, borderWidth: 1, borderColor: COLORS.accentCyan, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  expBadgeDone:{ borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}10` },
  expBadgeTxt: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700' },
  expBadgeTxtDone: { color: COLORS.accentGreen },
  expBadgeLbl: { color: COLORS.accentCyan, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },

  finishBtn:   { marginTop: 20, marginBottom: 8 },
  abandonBtn:  {},
});

export default SessionScreen;
