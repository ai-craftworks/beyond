/**
 * src/components/ActionBar.tsx
 * =============================
 * A pinned action row: the primary action of a screen or a sheet that has to
 * stay reachable no matter how far the content scrolls.
 *
 * Always render it as a SIBLING of the scroll view, never inside it — that is
 * the whole point. `FilterSheet` and `DropdownModal` already keep their
 * footers outside the scroll view; this is the same idea, reusable.
 *
 * Two layouts:
 *   - horizontal (default) — status on the left, buttons on the right.
 *   - stacked              — status on its own row, buttons full width below.
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle,
} from 'react-native';
import { COLORS } from '../constants/game';

export interface ActionBarSecondary {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export interface ActionBarProps {
  /** Uppercase status line on the left. */
  label?: string;
  /** Optional second line under `label`. */
  hint?: string;
  /** Compact action rendered at the end of the info row. */
  secondary?: ActionBarSecondary;
  /** Put the buttons on their own full-width row under the info row. */
  stacked?: boolean;
  /** The action buttons. */
  children: React.ReactNode;
  /** Style for the bar container (background, padding, borders). */
  style?: StyleProp<ViewStyle>;
  /** Style for the button row. */
  actionsStyle?: StyleProp<ViewStyle>;
}

const ActionBar: React.FC<ActionBarProps> = ({
  label, hint, secondary, stacked, children, style, actionsStyle,
}) => {
  const hasInfo = !!label || !!hint || !!secondary;

  const info = hasInfo ? (
    <View style={[styles.info, stacked && styles.infoStack]}>
      <View style={styles.infoText}>
        {!!label && <Text style={styles.label} numberOfLines={1}>{label}</Text>}
        {!!hint && <Text style={styles.hint} numberOfLines={1}>{hint}</Text>}
      </View>
      {!!secondary && (
        <TouchableOpacity
          style={[styles.secondaryBtn, secondary.disabled && styles.secondaryOff]}
          onPress={secondary.onPress}
          disabled={secondary.disabled}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={secondary.label}
        >
          <Text style={styles.secondaryTxt} numberOfLines={1}>{secondary.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  if (stacked) {
    return (
      <View style={[styles.bar, styles.barStack, style]}>
        {info}
        <View style={[styles.actions, actionsStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.bar, style]}>
      {info}
      <View style={[styles.actions, !hasInfo && styles.actionsGrow, actionsStyle]}>{children}</View>
    </View>
  );
};

// ── Styles ───────────────────────────────────

const styles = StyleSheet.create({
  bar:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barStack:    { flexDirection: 'column', alignItems: 'stretch', gap: 10 },

  info:        { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoStack:   { flexGrow: 0, flexShrink: 0, alignSelf: 'stretch' },
  infoText:    { flex: 1, minWidth: 0 },
  label:       { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  hint:        { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  secondaryBtn:{ borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  secondaryTxt:{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  secondaryOff:{ opacity: 0.4 },

  actions:     { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  actionsGrow: { flexGrow: 1 },
});

export default ActionBar;
