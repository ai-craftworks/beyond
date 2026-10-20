/**
 * src/components/SessionClearModal.tsx
 * ====================================
 * "QUEST CLEAR" summary shown after every session finish. The level-up
 * modal (when applicable) rises on top of this one — dismissing it lands
 * here, and Continue exits the quest. Makes every finish a moment, with
 * level-up as the crown rather than the only celebration.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import type { BeltPromotion } from '../database/Database';

const { width } = Dimensions.get('window');

export interface StatGain { key: string; label: string; color: string; delta: number; }

export interface SessionClearData {
  totalExp: number;
  mainExp: number;        // raw main-exercise EXP (before full-clear bonus)
  fullClearAmount: number; // 0 when not a full clear
  bonusExp: number;
  statGains: StatGain[];
  title?: string;
  streak: { current: number; best: number };
  newBestStreak: boolean;
  prs: { name: string; detail: string }[];
  belts: BeltPromotion[];
}

interface Props {
  visible: boolean;
  data: SessionClearData | null;
  onClose: () => void;
}

const SessionClearModal: React.FC<Props> = ({ visible, data, onClose }) => {
  const scaleAnim   = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!data) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.header}>◆ QUEST CLEAR ◆</Text>

          {/* EXP breakdown */}
          <View style={styles.expPanel}>
            <View style={styles.expRow}>
              <Text style={styles.expLbl}>Quest EXP</Text>
              <Text style={styles.expVal}>+{data.mainExp}</Text>
            </View>
            {data.fullClearAmount > 0 && (
              <View style={styles.expRow}>
                <Text style={[styles.expLbl, { color: COLORS.accentGold }]}>Full-clear bonus</Text>
                <Text style={[styles.expVal, { color: COLORS.accentGold }]}>+{data.fullClearAmount}</Text>
              </View>
            )}
            {data.bonusExp > 0 && (
              <View style={styles.expRow}>
                <Text style={styles.expLbl}>Bonus quests</Text>
                <Text style={styles.expVal}>+{data.bonusExp}</Text>
              </View>
            )}
            <View style={styles.expDivider} />
            <View style={styles.expRow}>
              <Text style={styles.totalLbl}>TOTAL</Text>
              <Text style={styles.totalVal}>+{data.totalExp} EXP</Text>
            </View>
          </View>

          {/* Stat gains */}
          {data.statGains.length > 0 && (
            <View style={styles.chipRow}>
              {data.statGains.map(g => (
                <View key={g.key} style={[styles.statChip, { borderColor: g.color, backgroundColor: `${g.color}15` }]}>
                  <Text style={[styles.statChipTxt, { color: g.color }]}>+{g.delta} {g.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Streak */}
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={15} color={data.newBestStreak ? COLORS.accentGold : COLORS.textSecondary} />
            <Text style={[styles.streakTxt, data.newBestStreak && { color: COLORS.accentGold }]}>
              {data.streak.current}-day streak
            </Text>
            {data.newBestStreak && (
              <View style={styles.bestChip}>
                <Text style={styles.bestChipTxt}>NEW BEST · {data.streak.best}</Text>
              </View>
            )}
          </View>

          {/* Personal records */}
          {data.prs.map((pr, i) => (
            <View key={i} style={styles.prRow}>
              <Ionicons name="star" size={13} color={COLORS.accentGold} />
              <Text style={styles.prTxt}>New PR — {pr.name}: {pr.detail}</Text>
            </View>
          ))}

          {/* Belt promotions */}
          {data.belts.map((b, i) => (
            <View key={i} style={styles.prRow}>
              <Ionicons name="ribbon" size={13} color={COLORS.accentGreen} />
              <Text style={[styles.prTxt, { color: COLORS.accentGreen }]}>{b.name}: {b.from} → {b.to} Belt</Text>
            </View>
          ))}

          {/* Title */}
          {data.title && (
            <View style={styles.titleBox}>
              <Text style={styles.titleBoxLbl}>NEW TITLE ACQUIRED</Text>
              <Text style={styles.titleBoxText}>「{data.title}」</Text>
            </View>
          )}

          <TouchableOpacity style={styles.continueBtn} onPress={onClose}>
            <View style={styles.continueRow}>
              <Text style={styles.continueTxt}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.accentGreen} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.bgPanel, borderWidth: 1, borderColor: COLORS.accentGreen,
    borderRadius: 16, padding: 24, width: width * 0.87,
    shadowColor: COLORS.accentGreen, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 16,
  },
  header:     { color: COLORS.accentGreen, fontSize: 12, fontWeight: '700', letterSpacing: 4, textAlign: 'center', marginBottom: 16 },

  expPanel:   { width: '100%', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 12, marginBottom: 12 },
  expRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  expLbl:     { color: COLORS.textSecondary, fontSize: 12 },
  expVal:     { color: COLORS.accentCyan, fontSize: 12, fontWeight: '700' },
  expDivider: { height: 1, backgroundColor: COLORS.borderMain, marginVertical: 5 },
  totalLbl:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  totalVal:   { color: COLORS.accentGreen, fontSize: 15, fontWeight: '800' },

  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 },
  statChip:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statChipTxt:{ fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  streakRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  streakTxt:  { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  bestChip:   { backgroundColor: `${COLORS.accentGold}18`, borderWidth: 1, borderColor: COLORS.accentGold, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  bestChipTxt:{ color: COLORS.accentGold, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  prRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 5 },
  prTxt:      { color: COLORS.accentGold, fontSize: 12, fontWeight: '600' },

  titleBox:   { width: '100%', backgroundColor: `${COLORS.accentGold}15`, borderWidth: 1, borderColor: COLORS.accentGold, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 6, marginBottom: 12 },
  titleBoxLbl:{ color: COLORS.accentGold, fontSize: 9, letterSpacing: 2, fontWeight: '700', marginBottom: 3 },
  titleBoxText:{ color: COLORS.accentGold, fontSize: 14, fontWeight: '700' },

  continueBtn:{ borderWidth: 1, borderColor: COLORS.accentGreen, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 40, marginTop: 4, alignSelf: 'center' },
  continueRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueTxt:{ color: COLORS.accentGreen, fontSize: 13, fontWeight: '700', letterSpacing: 3 },
});

export default SessionClearModal;
