/**
 * src/screens/RegistrationScreen.tsx
 * ====================================
 * First-launch 3-step registration wizard.
 * Step 1: Name + Age  →  Step 2: Weight + Height  →  Step 3: Confirm + Register
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Animated, Alert, KeyboardAvoidingView,
  Platform, TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createPlayer } from '../database/Database';
import { SystemInput, SystemButton } from '../components/UIComponents';
import { COLORS } from '../constants/game';
import { RootStackParamList } from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Registration'> };

const RegistrationScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep]     = useState(0);
  const [name, setName]     = useState('');
  const [age, setAge]       = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1,   duration: 1500, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleNext = () => {
    if (step === 0) {
      if (!name.trim())              return Alert.alert('System', 'Enter your name, Hunter.');
      if (!age || isNaN(Number(age))) return Alert.alert('System', 'Enter a valid age.');
      setStep(1);
    } else if (step === 1) {
      if (!weight || isNaN(Number(weight))) return Alert.alert('System', 'Enter a valid weight.');
      if (!height || isNaN(Number(height))) return Alert.alert('System', 'Enter a valid height.');
      setStep(2);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      await createPlayer(name.trim(), Number(age), Number(weight), Number(height));
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Error', 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const STEP_LABELS = ['Identity', 'Physical', 'Confirm'];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Header */}
          <View style={styles.headerBlock}>
            <Animated.Text style={[styles.systemTag, { opacity: scanAnim }]}>
              ◈ SYSTEM INITIALISED ◈
            </Animated.Text>
            <Text style={styles.mainTitle}>HUNTER{'\n'}REGISTRATION</Text>
            <Text style={styles.subtitle}>
              You have been chosen by the System.{'\n'}Complete registration to begin your ascent.
            </Text>
          </View>

          {/* Step dots */}
          <View style={styles.stepRow}>
            {STEP_LABELS.map((lbl, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotOn]}>
                  <Text style={[styles.stepNum, i <= step && styles.stepNumOn]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepLbl, i === step && styles.stepLblOn]}>{lbl}</Text>
              </View>
            ))}
          </View>

          {/* Step 0: Identity */}
          {step === 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>◆ IDENTITY PROTOCOL</Text>
              <SystemInput label="Hunter Name" value={name} onChangeText={setName} placeholder="Enter your name" />
              <SystemInput label="Age" value={age} onChangeText={setAge} placeholder="Years" keyboardType="numeric" />
              <SystemButton title="NEXT →" onPress={handleNext} />
            </View>
          )}

          {/* Step 1: Physical */}
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>◆ PHYSICAL ANALYSIS</Text>
              <SystemInput label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
              <SystemInput label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              <View style={styles.row}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                  <Text style={styles.backTxt}>← BACK</Text>
                </TouchableOpacity>
                <SystemButton title="NEXT →" onPress={handleNext} style={styles.flex1} />
              </View>
            </View>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>◆ REGISTRATION SUMMARY</Text>
              {[['Name', name], ['Age', `${age} yrs`], ['Weight', `${weight} kg`], ['Height', `${height} cm`]].map(([l, v]) => (
                <View key={l} style={styles.summaryRow}>
                  <Text style={styles.summaryLbl}>{l}</Text>
                  <Text style={styles.summaryVal}>{v}</Text>
                </View>
              ))}
              <View style={styles.noticeBox}>
                <Text style={styles.noticeTxt}>Starting stats: All at 10  ·  Rank: E  ·  Level: 1</Text>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                  <Text style={styles.backTxt}>← BACK</Text>
                </TouchableOpacity>
                <SystemButton title="REGISTER" onPress={handleRegister} loading={loading} style={styles.flex1} />
              </View>
            </View>
          )}

          <Text style={styles.footer}>「 The weak don't get to choose. 」</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bgPrimary },
  scroll:      { padding: 24, paddingBottom: 50 },
  headerBlock: { alignItems: 'center', paddingTop: 48, paddingBottom: 30 },
  systemTag:   { color: COLORS.accentCyan, fontSize: 11, fontWeight: '700', letterSpacing: 4, marginBottom: 14 },
  mainTitle:   { color: COLORS.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: 2, textAlign: 'center', lineHeight: 36, marginBottom: 12 },
  subtitle:    { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  stepRow:     { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 28 },
  stepItem:    { alignItems: 'center', gap: 5 },
  stepDot:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: COLORS.borderMain, alignItems: 'center', justifyContent: 'center' },
  stepDotOn:   { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}18` },
  stepNum:     { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  stepNumOn:   { color: COLORS.accentCyan },
  stepLbl:     { color: COLORS.textMuted, fontSize: 10 },
  stepLblOn:   { color: COLORS.accentCyan },
  card:        { backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 12, padding: 20, marginBottom: 20 },
  cardTitle:   { color: COLORS.accentCyan, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },
  row:         { flexDirection: 'row', gap: 12 },
  flex1:       { flex: 1 },
  backBtn:     { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  backTxt:     { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.borderDim },
  summaryLbl:  { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  summaryVal:  { color: COLORS.accentCyan, fontSize: 14, fontWeight: '700' },
  noticeBox:   { backgroundColor: `${COLORS.accentCyan}10`, borderWidth: 1, borderColor: `${COLORS.accentCyan}35`, borderRadius: 8, padding: 12, marginVertical: 14 },
  noticeTxt:   { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  footer:      { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginTop: 8 },
});

export default RegistrationScreen;
