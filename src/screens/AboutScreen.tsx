/**
 * src/screens/AboutScreen.tsx
 * ============================
 * Explains the System: how ranks work, how to level up,
 * all available titles and which the player has earned.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPlayer, Player, getTitles, EarnedTitle } from '../database/Database';
import { SystemPanel, SectionHeader, ExpBar } from '../components/UIComponents';
import { COLORS, RANKS, TITLE_CONDITIONS, expRequiredForLevel, getRankForLevel } from '../constants/game';

const AboutScreen: React.FC = () => {
  const [player, setPlayer]   = useState<Player | null>(null);
  const [titles, setTitles]   = useState<EarnedTitle[]>([]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    const [p, t] = await Promise.all([getPlayer(), getTitles()]);
    setPlayer(p);
    setTitles(t);
  };

  const earnedTitleNames = new Set(titles.map(t => t.title));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* ── HOW THE SYSTEM WORKS ── */}
      <SystemPanel>
        <SectionHeader title="How the System Works" />
        <Text style={styles.bodyText}>
          Beyond is a real-life RPG. Every workout you complete earns you EXP.
          Accumulate EXP to level up. Reach certain levels to advance your rank.
          Your rank is a reflection of your total growth as a hunter.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subHeading}>EXP Formula</Text>
        <Text style={styles.bodyText}>
          Each exercise has an EXP rate you set — for example, 1 EXP per 10 reps.
          If you do 50 reps, you earn 5 EXP. The more you actually do, the more you earn.
        </Text>
        <View style={styles.formulaBox}>
          <Text style={styles.formulaText}>
            EXP = (amount ÷ unit count) × EXP value
          </Text>
          <Text style={styles.formulaExample}>
            50 reps ÷ 10 × 1 EXP = 5 EXP
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.subHeading}>Completing a Full Session</Text>
        <Text style={styles.bodyText}>
          If you complete every exercise in a session without skipping any, you receive a{' '}
          <Text style={styles.highlight}>10% bonus EXP</Text> on the entire session.
          Partial completion still earns EXP — just no bonus.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subHeading}>Missed Quest Penalty</Text>
        <Text style={styles.bodyText}>
          If you set a penalty on a plan and do not complete the quest that day,
          the penalty EXP is deducted the next morning when you open the app.
          EXP will not go below zero.
        </Text>
      </SystemPanel>

      {/* ── RANK PROGRESSION ── */}
      <SystemPanel>
        <SectionHeader title="Rank Progression" subtitle="How to advance your rank" />
        <Text style={styles.bodyText}>
          Your rank advances automatically when you reach the required level.
          You do not need to do anything special — just keep earning EXP and levelling up.
        </Text>

        <View style={styles.rankTable}>
          {RANKS.map((rank, i) => {
            const isCurrentRank = player ? getRankForLevel(player.level).rank === rank.rank : false;
            const isUnlocked    = player ? player.level >= rank.minLevel : false;
            const nextRank      = RANKS[i + 1];
            const expNeeded     = rank.minLevel > 1
              ? Array.from({ length: rank.minLevel - 1 }, (_, lvl) => expRequiredForLevel(lvl + 1))
                    .reduce((a, b) => a + b, 0)
              : 0;

            return (
              <View key={rank.rank}
                style={[styles.rankRow, isCurrentRank && styles.rankRowCurrent]}>
                {/* Rank letter */}
                <View style={[styles.rankBadge, { borderColor: rank.color }]}>
                  <Text style={[styles.rankLetter, { color: rank.color }]}>{rank.rank}</Text>
                </View>

                {/* Info */}
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankLabel, { color: isUnlocked ? rank.color : COLORS.textMuted }]}>
                    {rank.label}
                  </Text>
                  <Text style={styles.rankReq}>
                    Requires Level {rank.minLevel}
                    {nextRank ? `  →  Level ${nextRank.minLevel} for ${nextRank.rank}-Rank` : '  →  MAX RANK'}
                  </Text>
                </View>

                {/* Status icon */}
                <View style={styles.rankStatus}>
                  {isCurrentRank ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>YOU</Text>
                    </View>
                  ) : isUnlocked ? (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.accentGreen} />
                  ) : (
                    <Ionicons name="lock-closed" size={18} color={COLORS.textMuted} />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Current progress toward next rank */}
        {player && (() => {
          const currentRank = getRankForLevel(player.level);
          const nextRankEntry = RANKS.find(r => r.minLevel > player.level);
          if (!nextRankEntry) return (
            <View style={styles.maxRankBox}>
              <Text style={styles.maxRankText}>
                You have reached the maximum rank. The System acknowledges your supremacy.
              </Text>
            </View>
          );
          const levelsNeeded = nextRankEntry.minLevel - player.level;
          return (
            <View style={styles.progressBox}>
              <Text style={styles.progressTitle}>Progress to {nextRankEntry.rank}-Rank</Text>
              <Text style={styles.progressSub}>
                You are Level {player.level}. Reach Level {nextRankEntry.minLevel} to advance.
                {'\n'}{levelsNeeded} level{levelsNeeded !== 1 ? 's' : ''} remaining.
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {
                  width: `${((player.level - currentRank.minLevel) / (nextRankEntry.minLevel - currentRank.minLevel)) * 100}%` as any,
                  backgroundColor: nextRankEntry.color,
                }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressLabel, { color: currentRank.color }]}>
                  {currentRank.rank} (Lv {currentRank.minLevel})
                </Text>
                <Text style={[styles.progressLabel, { color: nextRankEntry.color }]}>
                  {nextRankEntry.rank} (Lv {nextRankEntry.minLevel})
                </Text>
              </View>
            </View>
          );
        })()}
      </SystemPanel>

      {/* ── LEVELLING GUIDE ── */}
      <SystemPanel>
        <SectionHeader title="Levelling Guide" subtitle="EXP needed per level" />
        <Text style={styles.bodyText}>
          The EXP required to complete each level follows the formula:{' '}
          <Text style={styles.highlight}>100 × level^1.5</Text>.
          Higher levels require significantly more EXP.
        </Text>

        <View style={styles.levelTable}>
          {[1, 5, 10, 20, 35, 50, 70, 90, 99].map(lvl => {
            const needed = expRequiredForLevel(lvl);
            const rank   = getRankForLevel(lvl);
            const isCurrentLevel = player?.level === lvl;
            return (
              <View key={lvl} style={[styles.levelRow, isCurrentLevel && styles.levelRowCurrent]}>
                <Text style={[styles.levelNum, { color: rank.color }]}>Lv {lvl}</Text>
                <Text style={styles.levelRank}>{rank.rank}</Text>
                <Text style={styles.levelExp}>{needed.toLocaleString()} EXP</Text>
              </View>
            );
          })}
        </View>
      </SystemPanel>

      {/* ── TITLES ── */}
      <SystemPanel>
        <SectionHeader
          title="All Titles"
          subtitle={`${earnedTitleNames.size} / ${TITLE_CONDITIONS.length} earned`}
        />
        <Text style={styles.bodyText}>
          Titles are awarded automatically when conditions are met.
          The most recently earned title is displayed on your player card.
        </Text>

        <View style={styles.titlesGrid}>
          {TITLE_CONDITIONS.map((cond) => {
            const earned = earnedTitleNames.has(cond.title);
            const earnedEntry = titles.find(t => t.title === cond.title);
            return (
              <View key={cond.title} style={[styles.titleCard, earned && styles.titleCardEarned]}>
                <View style={styles.titleCardTop}>
                  {earned ? (
                    <Ionicons name="ribbon" size={18} color={COLORS.accentGold} />
                  ) : (
                    <Ionicons name="ribbon-outline" size={18} color={COLORS.textMuted} />
                  )}
                  <Text style={[styles.titleName, earned && styles.titleNameEarned]}>
                    「{cond.title}」
                  </Text>
                </View>
                <Text style={[styles.titleDesc, !earned && styles.titleDescLocked]}>
                  {cond.description}
                </Text>
                {earned && earnedEntry && (
                  <Text style={styles.titleDate}>
                    Earned {new Date(earnedEntry.earned_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </Text>
                )}
                {!earned && (
                  <Text style={styles.titleLocked}>
                    <Ionicons name="lock-closed-outline" size={10} /> LOCKED
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </SystemPanel>

      {/* ── TIPS ── */}
      <SystemPanel>
        <SectionHeader title="Hunter Tips" />
        {[
          { icon: 'star-outline' as const, tip: 'Complete every exercise in a session for the 10% EXP bonus.' },
          { icon: 'add-circle-outline' as const, tip: 'Add bonus exercises to a completed session anytime — no penalty if skipped.' },
          { icon: 'calendar-outline' as const, tip: 'Set repeat days on plans to auto-generate quests each morning.' },
          { icon: 'warning-outline' as const, tip: 'Set penalty EXP on plans you take seriously to keep yourself accountable.' },
          { icon: 'trending-up-outline' as const, tip: 'Higher EXP per unit rewards intensity. Set rates that challenge you.' },
          { icon: 'medal-outline' as const, tip: 'Ranks advance automatically when you hit the required level. Keep grinding.' },
        ].map((item, i) => (
          <View key={i} style={styles.tipRow}>
            <Ionicons name={item.icon} size={18} color={COLORS.accentCyan} style={styles.tipIcon} />
            <Text style={styles.tipText}>{item.tip}</Text>
          </View>
        ))}
      </SystemPanel>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16, paddingBottom: 100 },

  bodyText:    { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  subHeading:  { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  highlight:   { color: COLORS.accentCyan, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: COLORS.borderDim, marginVertical: 14 },

  formulaBox: {
    backgroundColor: COLORS.bgTertiary, borderRadius: 8,
    padding: 12, borderLeftWidth: 3, borderLeftColor: COLORS.accentCyan, marginBottom: 8,
  },
  formulaText:    { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  formulaExample: { color: COLORS.textSecondary, fontSize: 12 },

  // Rank table
  rankTable:      { gap: 8, marginTop: 12 },
  rankRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderDim },
  rankRowCurrent: { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}08` },
  rankBadge:      { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rankLetter:     { fontSize: 14, fontWeight: '900' },
  rankInfo:       { flex: 1 },
  rankLabel:      { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  rankReq:        { color: COLORS.textMuted, fontSize: 11 },
  rankStatus:     { alignItems: 'center', justifyContent: 'center', width: 36 },
  currentBadge:   { backgroundColor: COLORS.accentCyan, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  currentBadgeText: { color: COLORS.bgPrimary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  progressBox:     { backgroundColor: COLORS.bgTertiary, borderRadius: 10, padding: 14, marginTop: 14 },
  progressTitle:   { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  progressSub:     { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  progressBarBg:   { height: 6, backgroundColor: COLORS.borderMain, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressLabels:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:   { fontSize: 11, fontWeight: '700' },

  maxRankBox:  { backgroundColor: `${COLORS.accentGold}15`, borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: COLORS.accentGold },
  maxRankText: { color: COLORS.accentGold, fontSize: 13, textAlign: 'center', fontWeight: '600' },

  // Level table
  levelTable:      { gap: 4, marginTop: 10 },
  levelRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: COLORS.borderDim },
  levelRowCurrent: { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}08` },
  levelNum:        { fontSize: 13, fontWeight: '800', width: 52 },
  levelRank:       { color: COLORS.textSecondary, fontSize: 12, width: 30 },
  levelExp:        { color: COLORS.textMuted, fontSize: 12, flex: 1, textAlign: 'right' },

  // Titles grid
  titlesGrid:      { gap: 10, marginTop: 10 },
  titleCard:       { backgroundColor: COLORS.bgTertiary, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.borderDim },
  titleCardEarned: { borderColor: COLORS.accentGold, backgroundColor: `${COLORS.accentGold}08` },
  titleCardTop:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  titleName:       { color: COLORS.textMuted, fontSize: 13, fontWeight: '700', flex: 1 },
  titleNameEarned: { color: COLORS.accentGold },
  titleDesc:       { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  titleDescLocked: { color: COLORS.textMuted },
  titleDate:       { color: COLORS.accentGold, fontSize: 10, marginTop: 6, fontWeight: '600' },
  titleLocked:     { color: COLORS.textMuted, fontSize: 10, marginTop: 5, fontWeight: '700', letterSpacing: 0.5 },

  // Tips
  tipRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim },
  tipIcon: { marginTop: 1 },
  tipText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
});

export default AboutScreen;