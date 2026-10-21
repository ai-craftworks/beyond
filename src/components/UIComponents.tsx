/**
 * src/components/UIComponents.tsx
 * =================================
 * Reusable Solo Leveling-themed UI components used across all screens.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal, ScrollView,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { percentOf } from '../utils/math';
import { playSound } from '../utils/sounds';
import { hapticTap, hapticWarning } from '../utils/haptics';

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
      onPress={() => {
        playSound('click');
        if (variant === 'danger') hapticWarning(); else hapticTap();
        onPress();
      }}
      disabled={disabled || loading} activeOpacity={0.75}
      accessible
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
    >
      {loading
        ? <ActivityIndicator color={clr} size="small" />
        : (
          <View style={styles.btnRow}>
            {icon && <Ionicons name={icon} size={16} color={clr} />}
            <Text style={[styles.btnText, { color: clr }, textStyle]} numberOfLines={1}>{title}</Text>
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

// ── SystemDropdown / SystemMultiDropdown ─────

export interface DropdownOption { value: string; label: string; color?: string; }

interface DropdownModalProps {
  visible: boolean; title: string; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode;
}

const DropdownModal: React.FC<DropdownModalProps> = ({ visible, title, onClose, children, footer }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.dropOverlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.dropSheet} onPress={() => {}}>
        <View style={styles.dropHdr}>
          <Text style={styles.dropTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.dropList} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer && <View style={styles.dropFooter}>{footer}</View>}
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

interface DropdownProps {
  label: string; options: readonly DropdownOption[]; value: string;
  onChange: (v: string) => void; placeholder?: string; style?: ViewStyle;
}

export const SystemDropdown: React.FC<DropdownProps> = ({
  label, options, value, onChange, placeholder = 'Select...', style,
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={[styles.dropWrap, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropTrigger} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <View style={styles.dropTriggerMain}>
          {selected?.color && <View style={[styles.optDot, { backgroundColor: selected.color }]} />}
          <Text style={[styles.dropValue, !selected && styles.dropPlaceholder]} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <DropdownModal visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map(o => (
          <TouchableOpacity key={o.value} style={styles.dropOption}
            onPress={() => { onChange(o.value); setOpen(false); }}>
            <View style={styles.dropOptionMain}>
              {o.color && <View style={[styles.optDot, { backgroundColor: o.color }]} />}
              <Text style={[styles.dropOptionTxt, o.value === value && styles.dropOptionTxtOn]} numberOfLines={1}>{o.label}</Text>
            </View>
            {o.value === value && <Ionicons name="checkmark" size={16} color={COLORS.accentCyan} />}
          </TouchableOpacity>
        ))}
      </DropdownModal>
    </View>
  );
};

interface MultiDropdownProps {
  label: string; options: readonly DropdownOption[]; values: string[];
  onChange: (v: string[]) => void; placeholder?: string; style?: ViewStyle;
}

export const SystemMultiDropdown: React.FC<MultiDropdownProps> = ({
  label, options, values, onChange, placeholder = 'Any', style,
}) => {
  const [open, setOpen] = useState(false);
  const summary = values.length === 0
    ? placeholder
    : values.length === 1
      ? (options.find(o => o.value === values[0])?.label ?? values[0])
      : `${values.length} selected`;
  const soleColor = values.length === 1 ? options.find(o => o.value === values[0])?.color : undefined;
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  return (
    <View style={[styles.dropWrap, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropTrigger} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <View style={styles.dropTriggerMain}>
          {soleColor && <View style={[styles.optDot, { backgroundColor: soleColor }]} />}
          <Text style={[styles.dropValue, values.length === 0 && styles.dropPlaceholder]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <DropdownModal
        visible={open} title={label} onClose={() => setOpen(false)}
        footer={
          <>
            <TouchableOpacity style={styles.dropFooterBtn} onPress={() => onChange([])}>
              <Text style={styles.dropFooterTxt}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropFooterBtn} onPress={() => setOpen(false)}>
              <Text style={[styles.dropFooterTxt, styles.dropFooterTxtOn]}>Done</Text>
            </TouchableOpacity>
          </>
        }
      >
        {options.map(o => {
          const on = values.includes(o.value);
          return (
            <TouchableOpacity key={o.value} style={styles.dropOption} onPress={() => toggle(o.value)}>
              <View style={styles.dropOptionMain}>
                {o.color && <View style={[styles.optDot, { backgroundColor: o.color }]} />}
                <Text style={[styles.dropOptionTxt, on && styles.dropOptionTxtOn]} numberOfLines={1}>{o.label}</Text>
              </View>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16}
                color={on ? COLORS.accentCyan : COLORS.textMuted} />
            </TouchableOpacity>
          );
        })}
      </DropdownModal>
    </View>
  );
};

// ── SectionHeader ────────────────────────────

interface SecHdrProps {
  title: string; subtitle?: string;
  action?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

export const SectionHeader: React.FC<SecHdrProps> = ({ title, subtitle, action, secondary }) => (
  <View style={styles.secHdr}>
    <View style={styles.secHdrLeft}>
      <Text style={styles.secTitle}>{title}</Text>
      {subtitle && <Text style={styles.secSub}>{subtitle}</Text>}
    </View>
    <View style={styles.secHdrActions}>
      {secondary && (
        <TouchableOpacity
          onPress={() => secondary.onPress()}
          accessibilityRole="button"
          accessibilityLabel={`${secondary.label} — ${title}`}
        >
          <Text style={styles.secActionAlt}>{secondary.label}</Text>
        </TouchableOpacity>
      )}
      {action && (
        <TouchableOpacity
          onPress={() => action.onPress()}
          accessibilityRole="button"
          accessibilityLabel={`${action.label} — ${title}`}
        >
          <Text style={styles.secAction}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// ── FilterSheet ──────────────────────────────

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  title?: string;
  children: React.ReactNode;
}

/** Themed bottom sheet that hosts a screen's filter controls. */
export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible, onClose, onReset, title = 'Filters', children,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.filterSheet} onPress={() => {}}>
        <View style={styles.filterHandle} />
        <View style={styles.filterHdr}>
          <Text style={styles.filterTitle}>◆ {title.toUpperCase()}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.filterBody} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}>
          {children}
        </ScrollView>
        <View style={styles.filterFooter}>
          <TouchableOpacity style={[styles.filterBtn, styles.filterReset]}
            onPress={onReset} activeOpacity={0.75}>
            <Text style={styles.filterResetTxt}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, styles.filterApply]}
            onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.filterApplyTxt}>Apply</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

interface FilterSectionProps { label: string; children: React.ReactNode; }

/** A labelled block of filter chips inside a FilterSheet. */
export const FilterSection: React.FC<FilterSectionProps> = ({ label, children }) => (
  <View style={styles.filterSection}>
    <Text style={styles.filterSectionLbl}>{label}</Text>
    <View style={styles.filterSectionRow}>{children}</View>
  </View>
);

interface FilterChipProps {
  label: string; active: boolean; onPress: () => void; color?: string;
}

/** Selectable pill chip used inside FilterSection. */
export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress, color }) => {
  const c = color ?? COLORS.accentCyan;
  return (
    <TouchableOpacity
      style={[styles.fChip, active && { borderColor: c, backgroundColor: `${c}22` }]}
      onPress={onPress} activeOpacity={0.75}
    >
      {color && <View style={[styles.fChipDot, { backgroundColor: active ? c : COLORS.textMuted }]} />}
      <Text style={[styles.fChipTxt, active && { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
};

interface FilterButtonProps { count: number; onPress: () => void; }

/** The funnel button shown at the right of a search row; shows an active-filter count. */
export const FilterButton: React.FC<FilterButtonProps> = ({ count, onPress }) => (
  <TouchableOpacity style={styles.filterTrigger} onPress={onPress}
    activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    accessibilityRole="button"
    accessibilityLabel={count > 0 ? `Filters, ${count} active` : 'Filters'}>
    <Ionicons name="options-outline" size={20} color={count > 0 ? COLORS.accentCyan : COLORS.textSecondary} />
    {count > 0 && (
      <View style={styles.filterBadge}><Text style={styles.filterBadgeTxt}>{count}</Text></View>
    )}
  </TouchableOpacity>
);

// ── StatRow ──────────────────────────────────

interface StatRowProps {
  icon: IonName; label: string; value: number; color: string;
  showBar?: boolean; maxValue?: number;
  progress?: number;   // 0..1 — overrides value/maxValue for the bar fill
  valueText?: string;  // overrides the displayed value text
}

export const StatRow: React.FC<StatRowProps> = ({
  icon, label, value, color, showBar, maxValue = 100, progress, valueText,
}) => {
  const fill = progress != null
    ? Math.min(Math.max(progress, 0), 1) * 100
    : percentOf(value, maxValue);
  return (
    <View style={styles.statRow}>
      <Ionicons name={icon} size={16} color={color} style={styles.statIcon} />
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRight}>
        {showBar && (
          <View style={styles.statBarBg}>
            <View style={[styles.statBarFill, { width: `${fill}%` as any, backgroundColor: color }]} />
          </View>
        )}
        <Text style={[styles.statVal, { color }]}>{valueText ?? value}</Text>
      </View>
    </View>
  );
};

// ── ExpBar ───────────────────────────────────

interface ExpBarProps { current: number; max: number; animated?: boolean; }

export const ExpBar: React.FC<ExpBarProps> = ({ current, max, animated }) => {
  const pct = percentOf(current, max);
  // Animated mode eases the fill toward its new value (used on the Dashboard
  // so returning from a quest visibly fills the bar).
  const fill = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    if (animated) {
      Animated.timing(fill, { toValue: pct, duration: 500, useNativeDriver: false }).start();
    }
  }, [pct, animated]);
  const width = animated
    ? fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
    : `${pct}%`;
  return (
    <View style={styles.expWrap}>
      <View style={styles.expRow}>
        <Text style={styles.expLbl}>EXP</Text>
        <Text style={styles.expNums}>{current} / {max}</Text>
      </View>
      <View style={styles.expBg}>
        {animated
          ? <Animated.View style={[styles.expFill, { width } as any]} />
          : <View style={[styles.expFill, { width: `${pct}%` as any }]} />}
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

// ── SegmentedTabs ────────────────────────────

export interface SegmentedTabItem { key: string; label: string; icon?: IonName; }

export const SegmentedTabs: React.FC<{
  tabs: SegmentedTabItem[];
  value: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
}> = ({ tabs, value, onChange, style }) => (
  <View style={[styles.segRow, style]}>
    {tabs.map(t => {
      const on = t.key === value;
      return (
        <TouchableOpacity
          key={t.key}
          style={[styles.segBtn, on && styles.segBtnOn]}
          onPress={() => onChange(t.key)}
          activeOpacity={0.8}
        >
          {!!t.icon && (
            <Ionicons name={t.icon} size={15} color={on ? COLORS.accentCyan : COLORS.textSecondary} />
          )}
          <Text style={[styles.segTxt, on && styles.segTxtOn]}>{t.label}</Text>
        </TouchableOpacity>
      );
    })}
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
  btnText:      { fontSize: 14, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', flexShrink: 1 },

  inputWrap:    { marginBottom: 14 },
  inputLabel:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input:        { backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, color: COLORS.textPrimary, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11 },
  inputMulti:   { height: 80, textAlignVertical: 'top' },

  dropWrap:        { marginBottom: 14 },
  dropTrigger:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  dropTriggerMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dropValue:       { color: COLORS.textPrimary, fontSize: 15, flex: 1, paddingRight: 8 },
  dropPlaceholder: { color: COLORS.textMuted },
  optDot:          { width: 9, height: 9, borderRadius: 4.5 },
  dropOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', paddingHorizontal: 28 },
  dropSheet:       { backgroundColor: COLORS.bgPanel, borderRadius: 14, borderWidth: 1, borderColor: COLORS.accentCyan, padding: 16, maxHeight: '70%' },
  dropHdr:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dropTitle:       { color: COLORS.accentCyan, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  dropList:        { marginBottom: 4 },
  dropOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim },
  dropOptionMain:  { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, paddingRight: 8 },
  dropOptionTxt:   { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', flex: 1 },
  dropOptionTxtOn: { color: COLORS.accentCyan },
  dropFooter:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  dropFooterBtn:   { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  dropFooterTxt:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  dropFooterTxtOn: { color: COLORS.accentCyan },

  filterOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  filterSheet:      { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '85%' },
  filterHandle:     { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  filterHdr:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  filterTitle:      { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  filterBody:       { flexShrink: 1 },
  filterFooter:     { flexDirection: 'row', gap: 12, marginTop: 16 },
  filterBtn:        { flex: 1, borderRadius: 8, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  filterReset:      { borderWidth: 1, borderColor: COLORS.borderMain },
  filterResetTxt:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  filterApply:      { backgroundColor: COLORS.accentCyan },
  filterApplyTxt:   { color: '#0A0E1A', fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  filterTrigger:    { padding: 2 },
  filterBadge:      { position: 'absolute', top: -5, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.accentCyan, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeTxt:   { color: '#0A0E1A', fontSize: 10, fontWeight: '800' },

  filterSection:    { marginBottom: 18 },
  filterSectionLbl: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 9 },
  filterSectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  fChip:            { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 11, paddingVertical: 7 },
  fChipDot:         { width: 8, height: 8, borderRadius: 4 },
  fChipTxt:         { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },

  secHdr:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  secHdrLeft:   { flex: 1, paddingRight: 10 },
  secHdrActions:{ flexDirection: 'row', alignItems: 'center', gap: 14 },
  secTitle:     { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  secSub:       { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  secAction:    { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600' },
  secActionAlt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

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

  segRow:       { flexDirection: 'row', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 4, gap: 4, marginBottom: 12 },
  segBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 7 },
  segBtnOn:     { backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderGlow },
  segTxt:       { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  segTxtOn:     { color: COLORS.accentCyan },
});
