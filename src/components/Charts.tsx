/**
 * src/components/Charts.tsx
 * =========================
 * Dependency-free bar chart (plain Views — no SVG/chart library) in the
 * app's system-panel aesthetic. Enough for weekly EXP, level and weight.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/game';

export interface BarDatum { label: string; value: number; }

interface Props {
  data: BarDatum[];
  color?: string;
  height?: number;
  /** When false, value labels above bars are hidden (dense series). */
  showValues?: boolean;
}

export const BarChart: React.FC<Props> = ({ data, color = COLORS.accentCyan, height = 110, showValues = true }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const barGap = data.length > 8 ? 4 : 8;
  return (
    <View style={styles.wrap}>
      <View style={[styles.plot, { height }]}>
        {data.map((d, i) => {
          const barH = Math.max(d.value > 0 ? 4 : 2, (d.value / max) * (height - 22));
          return (
            <View key={i} style={[styles.col, { gap: barGap }]}>
              {showValues && <Text style={styles.valTxt} numberOfLines={1}>{d.value}</Text>}
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: barH, backgroundColor: d.value > 0 ? color : COLORS.borderMain }]} />
              </View>
              <Text style={styles.lblTxt} numberOfLines={1}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap:     { width: '100%' },
  plot:     { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  col:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  bar:      { width: '100%', borderRadius: 3, minHeight: 2 },
  valTxt:   { color: COLORS.textSecondary, fontSize: 8, fontWeight: '700' },
  lblTxt:   { color: COLORS.textMuted, fontSize: 7, fontWeight: '600', marginTop: 4 },
});
