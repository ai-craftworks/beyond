/**
 * src/components/LevelUpModal.tsx
 * ================================
 * Full-screen animated level-up overlay.
 * Spring scales in → gold level number → rank badge → stats → optional title.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, StyleSheet,
  Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import { COLORS, getRankForLevel, STATS } from '../constants/game';
import { Player } from '../database/Database';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  player: Player;
  newTitle?: string;
  onClose: () => void;
}

const LevelUpModal: React.FC<Props> = ({ visible, player, newTitle, onClose }) => {
  const scaleAnim   = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.4);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
          ])
        ).start();
      });
    }
  }, [visible]);

  const rank = getRankForLevel(player.level);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Scan lines */}
        {[...Array(10)].map((_, i) => (
          <View key={i} style={[styles.scanLine, { top: `${i * 10}%` as any }]} />
        ))}

        <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Pulsing header */}
          <Animated.Text style={[styles.header, { opacity: pulseAnim }]}>
            ◆ LEVEL UP ◆
          </Animated.Text>

          {/* Big level number */}
          <Text style={styles.levelNum}>{player.level}</Text>
          <Text style={styles.levelLbl}>LEVEL</Text>

          {/* Rank */}
          <View style={[styles.rankChip, { borderColor: rank.color }]}>
            <Text style={[styles.rankChipText, { color: rank.color }]}>{rank.label}</Text>
          </View>

          <View style={styles.divider} />

          {/* Stats */}
          <Text style={styles.statsHdr}>— STATUS —</Text>
          <View style={styles.statsGrid}>
            {STATS.map(s => (
              <View key={s.key} style={styles.statItem}>
                <Text style={styles.statIcon}>{s.icon}</Text>
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
            <Text style={styles.continueTxt}>CONTINUE ▶</Text>
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
  divider:     { width: '100%', height: 1, backgroundColor: COLORS.borderMain, marginBottom: 14 },
  statsHdr:    { color: COLORS.textMuted, fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 10 },
  statsGrid:   { width: '100%', gap: 6, marginBottom: 14 },
  statItem:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  statIcon:    { fontSize: 15, width: 22 },
  statLbl:     { color: COLORS.textSecondary, fontSize: 12, flex: 1, textTransform: 'uppercase', letterSpacing: 0.4 },
  statVal:     { fontSize: 14, fontWeight: '700' },
  titleBox:    { width: '100%', backgroundColor: `${COLORS.accentGold}15`, borderWidth: 1, borderColor: COLORS.accentGold, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 14 },
  titleBoxLbl: { color: COLORS.accentGold, fontSize: 9, letterSpacing: 2, fontWeight: '700', marginBottom: 4 },
  titleBoxText:{ color: COLORS.accentGold, fontSize: 15, fontWeight: '700' },
  continueBtn: { borderWidth: 1, borderColor: COLORS.accentCyan, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 40 },
  continueTxt: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 3 },
});

export default LevelUpModal;
