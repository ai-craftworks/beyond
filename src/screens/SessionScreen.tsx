import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getSessionExercises, getPlayer, updatePlayer,
  updateSession, completeSessionExercise,
  SessionExercise, Player, saveTitle,
  getBonusExercises, addBonusExerciseToSession,
  completeBonusExercise, BonusExercise, getExercises, Exercise,
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
  const [bonusTarget, setBonusTarget]   = useState('');

  // Amount input modal (for non-reps exercises)
  const [amountModal, setAmountModal]   = useState(false);
  const [pendingExercise, setPending]   = useState<SessionExercise | null>(null);
  const [pendingBonus, setPendingBonus] = useState<BonusExercise | null>(null);
  const [inputAmount, setInputAmount]   = useState('');

  const flashAnim  = useRef(new Animated.Value(0)).current;
  const flashScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => { loadSession(); }, []);

  const loadSession = async () => {
    setLoading(true);
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
    setLoading(false);
    await updateSession(sessionId, { status: 'in_progress', started_at: new Date().toISOString() });
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
    if (ex.unit_type === 'reps') {
      // For reps: complete immediately with the full target amount
      finalizeExercise(ex, ex.target * ex.sets_total);
    } else {
      // For distance/time: ask how much they actually did
      setPending(ex);
      setInputAmount(String(ex.target * ex.sets_total));
      setAmountModal(true);
    }
  };

  // Called when player taps a bonus exercise
  const handleTapBonus = (ex: BonusExercise) => {
    if (ex.is_completed) return;
    if (ex.unit_type === 'reps') {
      finalizeBonusExercise(ex, ex.target);
    } else {
      setPendingBonus(ex);
      setInputAmount(String(ex.target));
      setAmountModal(true);
    }
  };

  // Confirm amount from modal
  const handleConfirmAmount = () => {
    const amount = Number(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('System', 'Enter a valid amount.');
      return;
    }
    setAmountModal(false);
    if (pendingExercise) {
      finalizeExercise(pendingExercise, amount);
      setPending(null);
    } else if (pendingBonus) {
      finalizeBonusExercise(pendingBonus, amount);
      setPendingBonus(null);
    }
    setInputAmount('');
  };

  const finalizeExercise = async (ex: SessionExercise, actualAmount: number) => {
    const expEarned = Math.floor(actualAmount * ex.exp_per_unit);
    setExercises(prev =>
      prev.map(e => e.id === ex.id ? { ...e, is_completed: 1, actual_amount: actualAmount, exp_reward: expEarned } : e)
    );
    triggerFlash(expEarned);
    await completeSessionExercise(ex.id!, actualAmount, expEarned);
  };

  const finalizeBonusExercise = async (ex: BonusExercise, actualAmount: number) => {
    const expEarned = Math.floor(actualAmount * ex.exp_per_unit);
    setBonusEx(prev =>
      prev.map(e => e.id === ex.id ? { ...e, is_completed: 1, actual_amount: actualAmount, exp_reward: expEarned } : e)
    );
    triggerFlash(expEarned);
    await completeBonusExercise(ex.id!, actualAmount, expEarned);
  };

  const handleAddBonus = async () => {
    if (!selBonusEx) return Alert.alert('System', 'Select an exercise.');
    const target = Number(bonusTarget);
    if (isNaN(target) || target <= 0) return Alert.alert('System', 'Enter a valid target amount.');
    await addBonusExerciseToSession(sessionId, selBonusEx, target);
    const updated = await getBonusExercises(sessionId);
    setBonusEx(updated);
    setSelBonusEx(null); setBonusTarget(''); setBonusModal(false);
  };

  const handleFinishSession = async () => {
    const doneMain  = exercises.filter(e => e.is_completed);
    const doneBonus = bonusExercises.filter(e => e.is_completed);

    if (doneMain.length === 0 && doneBonus.length === 0) {
      Alert.alert('System', 'Complete at least one exercise first, Hunter.');
      return;
    }

    setFinishing(true);
    try {
      const p = await getPlayer();
      if (!p) return;

      // Sum EXP from main + bonus exercises
      let mainExp  = doneMain.reduce((sum, e) => sum + e.exp_reward, 0);
      let bonusExp = doneBonus.reduce((sum, e) => sum + e.exp_reward, 0);
      const allDone = doneMain.length === exercises.length;
      if (allDone) mainExp = Math.floor(mainExp * 1.1); // 10% full-clear bonus
      const totalExp = mainExp + bonusExp;

      // Stat gains
      const statDeltas: Record<string, number> = {};
      for (const ex of [...doneMain, ...doneBonus]) {
        statDeltas[ex.stat_type] = (statDeltas[ex.stat_type] ?? 0) + ex.stat_reward;
      }

      // Level calculation
      const newTotalExp = p.total_exp + totalExp;
      let level = 1, remaining = newTotalExp;
      while (level < 100) {
        const needed = expRequiredForLevel(level);
        if (remaining < needed) break;
        remaining -= needed; level++;
      }
      const levelled = level > p.level;

      const updates: Partial<Player> = {
        level, exp: remaining,
        exp_to_next: expRequiredForLevel(level),
        total_exp: newTotalExp,
        strength:     Math.min((p.strength     + (statDeltas['strength']     ?? 0)), 9999),
        agility:      Math.min((p.agility      + (statDeltas['agility']      ?? 0)), 9999),
        endurance:    Math.min((p.endurance    + (statDeltas['endurance']    ?? 0)), 9999),
        intelligence: Math.min((p.intelligence + (statDeltas['intelligence'] ?? 0)), 9999),
        vitality:     Math.min((p.vitality     + (statDeltas['vitality']     ?? 0)), 9999),
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
      await updateSession(sessionId, {
        status: 'completed',
        total_exp: totalExp,
        completed_at: new Date().toISOString(),
      });

      setPlayer({ ...p, ...updates } as Player);
      setNewTitle(awardedTitle);

      if (levelled) { setLvlUp(true); }
      else { navigation.goBack(); }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong.');
    } finally { setFinishing(false); }
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
      {/* EXP flash */}
      <Animated.View style={[styles.flash, { opacity: flashAnim }]} pointerEvents="none">
        <Animated.Text style={[styles.flashTxt, { transform: [{ scale: flashScale }] }]}>
          +EXP
        </Animated.Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <ExpBar current={player.exp} max={player.exp_to_next} />
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
        <SystemButton
          title={finishing ? 'Processing...' : '⚔  COMPLETE SESSION'}
          onPress={handleFinishSession}
          loading={finishing}
          disabled={(exercises.filter(e => e.is_completed).length === 0 && bonusExercises.filter(e => e.is_completed).length === 0) || finishing}
          style={styles.finishBtn}
        />
        <SystemButton title="Abandon Session" variant="ghost" onPress={() => navigation.goBack()} style={styles.abandonBtn} />
      </ScrollView>

      {/* Level-up modal */}
      {player && (
        <LevelUpModal visible={levelUpVisible} player={player} newTitle={newTitle}
          onClose={() => { setLvlUp(false); navigation.goBack(); }} />
      )}

      {/* Amount input modal (for distance/time exercises) */}
      <Modal visible={amountModal} transparent animationType="fade" onRequestClose={() => setAmountModal(false)}>
        <KeyboardAvoidingView style={styles.amountOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.amountSheet}>
            <Text style={styles.amountTitle}>
              {pendingExercise?.exercise_name ?? pendingBonus?.exercise_name}
            </Text>
            <Text style={styles.amountSub}>
              How much did you actually complete?
            </Text>
            <View style={styles.amountInputRow}>
              <TextInput
                style={styles.amountInput}
                value={inputAmount}
                onChangeText={setInputAmount}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
              />
              <Text style={styles.amountUnit}>
                {pendingExercise?.unit_label ?? pendingBonus?.unit_label}
              </Text>
            </View>
            <Text style={styles.amountExpPreview}>
              ≈ {Math.floor(Number(inputAmount || 0) * (pendingExercise?.exp_per_unit ?? pendingBonus?.exp_per_unit ?? 0))} EXP
            </Text>
            <View style={styles.amountBtnRow}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                onPress={() => { setAmountModal(false); setPending(null); setPendingBonus(null); setInputAmount(''); }} />
              <SystemButton title="Confirm" style={styles.flex1} onPress={handleConfirmAmount} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add bonus exercise modal */}
      <Modal visible={bonusModal} transparent animationType="slide" onRequestClose={() => setBonusModal(false)}>
        <KeyboardAvoidingView style={styles.amountOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.amountSheet, { maxHeight: '80%' }]}>
            <Text style={styles.amountTitle}>◆ ADD BONUS QUEST</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }} nestedScrollEnabled>
              {allExercises.map(ex => (
                <TouchableOpacity key={ex.id}
                  style={[styles.exPickItem, selBonusEx?.id === ex.id && styles.exPickItemOn]}
                  onPress={() => setSelBonusEx(ex)}>
                  <Text style={[styles.exPickTxt, selBonusEx?.id === ex.id && styles.exPickTxtOn]}>{ex.name}</Text>
                  <Text style={styles.exPickSub}>+{ex.exp_per_unit} EXP/{ex.unit_label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selBonusEx && (
              <View style={styles.amountInputRow}>
                <TextInput
                  style={styles.amountInput}
                  value={bonusTarget}
                  onChangeText={setBonusTarget}
                  keyboardType="decimal-pad"
                  placeholder="target"
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.amountUnit}>{selBonusEx.unit_label}</Text>
              </View>
            )}
            <View style={styles.amountBtnRow}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1} onPress={() => { setBonusModal(false); setSelBonusEx(null); setBonusTarget(''); }} />
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
  const checkAnim = useRef(new Animated.Value(done ? 1 : 0)).current;
  const handlePress = () => {
    if (done) return;
    Animated.spring(checkAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    onTap();
  };
  const scale = checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] });
  const isReps = exercise.unit_type === 'reps';

  return (
    <TouchableOpacity style={[styles.questItem, done && styles.questItemDone]} onPress={handlePress} disabled={done} activeOpacity={0.75}>
      <Animated.View style={[styles.indicator, done && styles.indicatorDone, { transform: [{ scale }] }]}>
        {done ? <Text style={styles.checkMark}>✓</Text> : <Text style={styles.indexNum}>{index + 1}</Text>}
      </Animated.View>
      <View style={styles.questBody}>
        <Text style={[styles.questName, done && styles.questNameDone]}>{exercise.exercise_name}</Text>
        <Text style={styles.questSets}>
          {exercise.sets_total} sets × {exercise.target} {exercise.unit_label}
          {done && exercise.actual_amount !== exercise.target * exercise.sets_total
            ? ` · actual: ${exercise.actual_amount} ${exercise.unit_label}`
            : ''}
        </Text>
        {!isReps && !done && (
          <Text style={styles.tapHint}>Tap to log your amount</Text>
        )}
      </View>
      <View style={[styles.expBadge, done && styles.expBadgeDone]}>
        <Text style={[styles.expBadgeTxt, done && styles.expBadgeTxtDone]}>
          {done ? `+${exercise.exp_reward}` : `~${Math.floor(exercise.target * exercise.sets_total * exercise.exp_per_unit)}`}
        </Text>
        <Text style={[styles.expBadgeLbl, done && styles.expBadgeTxtDone]}>EXP</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── BonusItem ────────────────────────────────

const BonusItem: React.FC<{ exercise: BonusExercise; index: number; onTap: () => void }> = ({ exercise, index, onTap }) => {
  const done = !!exercise.is_completed;
  return (
    <TouchableOpacity style={[styles.questItem, styles.bonusItem, done && styles.questItemDone]} onPress={onTap} disabled={done} activeOpacity={0.75}>
      <View style={[styles.indicator, styles.bonusIndicator, done && styles.indicatorDone]}>
        {done ? <Text style={styles.checkMark}>✓</Text> : <Text style={styles.bonusStar}>★</Text>}
      </View>
      <View style={styles.questBody}>
        <Text style={[styles.questName, done && styles.questNameDone]}>{exercise.exercise_name}</Text>
        <Text style={styles.questSets}>{exercise.target} {exercise.unit_label} · BONUS</Text>
      </View>
      <View style={[styles.expBadge, styles.bonusExpBadge, done && styles.expBadgeDone]}>
        <Text style={[styles.expBadgeTxt, done && styles.expBadgeTxtDone]}>
          {done ? `+${exercise.exp_reward}` : `~${Math.floor(exercise.target * exercise.exp_per_unit)}`}
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
  checkMark:     { color: COLORS.accentGreen, fontSize: 17, fontWeight: '700' },
  indexNum:      { color: COLORS.accentCyan, fontSize: 14, fontWeight: '700' },
  bonusStar:     { color: COLORS.accentGold, fontSize: 16 },

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
});

export default SessionScreen;