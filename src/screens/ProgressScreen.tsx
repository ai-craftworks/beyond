/**
 * src/screens/ProgressScreen.tsx
 * ===============================
 * Hunter progress graphs: weekly EXP, level progression, and body weight —
 * plus weight logging. Reached from the Profile screen.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllSessions, Session, getBodyMetrics, addBodyMetric, BodyMetric } from '../database/Database';
import { SystemPanel, SystemButton, SectionHeader, EmptyState, SystemInput } from '../components/UIComponents';
import { BarChart } from '../components/Charts';
import { COLORS } from '../constants/game';
import { weeklyExp, weeklyLevels, weightSeries } from '../utils/progress';
import { fmtShortDate } from '../utils/dates';
import { hapticSuccess } from '../utils/haptics';

const ProgressScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [sessions, setSessions]     = useState<Session[]>([]);
  const [metrics, setMetrics]       = useState<BodyMetric[]>([]);
  const [weightInput, setWeight]    = useState('');
  const [noteInput, setNote]        = useState('');
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    const [s, m] = await Promise.all([getAllSessions(), getBodyMetrics()]);
    setSessions(s);
    setMetrics(m);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const logWeight = async () => {
    const w = Number(weightInput);
    if (isNaN(w) || w <= 0) {
      Alert.alert('System', 'Enter a valid weight.');
      return;
    }
    setSaving(true);
    try {
      await addBodyMetric({
        measured_at: new Date().toISOString().split('T')[0],
        weight: w,
        note: noteInput.trim(),
      });
      setWeight('');
      setNote('');
      hapticSuccess();
      await load();
    } catch (e) {
      console.error('add body metric error:', e);
      Alert.alert('Error', 'Could not save the entry.');
    } finally {
      setSaving(false);
    }
  };

  const expData   = weeklyExp(sessions, 12);
  const lvlData   = weeklyLevels(sessions, 12);
  const weight    = weightSeries(metrics);
  const totalExp  = expData.reduce((n, d) => n + d.value, 0);
  const latest    = metrics[0];

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
      showsVerticalScrollIndicator={false}>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>HUNTER PROGRESS</Text>
        <Text style={styles.heroSub}>Your evolution, measured in weeks.</Text>
      </View>

      <SystemPanel>
        <SectionHeader title="Weekly EXP" subtitle={`${totalExp} EXP over ${expData.length} weeks`} />
        {totalExp === 0 ? (
          <EmptyState icon="bar-chart-outline" title="No EXP yet"
            subtitle="Complete quests to start seeing your weekly rhythm." />
        ) : (
          <BarChart data={expData} color={COLORS.accentCyan} />
        )}
      </SystemPanel>

      <SystemPanel>
        <SectionHeader title="Level Progression" subtitle="Level at the end of each week" />
        <BarChart data={lvlData} color={COLORS.accentGold} showValues={false} />
      </SystemPanel>

      <SystemPanel>
        <SectionHeader title="Body Weight" subtitle={latest
          ? `${latest.weight} kg · last logged ${fmtShortDate(latest.measured_at) || latest.measured_at}`
          : 'Log periodically to see your trend'} />
        {metrics.length >= 2 ? (
          <BarChart data={weight} color={COLORS.accentGreen} showValues={false} height={90} />
        ) : (
          <EmptyState icon="body-outline" title="Not enough entries"
            subtitle="Log your weight at least twice to see a trend." />
        )}
        <View style={styles.logRow}>
          <SystemInput label="WEIGHT (KG)" value={weightInput} onChangeText={setWeight}
            placeholder="e.g. 74.5" keyboardType="decimal-pad" style={styles.logWeight} />
        </View>
        <SystemInput label="NOTE (OPTIONAL)" value={noteInput} onChangeText={setNote}
          placeholder="e.g. after morning run" />
        <SystemButton title="Log Weight" icon="add" onPress={logWeight} loading={saving}
          style={styles.logBtn} />
      </SystemPanel>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: 16 },

  hero:     { backgroundColor: COLORS.bgSecondary, borderWidth: 1.5, borderColor: COLORS.borderMain, borderRadius: 14, padding: 18, marginBottom: 14, alignItems: 'center' },
  heroTitle:{ color: COLORS.accentCyan, fontSize: 15, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  heroSub:  { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },

  logRow:   { flexDirection: 'row', gap: 10, marginTop: 8 },
  logWeight:{ flex: 1 },
  logBtn:   { marginTop: 12 },
});

export default ProgressScreen;
