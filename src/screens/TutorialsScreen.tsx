/**
 * src/screens/TutorialsScreen.tsx
 * ===============================
 * Global tutorials — the sidebar's "Tutorials" destination. Same list as a
 * martial art's tutorials tab, but stored under the sentinel art id 0, so
 * these guides belong to no single art.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TutorialsSection from '../components/TutorialsSection';
import { COLORS } from '../constants/game';

const GLOBAL_ART_ID = 0;

const TutorialsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>GLOBAL TUTORIALS</Text>
          <Text style={styles.heroSub}>Guides and references that belong to no single art.</Text>
        </View>

        <TutorialsSection martialArtId={GLOBAL_ART_ID} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:  { padding: 16 },
  hero:     { backgroundColor: COLORS.bgSecondary, borderWidth: 1.5, borderColor: COLORS.borderMain, borderRadius: 14, padding: 18, marginBottom: 14, alignItems: 'center' },
  heroTitle:{ color: COLORS.accentCyan, fontSize: 15, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  heroSub:  { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});

export default TutorialsScreen;
