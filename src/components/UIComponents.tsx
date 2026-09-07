/**
 * src/components/UIComponents.tsx
 * =================================
 * Reusable Solo Leveling-themed UI components used across all screens.
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { percentOf } from '../constants/formulas';

export type IonName = React.ComponentProps<typeof Ionicons>['name'];

// ── SystemPanel ───────────────────────────────

interface PanelProps { children: React.ReactNode; style?: ViewStyle; glow?: boolean; }

export const SystemPanel: React.FC<PanelProps> = ({ children, style, glow }) => (
  <View style={[styles.panel, glow && styles.panelGlow, style]}>{children}</View>
);

// ── SystemButton ─────────────────────────────

interface BtnProps {
  title: string; onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean; loading?: boolean;
  icon?: IonName;
  style?: ViewStyle; textStyle?: TextStyle;
}

export const SystemButton: React.FC<BtnProps> = ({
  title, onPress, variant = 'primary', disabled, loading, icon, style, textStyle,
}) => {
  const bg   = { primary: COLORS.accentCyan, secondary: COLORS.accentBlue, danger: COLORS.accentRed, ghost: 'transparent' }[variant];
  const clr  = variant === 'ghost' ? COLORS.accentCyan : '#0A0E1A';
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg }, variant === 'ghost' && styles.btnGhost, disabled && styles.btnDisabled, style]}
      onPress={onPress} disabled={disabled || loading} activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator color={clr} size="small" />
        : (
          <View style={styles.btnRow}>
            {icon && <Ionicons name={icon} size={16} color={clr} />}
            <Text style={[styles.btnText, { color: clr }, textStyle]}>{title}</Text>
          </View>
        )}
    </TouchableOpacity>
  );
};

// ── SystemInput ──────────────────────────────

interface InputProps {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean; style?: ViewStyle;
}

export const SystemInput: React.FC<InputProps> = ({
  label, value, onChangeText, placeholder, keyboardType = 'default', multiline, style,
}) => (
  <View style={[styles.inputWrap, style]}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
      value={value} onChangeText={onChangeText}
      placeholder={placeholder ?? label} placeholderTextColor={COLORS.textMuted}
      keyboardType={keyboardType} multiline={multiline} numberOfLines={multiline ? 3 : 1}
    />
  </View>
);

// ── SectionHeader ────────────────────────────

interface SecHdrProps {
  title: string; subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export const SectionHeader: React.FC<SecHdrProps> = ({ title, subtitle, action }) => (
  <View style={styles.secHdr}>
    <View>
      <Text style={styles.secTitle}>{title}</Text>
      {subtitle && <Text style={styles.secSub}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action.onPress}>
        <Text style={styles.secAction}>{action.label}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ── StatRow ──────────────────────────────────

interface StatRowProps {
  icon: IonName; label: string; value: number; color: string;
  showBar?: boolean; maxValue?: number;
}

export const StatRow: React.FC<StatRowProps> = ({ icon, label, value, color, showBar, maxValue = 100 }) => (
  <View style={styles.statRow}>
    <Ionicons name={icon} size={16} color={color} style={styles.statIcon} />
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.statRight}>
      {showBar && (
        <View style={styles.statBarBg}>
          <View style={[styles.statBarFill, { width: `${percentOf(value, maxValue)}%` as any, backgroundColor: color }]} />
        </View>
      )}
      <Text style={[styles.statVal, { color }]}>{value}</Text>
    </View>
  </View>
);

// ── ExpBar ───────────────────────────────────

interface ExpBarProps { current: number; max: number; }

export const ExpBar: React.FC<ExpBarProps> = ({ current, max }) => {
  const pct = percentOf(current, max);
  return (
    <View style={styles.expWrap}>
      <View style={styles.expRow}>
        <Text style={styles.expLbl}>EXP</Text>
        <Text style={styles.expNums}>{current} / {max}</Text>
      </View>
      <View style={styles.expBg}>
        <View style={[styles.expFill, { width: `${pct}%` as any }]} />
      </View>
    </View>
  );
};

// ── RankBadge ────────────────────────────────

export const RankBadge: React.FC<{ rank: string; color: string; small?: boolean }> = ({ rank, color, small }) => (
  <View style={[styles.badge, { borderColor: color }, small && styles.badgeSmall]}>
    <Text style={[styles.badgeText, { color }, small && styles.badgeTextSmall]}>{rank}</Text>
  </View>
);

// ── EmptyState ───────────────────────────────

export const EmptyState: React.FC<{ icon?: IonName; title: string; subtitle?: string }> = ({ icon = 'mail-unread', title, subtitle }) => (
  <View style={styles.empty}>
    <Ionicons name={icon} size={38} color={COLORS.textMuted} style={{ marginBottom: 10 }} />
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySub}>{subtitle}</Text>}
  </View>
);

// ── Styles ───────────────────────────────────

const styles = StyleSheet.create({
  panel:        { backgroundColor: COLORS.bgSecondary, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderMain, padding: 16, marginBottom: 12 },
  panelGlow:    { borderColor: COLORS.accentCyan, shadowColor: COLORS.accentCyan, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 10 },

  btn:          { borderRadius: 8, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  btnRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnGhost:     { borderWidth: 1, borderColor: COLORS.accentCyan },
  btnDisabled:  { opacity: 0.4 },
  btnText:      { fontSize: 14, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

  inputWrap:    { marginBottom: 14 },
  inputLabel:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input:        { backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, color: COLORS.textPrimary, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11 },
  inputMulti:   { height: 80, textAlignVertical: 'top' },

  secHdr:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  secTitle:     { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  secSub:       { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  secAction:    { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600' },

  statRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim },
  statIcon:     { width: 26, textAlign: 'center' },
  statLabel:    { color: COLORS.textSecondary, fontSize: 12, flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  statRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statBarBg:    { width: 72, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, overflow: 'hidden' },
  statBarFill:  { height: '100%', borderRadius: 2 },
  statVal:      { fontSize: 14, fontWeight: '700', minWidth: 30, textAlign: 'right' },

  expWrap:      { marginTop: 4 },
  expRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  expLbl:       { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  expNums:      { color: COLORS.accentCyan, fontSize: 11, fontWeight: '600' },
  expBg:        { height: 6, backgroundColor: COLORS.borderMain, borderRadius: 3, overflow: 'hidden' },
  expFill:      { height: '100%', backgroundColor: COLORS.accentCyan, borderRadius: 3 },

  badge:        { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 3, alignItems: 'center' },
  badgeSmall:   { paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:    { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  badgeTextSmall: { fontSize: 10 },

  empty:        { alignItems: 'center', paddingVertical: 40 },
  emptyTitle:   { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptySub:     { color: COLORS.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' },
});
