import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSessionExercises, getPlayer, updatePlayer,
  updateSession, completeSessionExercise,
  SessionExercise, Player, saveTitle,
  getBonusExercises, completeBonusExercise,
  markBonusExercisesAwarded, BonusExercise, getSession,
  awardMartialProficiency, getLifetimeStats, BeltPromotion,
} from '../database/Database';
import { SystemPanel, SystemButton, ExpBar } from '../components/UIComponents';
import ActionBar from '../components/ActionBar';
import WorkoutRow from '../components/WorkoutRow';
import { Ionicons } from '@expo/vector-icons';
import LevelUpModal from '../components/LevelUpModal';
import SessionClearModal, { SessionClearData, StatGain } from '../components/SessionClearModal';
import { COLORS, TITLE_CONDITIONS, parseUnitValues, formatUnitValues, unitSuffix, statColor, STATS, getRankForLevel } from '../constants/game';
import { specsOf, primarySpecOf, plannedOf, recordFor } from '../utils/units';
import {
  expForUnits, UnitValue, statDeltasFromItems, cappedStat,
  fullClearBonus, calculateLevelFromTotalExp,
} from '../utils/math';
import { RootStackParamList } from '../../App';
import { playSound } from '../utils/sounds';
import { hapticHeavy, hapticSuccess, hapticWarning } from '../utils/haptics';
import { computeStreaks } from '../utils/stats';
import { queueDashCelebration, queueDojoCelebration } from '../utils/celebrations';

type Route = RouteProp<RootStackParamList, 'Session'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'Session'>;

const SessionScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const { sessionId } = route.params;

  const [exercises, setExercises]       = useState<SessionExercise[]>([]);
  const [bonusExercises, setBonusEx]    = useState<BonusExercise[]>([]);
  const [player, setPlayer]             = useState<Player | null>(null);
  const [loading, setLoading]           = useState(true);
  const [finishing, setFinishing]       = useState(false);
  const [levelUpVisible, setLvlUp]      = useState(false);
  const [newTitle, setNewTitle]         = useState<string | undefined>();
  const [expGained, setExpGained]       = useState(0);
  const [rankUp, setRankUp]             = useState<{ from: ReturnType<typeof getRankForLevel>; to: ReturnType<typeof getRankForLevel> } | null>(null);
  const [awardStatGains, setAwardStatGains] = useState<StatGain[]>([]);
  const [clearVisible, setClearVisible] = useState(false);
  const [clearData, setClearData]       = useState<SessionClearData | null>(null);
  const [prFlash, setPrFlash]           = useState<string | null>(null);

  // Amount input modal (for non-reps exercises)
  const [amountModal, setAmountModal]   = useState(false);
  const [pendingExercise, setPending]   = useState<SessionExercise | null>(null);
  const [pendingBonus, setPendingBonus] = useState<BonusExercise | null>(null);
  const [inputUnits, setInputUnits]     = useState<Record<string, string>>({});

  const [isAlreadyCompleted, setAlreadyCompleted] = useState(false);

  const flashAnim  = useRef(new Animated.Value(0)).current;
  const flashScale = useRef(new Animated.Value(0.8)).current;
  const prFlashAnim = useRef(new Animated.Value(0)).current;
  const prTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prsRef = useRef<{ name: string; detail: string }[]>([]);
  const finishingRef = useRef(false);
  // Set before any programmatic exit (finish/abandon) so the beforeRemove
  // guard below doesn't re-prompt on navigation we initiated ourselves.
  const allowLeaveRef = useRef(false);

  // Guard the header back button / swipe-back: never silently strand an
  // unfinished quest in 'in_progress'. Confirm, or explicitly abandon.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeaveRef.current || loading || isAlreadyCompleted) return;
      e.preventDefault();
      Alert.alert(
        'Leave Quest?',
        'Your progress is saved. The quest stays in progress so you can finish it later today.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            onPress: () => {
              allowLeaveRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Abandon',
            style: 'destructive',
            onPress: async () => {
              try { await updateSession(sessionId, { status: 'skipped' }); }
              catch (err) { console.error('Abandon failed:', err); }
              allowLeaveRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsub;
  }, [navigation, sessionId, loading, isAlreadyCompleted]);

  // Refresh bonus quests when returning from the Add Bonus screen.
  useFocusEffect(useCallback(() => {
    getBonusExercises(sessionId).then(setBonusEx);
  }, [sessionId]));

  const loadSession = async () => {
    setLoading(true);
    const currentSession = await getSession(sessionId);
    if (currentSession?.status === 'pending') {
      await updateSession(sessionId, { status: 'in_progress', started_at: new Date().toISOString() });
    }
    const [exs, bonus, p] = await Promise.all([
      getSessionExercises(sessionId),
      getBonusExercises(sessionId),
      getPlayer(),
    ]);
    setExercises(exs);
    setBonusEx(bonus);
    setPlayer(p);
    setAlreadyCompleted(currentSession?.status === 'completed');
    prsRef.current = [];
    if (currentSession?.status === 'pending') playSound('questStart');
    setLoading(false);
  };

  useEffect(() => { loadSession(); }, []);

  const triggerFlash = (amount: number) => {
    setExpGained(prev => prev + amount);
    flashAnim.setValue(1);
    flashScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(flashAnim,  { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.spring(flashScale, { toValue: 1, friction: 4,   useNativeDriver: true }),
    ]).start();
  };

  // Gold "★ NEW PR" banner — visual counterpart to the existing PR sound.
  const triggerPrFlash = (name: string, detail: string) => {
    prsRef.current.push({ name, detail });
    setPrFlash(`${name} — ${detail}`);
    prFlashAnim.setValue(0);
    if (prTimeoutRef.current) clearTimeout(prTimeoutRef.current);
    Animated.timing(prFlashAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    prTimeoutRef.current = setTimeout(() => {
      Animated.timing(prFlashAnim, { toValue: 0, duration: 350, useNativeDriver: true })
        .start(() => setPrFlash(null));
    }, 1800);
  };

  // Called when player taps a session exercise
  const handleTapExercise = (ex: SessionExercise) => {
    if (ex.is_completed) return;
    const specs = specsOf(ex.units, ex.unit_type);
    const planned = plannedOf(ex.unit_values, ex.target, ex.unit_type);
    setPending(ex);
    setInputUnits(recordFor(specs, planned));
    setAmountModal(true);
  };

  // Called when player taps a bonus exercise
  const handleTapBonus = (ex: BonusExercise) => {
    if (ex.is_completed) return;
    const specs = specsOf(ex.units, ex.unit_type);
    const planned = plannedOf(ex.unit_values, ex.target, ex.unit_type);
    setPendingBonus(ex);
    setInputUnits(recordFor(specs, planned));
    setAmountModal(true);
  };

  // Confirm amount from modal
  const handleConfirmAmount = () => {
    const specs = pendingExercise
      ? specsOf(pendingExercise.units, pendingExercise.unit_type)
      : specsOf(pendingBonus?.units, pendingBonus?.unit_type ?? 'reps');
    const primary = pendingExercise
      ? primarySpecOf(pendingExercise.units, pendingExercise.primary_unit, pendingExercise.unit_type)
      : primarySpecOf(pendingBonus?.units, pendingBonus?.primary_unit, pendingBonus?.unit_type ?? 'reps');
    const primaryValue = Number(inputUnits[primary]);
    if (isNaN(primaryValue) || primaryValue <= 0) {
      Alert.alert('System', `Enter a valid ${unitSuffix(primary)} amount.`);
      return;
    }
    const values: UnitValue[] = specs.map(s => ({ type: s.type, value: Number(inputUnits[s.type]) || 0 }));
    setAmountModal(false);
    if (pendingExercise) {
      finalizeExercise(pendingExercise, values, primaryValue);
      setPending(null);
    } else if (pendingBonus) {
      finalizeBonusExercise(pendingBonus, values, primaryValue);
      setPendingBonus(null);
    }
    setInputUnits({});
  };

  const finalizeExercise = async (ex: SessionExercise, values: UnitValue[], primaryValue: number) => {
    const specs = specsOf(ex.units, ex.unit_type);
    const primary = primarySpecOf(ex.units, ex.primary_unit, ex.unit_type);
    const expEarned = expForUnits(values, specs, primary, ex.exp_per_unit, ex.exp_unit_count, ex.sets_total);
    const actualUnitsJson = JSON.stringify(values);
    setExercises(prev =>
      prev.map(e => e.id === ex.id ? { ...e, is_completed: 1, actual_amount: primaryValue, actual_units: actualUnitsJson, exp_reward: expEarned } : e)
    );
    try {
      const isNewPr = await completeSessionExercise(ex.id!, primaryValue, expEarned, actualUnitsJson);
      triggerFlash(expEarned);
      if (isNewPr) { playSound('title'); hapticSuccess(); triggerPrFlash(ex.exercise_name, `${primaryValue} ${unitSuffix(primary)}`); }
      else { playSound('exerciseDone'); hapticHeavy(); }
    } catch (e) {
      console.error('complete exercise error:', e);
      // Roll back the optimistic tick so the UI matches the DB.
      setExercises(prev =>
        prev.map(e => e.id === ex.id ? { ...e, is_completed: 0, actual_amount: ex.actual_amount, actual_units: ex.actual_units, exp_reward: ex.exp_reward } : e)
      );
      Alert.alert('Error', 'Could not save your progress. Please try again.');
    }
  };

  const finalizeBonusExercise = async (ex: BonusExercise, values: UnitValue[], primaryValue: number) => {
    const specs = specsOf(ex.units, ex.unit_type);
    const primary = primarySpecOf(ex.units, ex.primary_unit, ex.unit_type);
    const expEarned = expForUnits(values, specs, primary, ex.exp_per_unit, ex.exp_unit_count, 1);
    const actualUnitsJson = JSON.stringify(values);
    setBonusEx(prev =>
      prev.map(e => e.id === ex.id ? { ...e, is_completed: 1, actual_amount: primaryValue, actual_units: actualUnitsJson, exp_reward: expEarned } : e)
    );
    try {
      const isNewPr = await completeBonusExercise(ex.id!, primaryValue, expEarned, actualUnitsJson);
      triggerFlash(expEarned);
      if (isNewPr) { playSound('title'); hapticSuccess(); triggerPrFlash(ex.exercise_name, `${primaryValue} ${unitSuffix(primary)}`); }
      else { playSound('exerciseDone'); hapticHeavy(); }
    } catch (e) {
      console.error('complete bonus exercise error:', e);
      setBonusEx(prev =>
        prev.map(e => e.id === ex.id ? { ...e, is_completed: 0, actual_amount: ex.actual_amount, actual_units: ex.actual_units, exp_reward: ex.exp_reward } : e)
      );
      Alert.alert('Error', 'Could not save your progress. Please try again.');
    }
  };

  // Builds the QUEST CLEAR summary and opens it (the level-up modal, when
  // set, rises on top). Celebration cards for the Dashboard/Dojo are queued
  // by the caller so each event is queued exactly once.
  const presentClear = async (opts: {
    mainExp: number; fullClearAmount: number; bonusExp: number; totalExp: number;
    awardedTitle?: string; statGains: StatGain[];
    belts: BeltPromotion[]; newBestStreak: boolean;
  }) => {
    const streak = computeStreaks((await getLifetimeStats()).completedDates);
    setClearData({
      totalExp: opts.totalExp,
      mainExp: opts.mainExp,
      fullClearAmount: opts.fullClearAmount,
      bonusExp: opts.bonusExp,
      statGains: opts.statGains,
      title: opts.awardedTitle,
      streak,
      newBestStreak: opts.newBestStreak,
      prs: prsRef.current,
      belts: opts.belts,
    });
    setClearVisible(true);
  };

  const handleFinishSession = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      const currentSession = await getSession(sessionId);
      if (!currentSession) return;

      const alreadyCompleted = currentSession.status === 'completed';

      // Newly-completed bonus exercises whose EXP hasn't been awarded yet.
      // On an already-completed session, only these are claimable.
      const claimableBonus = bonusExercises.filter(e => e.is_completed && !e.exp_awarded);
      const claimableBonusIds = claimableBonus.map(b => b.id!);

      if (!alreadyCompleted) {
        const doneMain = exercises.filter(e => e.is_completed);
        if (doneMain.length === 0 && claimableBonus.length === 0) {
          Alert.alert('System', 'Complete at least one exercise first, Hunter.');
          return;
        }

        // Sum EXP from main + (all) bonus exercises being finished for the first time
        const rawMainExp  = doneMain.reduce((sum, e) => sum + e.exp_reward, 0);
        const bonusExp    = claimableBonus.reduce((sum, e) => sum + e.exp_reward, 0);
        const allDone     = doneMain.length === exercises.length;
        // Apply 10% bonus to main exercises only, as a flat addition
        const bonusAmount = allDone ? fullClearBonus(rawMainExp) : 0;
        const mainExp     = rawMainExp + bonusAmount;
        const totalExp    = mainExp + bonusExp;

        const statDeltas = statDeltasFromItems([...doneMain, ...claimableBonus]);

        // Streak before/after completion — detects a new personal best.
        const beforeStreak = computeStreaks((await getLifetimeStats()).completedDates);

        const award = await applyAward(statDeltas, totalExp, claimableBonusIds);
        setExpGained(0);
        await updateSession(sessionId, {
          status: 'completed',
          total_exp: totalExp,
          completed_at: new Date().toISOString(),
        });
        setAlreadyCompleted(true);
        setBonusEx(prev => prev.map(b => ({
          ...b,
          exp_awarded: claimableBonus.some(cb => cb.id === b.id) ? 1 : b.exp_awarded,
        })));

        // Train martial-arts proficiency from every workout just cleared.
        const belts = await awardMartialProficiency(
          [...doneMain, ...claimableBonus].map(e => ({ exercise_id: e.exercise_id, exp: e.exp_reward }))
        );

        const afterStreak = computeStreaks((await getLifetimeStats()).completedDates);
        const newBest = afterStreak.best > beforeStreak.best;

        await presentClear({
          mainExp: rawMainExp,
          fullClearAmount: bonusAmount,
          bonusExp,
          totalExp,
          awardedTitle: award.awardedTitle,
          statGains: award.statGains,
          belts,
          newBestStreak: newBest,
        });

        // Dashboard return cards — level-up/rank-up first, then streak.
        if (award.rankUp) {
          queueDashCelebration({
            kind: 'rank',
            title: `RANK UP — ${award.rankUp.to.rank}-RANK`,
            subtitle: `${player?.name ?? 'Hunter'}, you are now ${award.rankUp.to.label.toLowerCase()}`,
            color: award.rankUp.to.color,
          });
        } else if (award.levelled) {
          queueDashCelebration({
            kind: 'level',
            title: `LEVEL ${award.newLevel} REACHED`,
            subtitle: 'Keep training, Hunter.',
            color: COLORS.accentCyan,
          });
        }
        if (newBest) {
          queueDashCelebration({
            kind: 'streak',
            title: `NEW BEST STREAK — ${afterStreak.best} DAYS`,
            subtitle: 'The System acknowledges your consistency.',
            color: COLORS.accentGold,
          });
        }
        if (belts.length > 0) {
          queueDojoCelebration({
            kind: 'belt',
            title: 'BELT PROMOTED',
            subtitle: belts.map(b => `${b.name}: ${b.from} → ${b.to}`).join('\n'),
            color: COLORS.accentGreen,
          });
        }
      } else {
        // Session already completed — claim only newly-completed bonus EXP
        if (claimableBonus.length === 0) {
          Alert.alert('System', 'No new completed bonus quests to claim.');
          return;
        }

        const bonusExp = claimableBonus.reduce((sum, e) => sum + e.exp_reward, 0);
        const statDeltas = statDeltasFromItems(claimableBonus);

        const award = await applyAward(statDeltas, bonusExp, claimableBonusIds);
        setExpGained(0);
        await updateSession(sessionId, {
          total_exp: (currentSession.total_exp ?? 0) + bonusExp,
        });
        setBonusEx(prev => prev.map(b => ({
          ...b,
          exp_awarded: claimableBonus.some(cb => cb.id === b.id) ? 1 : b.exp_awarded,
        })));

        // Claimed bonus quests train martial-arts proficiency too.
        const belts = await awardMartialProficiency(
          claimableBonus.map(e => ({ exercise_id: e.exercise_id, exp: e.exp_reward }))
        );

        await presentClear({
          mainExp: 0, fullClearAmount: 0, bonusExp, totalExp: bonusExp,
          awardedTitle: award.awardedTitle,
          statGains: award.statGains,
          belts,
          newBestStreak: false,
        });
        if (award.rankUp) {
          queueDashCelebration({
            kind: 'rank',
            title: `RANK UP — ${award.rankUp.to.rank}-RANK`,
            subtitle: `${player?.name ?? 'Hunter'}, you are now ${award.rankUp.to.label.toLowerCase()}`,
            color: award.rankUp.to.color,
          });
        } else if (award.levelled) {
          queueDashCelebration({
            kind: 'level',
            title: `LEVEL ${award.newLevel} REACHED`,
            subtitle: 'Keep training, Hunter.',
            color: COLORS.accentCyan,
          });
        }
        if (belts.length > 0) {
          queueDojoCelebration({
            kind: 'belt',
            title: 'BELT PROMOTED',
            subtitle: belts.map(b => `${b.name}: ${b.from} → ${b.to}`).join('\n'),
            color: COLORS.accentGreen,
          });
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong.');
    } finally { setFinishing(false); finishingRef.current = false; }
  };

  // Applies EXP/stat/level/title rewards for the given deltas and marks the
  // awarded bonus ids. Shared by first-time completion and bonus claiming.
  const applyAward = async (
    statDeltas: Record<string, number>, totalExp: number, awardedBonusIds: number[]
  ): Promise<{
    levelled: boolean; newLevel: number;
    rankUp: { from: ReturnType<typeof getRankForLevel>; to: ReturnType<typeof getRankForLevel> } | null;
    awardedTitle?: string; statGains: StatGain[];
  }> => {
    const p = await getPlayer();
    if (!p) return { levelled: false, newLevel: 1, rankUp: null, statGains: [] };

    // Level calculation
    const newTotalExp = p.total_exp + totalExp;
    const { level, expInCurrentLevel, expToNext } = calculateLevelFromTotalExp(newTotalExp);
    const levelled = level > p.level;
    const oldRank = getRankForLevel(p.level);
    const newRank = getRankForLevel(level);
    const crossedRank = newRank.rank !== oldRank.rank;

    const updates: Partial<Player> = {
      level, exp: expInCurrentLevel,
      exp_to_next: expToNext,
      total_exp: newTotalExp,
      strength:     cappedStat(p.strength,     statDeltas['strength']     ?? 0),
      agility:      cappedStat(p.agility,      statDeltas['agility']      ?? 0),
      endurance:    cappedStat(p.endurance,    statDeltas['endurance']    ?? 0),
      intelligence: cappedStat(p.intelligence, statDeltas['intelligence'] ?? 0),
      vitality:     cappedStat(p.vitality,     statDeltas['vitality']     ?? 0),
    };

    // Actual gains after caps — what the modals celebrate.
    const statGains: StatGain[] = STATS
      .map(s => {
        const delta = (updates[s.key] as number) - (p[s.key] as number);
        return { key: s.key, label: s.label, color: s.color, delta };
      })
      .filter(g => g.delta > 0);

    // Title checks
    const snap = { level, strength: updates.strength!, agility: updates.agility!, endurance: updates.endurance!, intelligence: updates.intelligence!, vitality: updates.vitality! };
    let awardedTitle: string | undefined;
    for (const cond of TITLE_CONDITIONS) {
      if (cond.check(snap)) {
        const isNew = await saveTitle(cond.title, cond.description);
        if (isNew && !awardedTitle) { awardedTitle = cond.title; updates.title = cond.title; }
      }
    }

    await updatePlayer(updates);
    if (awardedBonusIds.length > 0) {
      await markBonusExercisesAwarded(awardedBonusIds);
    }

    setPlayer({ ...p, ...updates } as Player);
    setNewTitle(awardedTitle);
    setAwardStatGains(statGains);
    setRankUp(crossedRank ? { from: oldRank, to: newRank } : null);

    // Exactly one celebration sound per finish — never stacked.
    if (levelled) {
      playSound('levelUp');
      hapticSuccess();
      setLvlUp(true);
    } else if (awardedTitle) {
      playSound('title');
      hapticSuccess();
    } else {
      playSound('sessionDone');
      hapticSuccess();
    }
    return { levelled, newLevel: level, rankUp: crossedRank ? { from: oldRank, to: newRank } : null, awardedTitle, statGains };
  };

  const abandonSession = () => {
    if (finishingRef.current) return;
    Alert.alert(
      'Abandon Quest?',
      'This quest will be marked as skipped. Completed exercises stay logged, but uncompleted ones will not count.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            if (finishingRef.current) return;
            finishingRef.current = true;
            setFinishing(true);
            try {
              await updateSession(sessionId, { status: 'skipped' });
              hapticWarning();
              allowLeaveRef.current = true;
              navigation.goBack();
            } catch (e) {
              console.error('Abandon failed:', e);
              Alert.alert('Error', 'Could not abandon the quest. Please try again.');
            } finally {
              setFinishing(false);
              finishingRef.current = false;
            }
          },
        },
      ]
    );
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

  // What the pinned bar offers: claim leftover bonus EXP once the session is
  // logged, otherwise finish the session as soon as one quest is done.
  const hasUnclaimedBonus = bonusExercises.some(b => b.is_completed && !b.exp_awarded);
  const anyQuestDone = completedCount > 0 || bonusExercises.some(b => b.is_completed);

  // Amount modal data
  const pendingUnits = pendingExercise
    ? specsOf(pendingExercise.units, pendingExercise.unit_type)
    : specsOf(pendingBonus?.units, pendingBonus?.unit_type ?? 'reps');
  const pendingPrimary = pendingExercise
    ? primarySpecOf(pendingExercise.units, pendingExercise.primary_unit, pendingExercise.unit_type)
    : primarySpecOf(pendingBonus?.units, pendingBonus?.primary_unit, pendingBonus?.unit_type ?? 'reps');
  const pendingSets  = pendingExercise?.sets_total ?? 1;
  const pendingRate  = pendingExercise?.exp_per_unit ?? pendingBonus?.exp_per_unit ?? 0;
  const pendingCount = pendingExercise?.exp_unit_count ?? pendingBonus?.exp_unit_count ?? 1;
  const pendingValues: UnitValue[] = pendingUnits.map(s => ({ type: s.type, value: Number(inputUnits[s.type]) || 0 }));
  const pendingExp = pendingUnits.length > 0
    ? expForUnits(pendingValues, pendingUnits, pendingPrimary, pendingRate, pendingCount, pendingSets)
    : 0;

  return (
    <View style={styles.root}>
      {/* EXP flash */}
      <Animated.View style={[styles.flash, { opacity: flashAnim }]} pointerEvents="none">
        <Animated.Text style={[styles.flashTxt, { transform: [{ scale: flashScale }] }]}>
          +EXP
        </Animated.Text>
      </Animated.View>

      {/* New PR flash */}
      {prFlash && (
        <Animated.View style={[styles.prFlash, { opacity: prFlashAnim }]} pointerEvents="none">
          <Ionicons name="star" size={22} color={COLORS.accentGold} />
          <Text style={styles.prFlashTxt}>NEW PR</Text>
          <Text style={styles.prFlashSub}>{prFlash}</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 }]} showsVerticalScrollIndicator={false}>
        {/* Progress header — the native header already names the quest */}
        <View style={styles.sessionHdr}>
          <Text style={styles.sessionProgress}>{completedCount} / {exercises.length}</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
        </View>

        {/* Player EXP */}
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
          <ExpBar current={Math.min(player.exp + expGained, player.exp_to_next)} max={player.exp_to_next} />
        </SystemPanel>

        {/* Main quests */}
        <Text style={styles.questsLbl}>— QUESTS —</Text>
        {exercises.map((ex, idx) => (
          <ExerciseItem key={ex.id} exercise={ex} index={idx} onTap={() => handleTapExercise(ex)} />
        ))}

        {/* Bonus section */}
        <View style={styles.bonusHeader}>
          <Text style={styles.bonusLbl}>— BONUS QUESTS —</Text>
          <TouchableOpacity style={styles.addBonusBtn}
            onPress={() => navigation.navigate('WorkoutSelect', { mode: 'bonus', sessionId })}>
            <Text style={styles.addBonusTxt}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.bonusHint}>Optional · No penalty if skipped · EXP rewarded if done</Text>

        {bonusExercises.length === 0 ? (
          <Text style={styles.noBonusTxt}>No bonus quests yet. Add some for extra EXP.</Text>
        ) : (
          bonusExercises.map((ex, idx) => (
            <BonusItem key={ex.id} exercise={ex} index={idx} onTap={() => handleTapBonus(ex)} />
          ))
        )}

        {/* Session already done — the banner explains the state; the action
            itself lives in the pinned bar below. */}
        {isAlreadyCompleted && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.accentGreen} />
            <Text style={styles.completedBannerText}>QUEST COMPLETED</Text>
            <Text style={styles.completedBannerSub}>You can still add bonus exercises above</Text>
          </View>
        )}
      </ScrollView>

      {/* The session's primary action is pinned so it is reachable no matter
          how many quests are queued up. */}
      <ActionBar
        stacked
        style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}
        label={`${completedCount} / ${exercises.length} quests`}
        hint={isAlreadyCompleted ? 'Session already logged' : undefined}
        secondary={isAlreadyCompleted ? undefined : { label: 'Abandon Session', onPress: abandonSession, disabled: finishing }}
      >
        {isAlreadyCompleted ? (
          hasUnclaimedBonus && (
            <SystemButton
              title={finishing ? 'Processing...' : 'CLAIM BONUS EXP'}
              icon="flag"
              style={styles.barBtn}
              textStyle={styles.barBtnTxt}
              onPress={handleFinishSession}
              loading={finishing}
            />
          )
        ) : (
          <SystemButton
            title={finishing ? 'Processing...' : 'COMPLETE SESSION'}
            icon="fitness"
            style={styles.barBtn}
            textStyle={styles.barBtnTxt}
            onPress={handleFinishSession}
            loading={finishing}
            disabled={!anyQuestDone || finishing}
          />
        )}
      </ActionBar>

      {/* QUEST CLEAR summary — shown on every finish; Continue exits the quest.
          Rendered before the level-up modal so LEVEL UP rises on top of it. */}
      <SessionClearModal visible={clearVisible} data={clearData}
        onClose={() => { setClearVisible(false); allowLeaveRef.current = true; navigation.goBack(); }} />

      {/* Level-up modal — rises above the QUEST CLEAR summary */}
      {player && (
        <LevelUpModal visible={levelUpVisible} player={player} newTitle={newTitle}
          rankUp={rankUp} statDeltas={awardStatGains}
          onClose={() => setLvlUp(false)} />
      )}

      {/* Amount input modal (for distance/time exercises) */}
      <Modal visible={amountModal} transparent animationType="fade" onRequestClose={() => setAmountModal(false)}>
        <KeyboardAvoidingView style={styles.amountOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.amountSheet, { paddingBottom: 24 + insets.bottom }]}>
            <Text style={styles.amountTitle}>
              {pendingExercise?.exercise_name ?? pendingBonus?.exercise_name}
            </Text>
            <Text style={styles.amountSub}>
              How much did you actually complete?
            </Text>
            {pendingUnits.map((s, i) => (
              <View key={s.type} style={styles.amountInputRow}>
                <TextInput
                  style={styles.amountInput}
                  value={inputUnits[s.type] ?? ''}
                  onChangeText={v => setInputUnits(prev => ({ ...prev, [s.type]: v }))}
                  keyboardType="decimal-pad"
                  autoFocus={i === 0}
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.amountUnit}>{unitSuffix(s.type)}</Text>
              </View>
            ))}
            <Text style={styles.amountExpPreview}>
              ≈ {pendingExp} EXP{pendingSets > 1 ? ` · ${pendingSets} sets` : ''}
            </Text>
            <View style={styles.amountBtnRow}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                onPress={() => { setAmountModal(false); setPending(null); setPendingBonus(null); setInputUnits({}); }} />
              <SystemButton title="Confirm" style={styles.flex1} onPress={handleConfirmAmount} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── ExerciseItem ─────────────────────────────

const ExerciseItem: React.FC<{ exercise: SessionExercise; index: number; onTap: () => void }> = ({ exercise, index, onTap }) => {
  const done = !!exercise.is_completed;
  const specs = specsOf(exercise.units, exercise.unit_type);
  const primary = primarySpecOf(exercise.units, exercise.primary_unit, exercise.unit_type);
  const planned = plannedOf(exercise.unit_values, exercise.target, exercise.unit_type);
  const plannedLabel = formatUnitValues(planned) || `${exercise.target} ${exercise.unit_label ?? 'reps'}`;
  const actualLabel = formatUnitValues(parseUnitValues(exercise.actual_units)) || `${exercise.actual_amount} ${exercise.unit_label ?? 'reps'}`;
  const previewExp = expForUnits(planned, specs, primary, exercise.exp_per_unit, exercise.exp_unit_count, exercise.sets_total);
  const checkAnim = useRef(new Animated.Value(done ? 1 : 0)).current;
  const handlePress = () => {
    if (done) return;
    Animated.spring(checkAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    onTap();
  };
  const scale = checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] });

  return (
    <WorkoutRow
      state={done ? 'done' : 'default'}
      title={exercise.exercise_name}
      meta={`${exercise.sets_total} sets × ${done ? actualLabel : plannedLabel}`}
      accent={statColor(exercise.stat_type)}
      exp={done ? `+${exercise.exp_reward} EXP` : `~${previewExp} EXP`}
      badgeColor={done ? COLORS.accentGreen : COLORS.accentCyan}
      footer={done ? undefined : <Text style={styles.tapHint}>Tap to log your amount</Text>}
      leading={
        <Animated.View style={[styles.indicator, done && styles.indicatorDone, { transform: [{ scale }] }]}>
          {done ? <Ionicons name="checkmark" size={16} color={COLORS.accentGreen} /> : <Text style={styles.indexNum}>{index + 1}</Text>}
        </Animated.View>
      }
      onPress={done ? undefined : handlePress}
    />
  );
};

// ── BonusItem ────────────────────────────────

const BonusItem: React.FC<{ exercise: BonusExercise; index: number; onTap: () => void }> = ({ exercise, index, onTap }) => {
  const done = !!exercise.is_completed;
  const specs = specsOf(exercise.units, exercise.unit_type);
  const primary = primarySpecOf(exercise.units, exercise.primary_unit, exercise.unit_type);
  const planned = plannedOf(exercise.unit_values, exercise.target, exercise.unit_type);
  const plannedLabel = formatUnitValues(planned) || `${exercise.target} ${exercise.unit_label ?? 'reps'}`;
  const actualLabel = formatUnitValues(parseUnitValues(exercise.actual_units)) || `${exercise.actual_amount} ${exercise.unit_label ?? 'reps'}`;
  const previewExp = expForUnits(planned, specs, primary, exercise.exp_per_unit, exercise.exp_unit_count, 1);
  return (
    <WorkoutRow
      state={done ? 'done' : 'default'}
      style={done ? undefined : styles.bonusItem}
      title={exercise.exercise_name}
      meta={`${done ? actualLabel : plannedLabel} · BONUS`}
      accent={done ? COLORS.accentGreen : COLORS.accentGold}
      exp={done ? `+${exercise.exp_reward} EXP` : `~${previewExp} EXP`}
      badgeColor={done ? COLORS.accentGreen : COLORS.accentGold}
      leading={
        <View style={[styles.indicator, styles.bonusIndicator, done && styles.indicatorDone]}>
          {done ? <Ionicons name="checkmark" size={16} color={COLORS.accentGreen} /> : <Ionicons name="star" size={14} color={COLORS.accentGold} />}
        </View>
      }
      onPress={done ? undefined : onTap}
    />
  );
};

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:       { padding: 16, paddingBottom: 60 },
  loadRoot:      { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt:       { color: COLORS.textSecondary, fontSize: 13 },

  flash:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${COLORS.accentCyan}12`, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 110, zIndex: 99 },
  flashTxt:      { color: COLORS.accentCyan, fontSize: 32, fontWeight: '900', letterSpacing: 3 },

  prFlash:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${COLORS.accentGold}15`, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 160, zIndex: 100, gap: 4 },
  prFlashTxt:    { color: COLORS.accentGold, fontSize: 26, fontWeight: '900', letterSpacing: 4 },
  prFlashSub:    { color: COLORS.accentGold, fontSize: 14, fontWeight: '700' },

  sessionHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 10 },
  sessionProgress: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  progressBg:    { height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: COLORS.accentCyan, borderRadius: 2 },

  playerPanel:   { marginBottom: 16 },
  playerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  playerName:    { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  playerLvl:     { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  expGainBadge:  { backgroundColor: `${COLORS.accentGreen}18`, borderWidth: 1, borderColor: COLORS.accentGreen, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  expGainTxt:    { color: COLORS.accentGreen, fontSize: 11, fontWeight: '700' },

  questsLbl:     { color: COLORS.textMuted, fontSize: 11, letterSpacing: 2, fontWeight: '600', textAlign: 'center', marginBottom: 12 },

  bonusItem:     { backgroundColor: `${COLORS.accentGold}05` },

  bonusHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 4 },
  bonusLbl:      { color: COLORS.accentGold, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  addBonusBtn:   { borderWidth: 1, borderColor: COLORS.accentGold, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  addBonusTxt:   { color: COLORS.accentGold, fontSize: 12, fontWeight: '700' },
  bonusHint:     { color: COLORS.textMuted, fontSize: 10, marginBottom: 10, fontStyle: 'italic' },
  noBonusTxt:    { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 12, fontStyle: 'italic' },

  indicator:     { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: COLORS.accentCyan, alignItems: 'center', justifyContent: 'center' },
  indicatorDone: { borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}18` },
  bonusIndicator:{ borderColor: COLORS.accentGold },
  indexNum:      { color: COLORS.accentCyan, fontSize: 14, fontWeight: '700' },

  tapHint:       { color: COLORS.textMuted, fontSize: 10, fontStyle: 'italic', marginTop: 4 },

  actionBar:     { paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.borderMain },
  barBtn:        { flex: 1 },
  barBtnTxt:     { fontSize: 13, letterSpacing: 1 },

  // Amount input modal
  amountOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  amountSheet:   { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 24 },
  amountTitle:   { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  amountSub:     { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },
  amountInputRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  amountInput:   { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.accentCyan, borderRadius: 8, color: COLORS.textPrimary, fontSize: 24, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12, textAlign: 'center' },
  amountUnit:    { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600', minWidth: 36 },
  amountExpPreview: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  amountBtnRow:  { flexDirection: 'row', gap: 12 },
  flex1:         { flex: 1 },

  completedBanner:     { marginTop: 24, marginBottom: 8, backgroundColor: `${COLORS.accentGreen}12`, borderWidth: 1, borderColor: COLORS.accentGreen, borderRadius: 10, padding: 20, alignItems: 'center', gap: 6 },
  completedBannerText: { color: COLORS.accentGreen, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  completedBannerSub:  { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
});

export default SessionScreen;