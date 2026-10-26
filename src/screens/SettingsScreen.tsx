/**
 * src/screens/SettingsScreen.tsx
 * ===============================
 * App preferences: sound/haptic toggles and hunter profile editing
 * (name, age, weight, height — weight also feeds the body-metrics log).
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPlayer, updatePlayer, Player, setSetting } from '../database/Database';
import { SystemPanel, SystemButton, SystemInput, SectionHeader } from '../components/UIComponents';
import ActionBar from '../components/ActionBar';
import { COLORS } from '../constants/game';
import { setSoundsEnabled, areSoundsEnabled } from '../utils/sounds';
import { setHapticsEnabled, areHapticsEnabled, hapticTap } from '../utils/haptics';

const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [player, setPlayer]       = useState<Player | null>(null);
  const [soundOn, setSoundOn]     = useState(areSoundsEnabled());
  const [hapticsOn, setHapticsOn] = useState(areHapticsEnabled());
  const [name, setName]           = useState('');
  const [age, setAge]             = useState('');
  const [weight, setWeight]       = useState('');
  const [height, setHeight]       = useState('');
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getPlayer();
      if (!p) return;
      setPlayer(p);
      setName(p.name);
      setAge(String(p.age ?? ''));
      setWeight(String(p.weight ?? ''));
      setHeight(String(p.height ?? ''));
    })();
  }, []);

  const toggleSound = async (v: boolean) => {
    setSoundOn(v);
    setSoundsEnabled(v);
    await setSetting('sound_enabled', String(v));
    hapticTap();
  };

  const toggleHaptics = async (v: boolean) => {
    setHapticsOn(v);
    setHapticsEnabled(v);
    await setSetting('haptics_enabled', String(v));
  };

  const saveProfile = async () => {
    if (!player || !name.trim()) {
      Alert.alert('System', 'Hunter name is required.');
      return;
    }
    const ageNum = Number(age);
    const weightNum = Number(weight);
    const heightNum = Number(height);
    if (isNaN(ageNum) || ageNum < 0 || isNaN(weightNum) || weightNum < 0 || isNaN(heightNum) || heightNum < 0) {
      Alert.alert('System', 'Enter valid numbers for age, weight and height.');
      return;
    }
    setSaving(true);
    try {
      await updatePlayer({ name: name.trim(), age: ageNum, weight: weightNum, height: heightNum });
      setPlayer({ ...player, name: name.trim(), age: ageNum, weight: weightNum, height: heightNum });
      Alert.alert('System', 'Profile updated.');
    } catch (e) {
      console.error('save profile error:', e);
      Alert.alert('Error', 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!player) {
    return <View style={styles.root} />;
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <SystemPanel>
          <SectionHeader title="Feedback" subtitle="System sounds and haptics" />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLbl}>Sound effects</Text>
              <Text style={styles.toggleSub}>Navigation blips, quest hits, level-up chimes</Text>
            </View>
            <Switch
              value={soundOn}
              onValueChange={toggleSound}
              trackColor={{ true: `${COLORS.accentCyan}66`, false: COLORS.borderMain }}
              thumbColor={soundOn ? COLORS.accentCyan : COLORS.textMuted}
            />
          </View>
          <View style={styles.toggleDivider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLbl}>Haptics</Text>
              <Text style={styles.toggleSub}>Vibration feedback on taps and milestones</Text>
            </View>
            <Switch
              value={hapticsOn}
              onValueChange={toggleHaptics}
              trackColor={{ true: `${COLORS.accentCyan}66`, false: COLORS.borderMain }}
              thumbColor={hapticsOn ? COLORS.accentCyan : COLORS.textMuted}
            />
          </View>
        </SystemPanel>

        <SystemPanel>
          <SectionHeader title="Hunter Profile" subtitle="Used across the System" />
          <SystemInput label="NAME" value={name} onChangeText={setName} placeholder="Hunter name" />
          <SystemInput label="AGE" value={age} onChangeText={setAge} placeholder="Age" keyboardType="numeric" />
          <SystemInput label="WEIGHT (KG)" value={weight} onChangeText={setWeight} placeholder="Weight" keyboardType="decimal-pad" />
          <SystemInput label="HEIGHT (CM)" value={height} onChangeText={setHeight} placeholder="Height" keyboardType="decimal-pad" />
        </SystemPanel>
      </ScrollView>

      <ActionBar
        stacked
        style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}
        label="Hunter Profile"
      >
        <SystemButton
          title="Save Profile"
          icon="save-outline"
          style={styles.barBtn}
          textStyle={styles.barBtnTxt}
          onPress={saveProfile}
          loading={saving}
        />
      </ActionBar>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:      { padding: 16 },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  toggleInfo:   { flex: 1 },
  toggleLbl:    { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  toggleSub:    { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  toggleDivider:{ height: 1, backgroundColor: COLORS.borderMain, marginVertical: 4 },

  actionBar:    { paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.borderMain },
  barBtn:       { flex: 1 },
  barBtnTxt:    { fontSize: 13, letterSpacing: 1 },
});

export default SettingsScreen;
