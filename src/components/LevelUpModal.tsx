/**
 * src/components/LevelUpModal.tsx
 * ================================
 * Full-screen animated level-up overlay.
 * Spring scales in → gold level number → rank-up transition (when the level
 * crossed a rank threshold) → rank badge → stat gains → stats → title.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, StyleSheet,
  Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getRankForLevel, STATS } from '../constants/game';
import { Player } from '../database/Database';

const { width } = Dimensions.get('window');

type Rank = ReturnType<typeof getRankForLevel>;

export interface LevelUpStatDelta { key: string; delta: number; }

interface Props {
  visible: boolean;
  player: Player;
  newTitle?: string;
  /** Set when this level-up crossed a rank threshold. */
  rankUp?: { from: Rank; to: Rank } | null;
  /** Positive stat gains earned this level-up. */
  statDeltas?: LevelUpStatDelta[];
  onClose: () => void;
}

const LevelUpModal: React.FC<Props> = ({ visible, player, newTitle, rankUp, statDeltas, onClose }) => {
  const scaleAnim   = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(0.5)).current;
  const rankScale   = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.4);
      opacityAnim.setValue(0);
      rankScale.setValue(0.6);
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start(() => {
        if (rankUp) {
          Animated.spring(rankScale, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
        }
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
          ])
        ).start();
      });
    }
    return () => pulseAnim.stopAnimation();
  }, [visible]);

  const rank = getRankForLevel(player.level);
  const gains = (statDeltas ?? []).filter(d => d.delta > 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Scan lines */}
        {[...Array(10)].map((_, i) => (
          <View key={i} style={[styles.scanLine, { top: `${i * 10}%` as any }]} />
        ))}

        <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], borderColor: rankUp ? rankUp.to.color : COLORS.accentCyan, shadowColor: rankUp ? rankUp.to.color : COLORS.accentCyan }]}>
          {/* Pulsing header */}
          <Animated.Text style={[styles.header, { opacity: pulseAnim, color: rankUp ? rankUp.to.color : COLORS.accentCyan }]}>
            ◆ LEVEL UP ◆
          </Animated.Text>

          {/* Big level number */}
          <Text style={styles.levelNum}>{player.level}</Text>
          <Text style={styles.levelLbl}>LEVEL</Text>

          {/* Rank transition (rank-up) or static rank chip */}
          {rankUp ? (
            <Animated.View style={[styles.rankUpRow, { transform: [{ scale: rankScale }] }]}>
              <View style={[styles.rankChip, styles.rankChipOld]}>
                <Text style={[styles.rankChipText, styles.rankChipTextOld]}>{rankUp.from.rank}-Rank</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={rankUp.to.color} />
              <View style={[styles.rankChip, { borderColor: rankUp.to.color }]}>
                <Text style={[styles.rankChipText, { color: rankUp.to.color }]}>{rankUp.to.label}</Text>
              </View>
            </Animated.View>
          ) : (
            <View style={[styles.rankChip, { borderColor: rank.color }]}>
              <Text style={[styles.rankChipText, { color: rank.color }]}>{rank.label}</Text>
            </View>
          )}

          {/* Stat gains */}
          {gains.length > 0 && (
            <View style={styles.gainRow}>
              {gains.map(g => {
                const s = STATS.find(x => x.key === g.key);
                return (
                  <View key={g.key} style={[styles.gainChip, { borderColor: s?.color ?? COLORS.accentCyan, backgroundColor: `${s?.color ?? COLORS.accentCyan}15` }]}>
                    <Text style={[styles.gainTxt, { color: s?.color ?? COLORS.accentCyan }]}>+{g.delta} {g.key.slice(0, 3).toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.divider} />

          {/* Stats */}
          <Text style={styles.statsHdr}>— STATUS —</Text>
          <View style={styles.statsGrid}>
            {STATS.map(s => (
              <View key={s.key} style={styles.statItem}>
                <Ionicons name={s.icon} size={15} color={s.color} />
                <Text style={styles.statLbl}>{s.label}</Text>
                <Text style={[styles.statVal, { color: s.color }]}>{(player as any)[s.key]}</Text>
              </View>
            ))}
          </View>

          {/* New title */}
          {newTitle && (
            <View style={styles.titleBox}>
              <Text style={styles.titleBoxLbl}>NEW TITLE ACQUIRED</Text>
              <Text style={styles.titleBoxText}>「{newTitle}」</Text>
            </View>
          )}

          <TouchableOpacity style={styles.continueBtn} onPress={onClose}>
            <View style={styles.continueRow}>
              <Text style={styles.continueTxt}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.accentCyan} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', alignItems: 'center', justifyContent: 'center' },
  scanLine:    { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: `${COLORS.accentCyan}12` },
  card: {
    backgroundColor: COLORS.bgPanel, borderWidth: 1, borderColor: COLORS.accentCyan,
    borderRadius: 16, padding: 28, width: width * 0.87, alignItems: 'center',
    shadowColor: COLORS.accentCyan, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 20,
  },
  header:      { color: COLORS.accentCyan, fontSize: 12, fontWeight: '700', letterSpacing: 4, marginBottom: 16 },
  levelNum:    { color: COLORS.accentGold, fontSize: 80, fontWeight: '900', lineHeight: 88 },
  levelLbl:    { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 3, marginBottom: 12 },
  rankChip:    { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 18 },
  rankChipText:{ fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  rankUpRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  rankChipOld: { borderColor: COLORS.textMuted, opacity: 0.7 },
  rankChipTextOld: { color: COLORS.textMuted },
  gainRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 },
  gainChip:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  gainTxt:     { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  divider:     { width: '100%', height: 1, backgroundColor: COLORS.borderMain, marginBottom: 14 },
  statsHdr:    { color: COLORS.textMuted, fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 10 },
  statsGrid:   { width: '100%', gap: 6, marginBottom: 14 },
  statItem:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  statLbl:     { color: COLORS.textSecondary, fontSize: 12, flex: 1, textTransform: 'uppercase', letterSpacing: 0.4 },
  statVal:     { fontSize: 14, fontWeight: '700' },
  titleBox:    { width: '100%', backgroundColor: `${COLORS.accentGold}15`, borderWidth: 1, borderColor: COLORS.accentGold, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 14 },
  titleBoxLbl: { color: COLORS.accentGold, fontSize: 9, letterSpacing: 2, fontWeight: '700', marginBottom: 4 },
  titleBoxText:{ color: COLORS.accentGold, fontSize: 15, fontWeight: '700' },
  continueBtn: { borderWidth: 1, borderColor: COLORS.accentCyan, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 40 },
  continueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueTxt: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 3 },
});

export default LevelUpModal;
