/**
 * src/components/CalendarSheet.tsx
 * =================================
 * A themed month-grid date picker in a bottom sheet. Returns UTC
 * 'YYYY-MM-DD' strings so it lines up with session/challenge dates.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/game';
import { addDaysUTC, fmtMonthYear, monthGrid, todayDateStr } from '../utils/dates';
import { hapticTap } from '../utils/haptics';

interface Props {
  visible: boolean;
  value?: string;
  min?: string;
  max?: string;
  title?: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CalendarSheet: React.FC<Props> = ({
  visible, value, min, max, title = 'Select date', onSelect, onClose,
}) => {
  const insets = useSafeAreaInsets();
  const today = todayDateStr();
  const [cursor, setCursor] = useState(value || today);

  useEffect(() => {
    if (visible) setCursor(value || today);
  }, [visible, value, today]);

  const cells = monthGrid(cursor);
  const cursorMonth = cursor.slice(0, 7);

  const firstOfMonth = `${cursor.slice(0, 7)}-01`;
  const prevMonth = addDaysUTC(firstOfMonth, -1);
  const nextMonth = addDaysUTC(firstOfMonth, 32);

  const isDisabled = (d: string) => (!!min && d < min) || (!!max && d > max);

  const pick = (d: string) => {
    if (isDisabled(d)) return;
    hapticTap();
    onSelect(d);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}
          onPress={() => {}}
        >
          <View style={styles.handle} />

          <View style={styles.hdr}>
            <Text style={styles.title}>{title.toUpperCase()}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCursor(prevMonth)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={COLORS.accentCyan} />
            </TouchableOpacity>
            <Text style={styles.monthTxt}>{fmtMonthYear(cursor)}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCursor(nextMonth)} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.accentCyan} />
            </TouchableOpacity>
          </View>

          <View style={styles.dowRow}>
            {DOW.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.dowTxt}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map(d => {
              const selected = d === value;
              const isToday = d === today;
              const outside = d.slice(0, 7) !== cursorMonth;
              const disabled = isDisabled(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={styles.cell}
                  activeOpacity={0.7}
                  disabled={disabled}
                  onPress={() => pick(d)}
                  accessibilityRole="button"
                  accessibilityLabel={d}
                  accessibilityState={{ selected, disabled }}
                >
                  <View style={[
                    styles.cellInner,
                    isToday && !selected && styles.cellToday,
                    selected && styles.cellSelected,
                  ]}>
                    <Text style={[
                      styles.cellTxt,
                      outside && styles.cellTxtOutside,
                      isToday && !selected && styles.cellTxtToday,
                      selected && styles.cellTxtSelected,
                      disabled && styles.cellTxtDisabled,
                    ]}>
                      {Number(d.slice(8, 10))}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerBtn}
              activeOpacity={0.75}
              disabled={isDisabled(today)}
              onPress={() => pick(today)}
            >
              <Ionicons name="today-outline" size={15} color={COLORS.accentCyan} />
              <Text style={styles.footerTxt}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerBtn} activeOpacity={0.75} onPress={onClose}>
              <Text style={[styles.footerTxt, styles.footerCancel]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20 },
  handle:       { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  hdr:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:        { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },

  monthRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:       { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderMain, alignItems: 'center', justifyContent: 'center' },
  monthTxt:     { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  dowRow:       { flexDirection: 'row', marginBottom: 4 },
  dowTxt:       { width: `${100 / 7}%`, textAlign: 'center', color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  cell:         { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellInner:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  cellToday:    { borderColor: COLORS.accentCyan },
  cellSelected: { backgroundColor: COLORS.accentCyan },
  cellTxt:      { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  cellTxtOutside:  { color: COLORS.textMuted, opacity: 0.5 },
  cellTxtToday:    { color: COLORS.accentCyan },
  cellTxtSelected: { color: '#0A0E1A', fontWeight: '800' },
  cellTxtDisabled: { opacity: 0.25 },

  footer:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDim },
  footerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6 },
  footerTxt:    { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  footerCancel: { color: COLORS.textSecondary },
});

export default CalendarSheet;
