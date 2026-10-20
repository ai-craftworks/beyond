/**
 * src/components/WorkoutRow.tsx
 * =============================
 * The canonical workout/exercise list row, shared by every surface
 * (exercise library, workout picker, plan editor, tagged workouts, session
 * quests, group members). Two lines — name + EXP badge, then a muted meta
 * line — inside a bordered card with a 3px accent bar.
 *
 * Context-specific pieces (leading indicator, trailing action, selection /
 * completion states, footer hint) are passed in, so the shell and typography
 * stay identical everywhere while each screen keeps its own behaviour.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../constants/game';
import { hapticTap } from '../utils/haptics';

export type WorkoutRowState = 'default' | 'selected' | 'done' | 'dimmed' | 'pending';

/**
 * The canonical EXP pill — used inside WorkoutRow and anywhere EXP is shown
 * next to a line item (e.g. the profile session history breakdown).
 */
export const ExpBadge: React.FC<{ text: string; color?: string; style?: StyleProp<ViewStyle> }> = ({ text, color = COLORS.accentCyan, style }) => (
  <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}12` }, style]}>
    <Text style={[styles.badgeTxt, { color }]} numberOfLines={1}>{text}</Text>
  </View>
);

export interface WorkoutRowProps {
  title: string;
  /** Muted single-line meta under the name (stat · body parts, sets × target…). */
  meta?: string;
  /** Inline nodes after the meta (group colour dots). */
  metaAccessory?: React.ReactNode;
  /** Extra content under the meta (e.g. the session "tap to log" hint). */
  footer?: React.ReactNode;
  /** Left accent bar colour (category/stat). */
  accent?: string;
  /** EXP badge text; omitted → no badge. */
  exp?: string;
  /** Badge colour — cyan default, green for done, gold for bonus. */
  badgeColor?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  state?: WorkoutRowState;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const WorkoutRow: React.FC<WorkoutRowProps> = ({
  title, meta, metaAccessory, footer, accent, exp, badgeColor,
  leading, trailing, state = 'default', onPress, onLongPress, style,
}) => {
  const badge = badgeColor ?? COLORS.accentCyan;

  const shell: StyleProp<ViewStyle> = [
    styles.row,
    state === 'selected' && { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}12` },
    state === 'done' && { borderColor: COLORS.accentGreen, backgroundColor: `${COLORS.accentGreen}07` },
    state === 'dimmed' && { borderColor: `${COLORS.accentGreen}66`, backgroundColor: `${COLORS.accentGreen}0D`, opacity: 0.8 },
    state === 'pending' && { opacity: 0.9 },
    // After the state styles so the category bar survives the border override.
    { borderLeftColor: accent ?? COLORS.borderMain },
    style,
  ];

  const body = (
    <>
      {!!leading && <View style={styles.leading}>{leading}</View>}
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[styles.name, state === 'done' && styles.nameDone, state === 'pending' && styles.nameMuted]} numberOfLines={1}>{title}</Text>
          {!!exp && <ExpBadge text={exp} color={badge} />}
          {!!trailing && <View style={styles.trailing}>{trailing}</View>}
        </View>
        {(!!meta || !!metaAccessory) && (
          <View style={styles.metaWrap}>
            {!!meta && <Text style={styles.meta} numberOfLines={1}>{meta}</Text>}
            {metaAccessory}
          </View>
        )}
        {footer}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={shell} accessible accessibilityLabel={`${title}${meta ? `, ${meta}` : ''}`}>
        {body}
      </View>
    );
  }
  return (
    <TouchableOpacity style={shell} activeOpacity={0.8}
      onPress={() => { hapticTap(); onPress(); }}
      onLongPress={onLongPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${title}${meta ? `, ${meta}` : ''}`}>
      {body}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderLeftWidth: 3, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  leading:  { alignItems: 'center', justifyContent: 'center' },
  body:     { flex: 1 },
  topLine:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:     { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  nameDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  nameMuted:{ color: COLORS.textMuted },
  badge:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },

  metaWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  meta:     { flex: 1, color: COLORS.textMuted, fontSize: 11 },
});

export default WorkoutRow;
