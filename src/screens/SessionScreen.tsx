import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSessionExercises, getPlayer, updatePlayer,
  updateSession, completeSessionExercise,
  SessionExercise, Player, saveTitle,
  getBonusExercises, addBonusExerciseToSession,
  completeBonusExercise, markBonusExercisesAwarded,
  BonusExercise, getExercises, Exercise, getSession
} from '../database/Database';
import { SystemPanel, SystemButton, ExpBar } from '../components/UIComponents';
import { Ionicons } from '@expo/vector-icons';
import LevelUpModal from '../components/LevelUpModal';
import { COLORS, TITLE_CONDITIONS, parseUnitValues, formatUnitValues, unitPerSet, unitSuffix } from '../constants/game';
import { parseUnits } from '../constants/game';
import {
  expForUnits, UnitSpec, UnitValue, statDeltasFromItems, cappedStat,
  fullClearBonus, calculateLevelFromTotalExp,
} from '../utils/math';
import { RootStackParamList } from '../../App';
import { playSound } from '../utils/sounds';

type Route = RouteProp<RootStackParamList, 'Session'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'Session'>;

/** Unit specs for a stored units JSON, falling back to a single legacy unit. */
const specsOf = (unitsJson: string | null | undefined, fallbackType: string): UnitSpec[] => {
  const parsed = parseUnits(unitsJson);
  const list = parsed.length > 0
    ? parsed
    : [{ type: fallbackType, label: unitSuffix(fallbackType), default: 0 }];
  return list.map(u => ({ type: u.type, label: u.label, default: u.default, perSet: unitPerSet(u.type) }));
};

const primarySpecOf = (
  unitsJson: string | null | undefined, primaryUnit: string | null | undefined, fallbackType: string
): string => {
  const specs = specsOf(unitsJson, fallbackType);
  return primaryUnit && specs.some(s => s.type === primaryUnit) ? primaryUnit : specs[0].type;
};

/** Planned values for a stored exercise, falling back to the legacy target. */
const plannedOf = (unitsJson: string | null | undefined, target: number, fallbackType: string): UnitValue[] => {
  const parsed = parseUnitValues(unitsJson);
  if (parsed.length > 0) return parsed;
  return [{ type: fallbackType, value: target }];
};

/** Prefill record for the amount modal, one entry per configured unit. */
const recordFor = (specs: UnitSpec[], planned: UnitValue[]): Record<string, string> => {
  const rec: Record<string, string> = {};
  for (const s of specs) {
    const p = planned.find(v => v.type === s.type);
    rec[s.type] = p ? String(p.value) : (s.default ? String(s.default) : '');
  }
  return rec;
};

const SessionScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const { sessionId } = route.params;

  const [exercises, setExercises]       = useState<SessionExercise[]>([]);
  const [bonusExercises, setBonusEx]    = useState<BonusExercise[]>([]);
  const [allExercises, setAllEx]        = useState<Exercise[]>([]);
  const [player, setPlayer]             = useState<Player | null>(null);
  const [loading, setLoading]           = useState(true);
  const [finishing, setFinishing]       = useState(false);
  const [levelUpVisible, setLvlUp]      = useState(false);
  const [newTitle, setNewTitle]         = useState<string | undefined>();
  const [expGained, setExpGained]       = useState(0);
  const [bonusModal, setBonusModal]     = useState(false);
  const [selBonusEx, setSelBonusEx]     = useState<Exercise | null>(null);
  const [bonusUnits, setBonusUnits]     = useState<Record<string, string>>({});

  // Amount input modal (for non-reps exercises)
  const [amountModal, setAmountModal]   = useState(false);
  const [pendingExercise, setPending]   = useState<SessionExercise | null>(null);
  const [pendingBonus, setPendingBonus] = useState<BonusExercise | null>(null);
  const [inputUnits, setInputUnits]     = useState<Record<string, string>>({});

  const [isAlreadyCompleted, setAlreadyCompleted] = useState(false);

  const flashAnim  = useRef(new Animated.Value(0)).current;
  const flashScale = useRef(new Animated.Value(0.8)).current;
  const finishingRef = useRef(false);

  useEffect(() => { loadSession(); }, []);

  const loadSession = async () => {
    setLoading(true);
    const currentSession = await getSession(sessionId);
    if (currentSession?.status === 'pending') {
      await updateSession(sessionId, { status: 'in_progress', started_at: new Date().toISOString() });
    }
    const [exs, bonus, p, all] = await Promise.all([
      getSessionExercises(sessionId),
      getBonusExercises(sessionId),
      getPlayer(),
      getExercises(),
    ]);
    setExercises(exs);
    setBonusEx(bonus);
    setAllEx(all);
    setPlayer(p);
    setAlreadyCompleted(currentSession?.status === 'completed');
    if (currentSession?.status === 'pending') playSound('questStart');
    setLoading(false);
  };

  const triggerFlash = (amount: number) => {
    setExpGained(prev => prev + amount);
    flashAnim.setValue(1);
    flashScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(flashAnim,  { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.spring(flashScale, { toValue: 1, friction: 4,   useNativeDriver: true }),
    ]).start();
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
    triggerFlash(expEarned);
    playSound('exerciseDone');
    await completeSessionExercise(ex.id!, primaryValue, expEarned, actualUnitsJson);
  };

  const finalizeBonusExercise = async (ex: BonusExercise, values: UnitValue[], primaryValue: number) => {
    const specs = specsOf(ex.units, ex.unit_type);
    const primary = primarySpecOf(ex.units, ex.primary_unit, ex.unit_type);
    const expEarned = expForUnits(values, specs, primary, ex.exp_per_unit, ex.exp_unit_count, 1);
    const actualUnitsJson = JSON.stringify(values);
    setBonusEx(prev =>
      prev.map(e => e.id === ex.id ? { ...e, is_completed: 1, actual_amount: primaryValue, actual_units: actualUnitsJson, exp_reward: expEarned } : e)
    );
    triggerFlash(expEarned);
    playSound('exerciseDone'); 
    await completeBonusExercise(ex.id!, primaryValue, expEarned, actualUnitsJson);
  };

  const handleAddBonus = async () => {
    if (!selBonusEx) return Alert.alert('System', 'Select an exercise.');
    const specs = specsOf(selBonusEx.units, selBonusEx.unit_type);
    const primary = primarySpecOf(selBonusEx.units, selBonusEx.primary_unit, selBonusEx.unit_type);
    const primaryValue = Number(bonusUnits[primary]);
    if (isNaN(primaryValue) || primaryValue <= 0) {
      Alert.alert('System', `Enter a valid ${unitSuffix(primary)} target.`);
      return;
    }
    const unitValues = JSON.stringify(specs.map(s => ({ type: s.type, value: Number(bonusUnits[s.type]) || 0 })));
    await addBonusExerciseToSession(sessionId, selBonusEx, primaryValue, unitValues);
    const updated = await getBonusExercises(sessionId);
    setBonusEx(updated);
    setSelBonusEx(null); setBonusUnits({}); setBonusModal(false);
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

        const levelled = await applyAward(statDeltas, totalExp, claimableBonusIds);
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

        if (!levelled) navigation.goBack();
      } else {
        // Session already completed — claim only newly-completed bonus EXP
        if (claimableBonus.length === 0) {
          Alert.alert('System', 'No new completed bonus quests to claim.');
          return;
        }

        const bonusExp = claimableBonus.reduce((sum, e) => sum + e.exp_reward, 0);
        const statDeltas = statDeltasFromItems(claimableBonus);

        await applyAward(statDeltas, bonusExp, claimableBonusIds);
        setExpGained(0);
        await updateSession(sessionId, {
          total_exp: (currentSession.total_exp ?? 0) + bonusExp,
        });
        setBonusEx(prev => prev.map(b => ({
          ...b,
          exp_awarded: claimableBonus.some(cb => cb.id === b.id) ? 1 : b.exp_awarded,
        })));
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong.');
    } finally { setFinishing(false); finishingRef.current = false; }
  };

  // Applies EXP/stat/level/title rewards for the given deltas and marks the
  // awarded bonus ids. Shared by first-time completion and bonus claiming.
  // Returns true if the player levelled up (caller decides whether to navigate away).
  const applyAward = async (
    statDeltas: Record<string, number>, totalExp: number, awardedBonusIds: number[]
  ): Promise<boolean> => {
    const p = await getPlayer();
    if (!p) return false;

    // Level calculation
    const newTotalExp = p.total_exp + totalExp;
    const { level, expInCurrentLevel, expToNext } = calculateLevelFromTotalExp(newTotalExp);
    const levelled = level > p.level;

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

    if (awardedTitle) playSound('title');

    if (levelled) {
      playSound('levelUp');
      setLvlUp(true);
    } else {
      playSound('sessionDone');
    }
    return levelled;
  };

  const abandonSession = () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    updateSession(sessionId, { status: 'skipped' })
      .catch(e => console.error('Abandon failed:', e));
    navigation.goBack();
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

  // Bonus add modal data
  const bonusSpecs = specsOf(selBonusEx?.units, selBonusEx?.unit_type ?? 'reps');
  const bonusPrimary = primarySpecOf(selBonusEx?.units, selBonusEx?.primary_unit, selBonusEx?.unit_type ?? 'reps');

  return (
    <View style={styles.root}>
      {/* EXP flash */}
      <Animated.View style={[styles.flash, { opacity: flashAnim }]} pointerEvents="none">
        <Animated.Text style={[styles.flashTxt, { transform: [{ scale: flashScale }] }]}>
          +EXP
        </Animated.Text>
      </Animated.View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.sessionHdr}>
          <Text style={styles.sessionTag}>◆ DAILY QUEST</Text>
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
          <TouchableOpacity style={styles.addBonusBtn} onPress={() => setBonusModal(true)}>
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

        {/* Actions */}
        {isAlreadyCompleted ? (
          /* Session already done — show completed banner, plus "Claim Bonus EXP"
             when newly-completed bonus quests have unclaimed rewards. */
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.accentGreen} />
            <Text style={styles.completedBannerText}>QUEST COMPLETED</Text>
            <Text style={styles.completedBannerSub}>You can still add bonus exercises above</Text>
            {bonusExercises.some(b => b.is_completed && !b.exp_awarded) && (
              <SystemButton
                title={finishing ? 'Processing...' : 'CLAIM BONUS EXP'}
                icon="flag"
                onPress={handleFinishSession}
                loading={finishing}
                style={styles.finishBtn}
              />
            )}
          </View>
        ) : (
          <>
            <SystemButton
              title={finishing ? 'Processing...' : 'COMPLETE SESSION'}
              icon="fitness"
              onPress={handleFinishSession}
              loading={finishing}
              disabled={(exercises.filter(e => e.is_completed).length === 0 && bonusExercises.filter(e => e.is_completed).length === 0) || finishing}
              style={styles.finishBtn}
            />
            <SystemButton title="Abandon Session" variant="ghost" onPress={abandonSession} disabled={finishing} style={styles.abandonBtn} />
          </>
        )}
      </ScrollView>

      {/* Level-up modal */}
      {player && (
        <LevelUpModal visible={levelUpVisible} player={player} newTitle={newTitle}
          onClose={() => { setLvlUp(false); navigation.goBack(); }} />
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

      {/* Add bonus exercise modal */}
      <Modal visible={bonusModal} transparent animationType="slide" onRequestClose={() => setBonusModal(false)}>
        <KeyboardAvoidingView style={styles.amountOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.amountSheet, { maxHeight: '80%', paddingBottom: 24 + insets.bottom }]}>
            <Text style={styles.amountTitle}>◆ ADD BONUS QUEST</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }} nestedScrollEnabled>
              {allExercises.map(ex => (
                <TouchableOpacity key={ex.id}
                  style={[styles.exPickItem, selBonusEx?.id === ex.id && styles.exPickItemOn]}
                  onPress={() => {
                    setSelBonusEx(ex);
                    const specs = specsOf(ex.units, ex.unit_type);
                    const rec: Record<string, string> = {};
                    for (const s of specs) rec[s.type] = s.default ? String(s.default) : '';
                    setBonusUnits(rec);
                  }}>
                  <Text style={[styles.exPickTxt, selBonusEx?.id === ex.id && styles.exPickTxtOn]}>{ex.name}</Text>
                  <Text style={styles.exPickSub}>+{ex.exp_per_unit} EXP/{ex.exp_unit_count ?? 1} {unitSuffix(ex.primary_unit ?? ex.unit_type ?? 'reps')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selBonusEx && bonusSpecs.map(s => (
              <View key={s.type} style={styles.amountInputRow}>
                <TextInput
                  style={styles.amountInput}
                  value={bonusUnits[s.type] ?? ''}
                  onChangeText={v => setBonusUnits(prev => ({ ...prev, [s.type]: v }))}
                  keyboardType="decimal-pad"
                  placeholder={s.type === bonusPrimary ? 'target' : '0'}
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.amountUnit}>
                  {unitSuffix(s.type)}{s.type === bonusPrimary ? ' · EXP' : ''}
                </Text>
              </View>
            ))}
            <View style={styles.amountBtnRow}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={() => { setBonusModal(false); setSelBonusEx(null); setBonusUnits({}); }} />
              <SystemButton title="Add" style={styles.flex1} onPress={handleAddBonus} />
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
  const plannedLabel = formatUnitValues(planned) || `${exercise.target} ${exercise.unit_label}`;
  const actualLabel = formatUnitValues(parseUnitValues(exercise.actual_units)) || `${exercise.actual_amount} ${exercise.unit_label}`;
  const previewExp = expForUnits(planned, specs, primary, exercise.exp_per_unit, exercise.exp_unit_count, exercise.sets_total);
  const checkAnim = useRef(new Animated.Value(done ? 1 : 0)).current;
  const handlePress = () => {
    if (done) return;
    Animated.spring(checkAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    onTap();
  };
  const scale = checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] });

  return (
    <TouchableOpacity style={[styles.questItem, done && styles.questItemDone]} onPress={handlePress} disabled={done} activeOpacity={0.75}>
      <Animated.View style={[styles.indicator, done && styles.indicatorDone, { transform: [{ scale }] }]}>
        {done ? <Ionicons name="checkmark" size={16} color={COLORS.accentGreen} /> : <Text style={styles.indexNum}>{index + 1}</Text>}
      </Animated.View>
      <View style={styles.questBody}>
        <Text style={[styles.questName, done && styles.questNameDone]}>{exercise.exercise_name}</Text>
        <Text style={styles.questSets}>
          {exercise.sets_total} sets × {done ? actualLabel : plannedLabel}
        </Text>
        {!done && (
          <Text style={styles.tapHint}>Tap to log your amount</Text>
        )}
      </View>
      <View style={[styles.expBadge, done && styles.expBadgeDone]}>
        <Text style={[styles.expBadgeTxt, done && styles.expBadgeTxtDone]}>
          {done
            ? `+${exercise.exp_reward}`
            : `~${previewExp}`
          }
        </Text>
        <Text style={[styles.expBadgeLbl, done && styles.expBadgeTxtDone]}>EXP</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── BonusItem ────────────────────────────────

const BonusItem: React.FC<{ exercise: BonusExercise; index: number; onTap: () => void }> = ({ exercise, index, onTap }) => {
  const done = !!exercise.is_completed;
  const specs = specsOf(exercise.units, exercise.unit_type);
  const primary = primarySpecOf(exercise.units, exercise.primary_unit, exercise.unit_type);
  const planned = plannedOf(exercise.unit_values, exercise.target, exercise.unit_type);
  const plannedLabel = formatUnitValues(planned) || `${exercise.target} ${exercise.unit_label}`;
  const actualLabel = formatUnitValues(parseUnitValues(exercise.actual_units)) || `${exercise.actual_amount} ${exercise.unit_label}`;
  const previewExp = expForUnits(planned, specs, primary, exercise.exp_per_unit, exercise.exp_unit_count, 1);
  return (
    <TouchableOpacity style={[styles.questItem, styles.bonusItem, done && styles.questItemDone]} onPress={onTap} disabled={done} activeOpacity={0.75}>
      <View style={[styles.indicator, styles.bonusIndicator, done && styles.indicatorDone]}>
        {done ? <Ionicons name="checkmark" size={16} color={COLORS.accentGreen} /> : <Ionicons name="star" size={14} color={COLORS.accentGold} />}
      </View>
      <View style={styles.questBody}>
        <Text style={[styles.questName, done && styles.questNameDone]}>{exercise.exercise_name}</Text>
        <Text style={styles.questSets}>{done ? actualLabel : plannedLabel} · BONUS</Text>
      </View>
      <View style={[styles.expBadge, styles.bonusExpBadge, done && styles.expBadgeDone]}>
        <Text style={[styles.expBadgeTxt, done && styles.expBadgeTxtDone]}>
          {done
            ? `+${exercise.exp_reward}`
            : `~${previewExp}`
          }
        </Text>
        <Text style={[styles.expBadgeLbl, done && styles.expBadgeTxtDone]}>EXP</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:       { padding: 16, paddingBottom: 60 },
  loadRoot:      { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadTxt:       { color: COLORS.textSecondary, fontSize: 13 },

  flash:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${COLORS.accentCyan}12`, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 110, zIndex: 99 },
  flashTxt:      { color: COLORS.accentCyan, fontSize: 32, fontWeight: '900', letterSpacing: 3 },

  sessionHdr:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 10 },
  sessionTag:    { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
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

  bonusHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 4 },
  bonusLbl:      { color: COLORS.accentGold, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  addBonusBtn:   { borderWidth: 1, borderColor: COLORS.accentGold, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  addBonusTxt:   { color: COLORS.accentGold, fontSize: 12, fontWeight: '700' },
  bonusHint:     { color: COLORS.textMuted, fontSize: 10, marginBottom: 10, fontStyle: 'italic' },
  noBonusTxt:    { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 12, fontStyle: 'italic' },

  questItem:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 13, marginBottom: 8, gap: 11 },
  questItemDone: { borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}07` },
  bonusItem:     { borderColor: `${COLORS.accentGold}40`, backgroundColor: `${COLORS.accentGold}05` },

  indicator:     { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: COLORS.accentCyan, alignItems: 'center', justifyContent: 'center' },
  indicatorDone: { borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}18` },
  bonusIndicator:{ borderColor: COLORS.accentGold },
  indexNum:      { color: COLORS.accentCyan, fontSize: 14, fontWeight: '700' },

  questBody:     { flex: 1 },
  questName:     { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  questNameDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  questSets:     { color: COLORS.textSecondary, fontSize: 12 },
  tapHint:       { color: COLORS.textMuted, fontSize: 10, fontStyle: 'italic', marginTop: 2 },

  expBadge:      { alignItems: 'center', backgroundColor: `${COLORS.accentCyan}12`, borderWidth: 1, borderColor: COLORS.accentCyan, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  bonusExpBadge: { borderColor: COLORS.accentGold, backgroundColor: `${COLORS.accentGold}10` },
  expBadgeDone:  { borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}10` },
  expBadgeTxt:   { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700' },
  expBadgeTxtDone: { color: COLORS.accentGreen },
  expBadgeLbl:   { color: COLORS.accentCyan, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },

  finishBtn:     { marginTop: 20, marginBottom: 8 },
  abandonBtn:    {},

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

  exPickItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.borderDim, borderRadius: 8, marginBottom: 5 },
  exPickItemOn:  { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}12` },
  exPickTxt:     { color: COLORS.textSecondary, fontSize: 14, flex: 1 },
  exPickTxtOn:   { color: COLORS.accentCyan },
  exPickSub:     { color: COLORS.textMuted, fontSize: 11 },

  completedBanner:     { marginTop: 24, marginBottom: 8, backgroundColor: `${COLORS.accentGreen}12`, borderWidth: 1, borderColor: COLORS.accentGreen, borderRadius: 10, padding: 20, alignItems: 'center', gap: 6 },
  completedBannerText: { color: COLORS.accentGreen, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  completedBannerSub:  { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
});

export default SessionScreen;