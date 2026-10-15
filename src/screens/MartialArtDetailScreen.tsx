/**
 * src/screens/MartialArtDetailScreen.tsx
 * =========================================
 * One martial art: its proficiency header (belt, level, EXP) and the list of
 * skills trained under it. Adding a skill opens the shared SkillFormModal.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMartialArt, getSkills, MartialArt, Skill } from '../database/Database';
import { SystemPanel, SystemButton, SectionHeader, ExpBar, EmptyState } from '../components/UIComponents';
import SkillFormModal from '../components/SkillFormModal';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getBeltForLevel } from '../constants/game';
import { playSound } from '../utils/sounds';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'MartialArtDetail'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'MartialArtDetail'>;

const MartialArtDetailScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const { artId }  = route.params;

  const [art, setArt]         = useState<MartialArt | null>(null);
  const [skills, setSkills]   = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillModal, setSkillModal] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, [artId]));

  const load = async () => {
    const [a, s] = await Promise.all([getMartialArt(artId), getSkills(artId)]);
    setArt(a);
    setSkills(s);
    setLoading(false);
  };

  if (loading || !art) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  const belt = getBeltForLevel(art.level);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        {/* Proficiency header */}
        <View style={[styles.hero, { borderColor: art.color }]}>
          <View style={[styles.heroIcon, { borderColor: art.color, backgroundColor: `${art.color}18` }]}>
            <Ionicons name={art.icon as any} size={34} color={art.color} />
          </View>
          <Text style={styles.heroName}>{art.name}</Text>
          <View style={styles.beltRow}>
            <View style={[styles.beltDot, { backgroundColor: belt.color }]} />
            <Text style={[styles.beltTxt, { color: belt.color }]}>{belt.belt} Belt</Text>
            <Text style={styles.heroLvl}>· Prof. Lv. {art.level}</Text>
          </View>
          {!!art.description && <Text style={styles.heroDesc}>{art.description}</Text>}
        </View>

        <SystemPanel>
          <ExpBar current={art.exp} max={art.exp_to_next || 1} />
          <Text style={styles.expHint}>{art.total_exp} total proficiency EXP</Text>
        </SystemPanel>

        <SectionHeader
          title="Skills"
          subtitle={`${skills.length} skill${skills.length === 1 ? '' : 's'}`}
          action={{ label: '+ Add Skill', onPress: () => setSkillModal(true) }}
        />

        {skills.length === 0 ? (
          <EmptyState icon="layers-outline" title="No skills yet"
            subtitle="Add a skill, then tag workouts so training levels it up." />
        ) : (
          skills.map(skill => (
            <TouchableOpacity
              key={skill.id}
              style={styles.skillCard}
              activeOpacity={0.8}
              onPress={() => { playSound('navigate'); navigation.navigate('SkillDetail', { skillId: skill.id! }); }}
            >
              <View style={styles.skillLeft}>
                <Text style={styles.skillName}>{skill.name}</Text>
                {!!skill.description && (
                  <Text style={styles.skillDesc} numberOfLines={1}>{skill.description}</Text>
                )}
                <View style={styles.skillMeta}>
                  <Ionicons name="barbell-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.skillMetaTxt}>
                    {skill.exercise_count ?? 0} workout{(skill.exercise_count ?? 0) === 1 ? '' : 's'}
                  </Text>
                  {skill.media_type !== 'none' && (
                    <>
                      <Ionicons name="image-outline" size={12} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                      <Text style={styles.skillMetaTxt}>demo</Text>
                    </>
                  )}
                </View>
              </View>
              <View style={styles.skillRight}>
                <Text style={styles.skillLvl}>Lv. {skill.level}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </View>
            </TouchableOpacity>
          ))
        )}

        <SystemButton title="Add Skill" icon="add" variant="ghost"
          style={styles.addBtn} onPress={() => setSkillModal(true)} />
      </ScrollView>

      <SkillFormModal
        visible={skillModal}
        martialArtId={artId}
        initial={null}
        onClose={() => setSkillModal(false)}
        onSaved={load}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:  { padding: 16 },
  loadRoot: { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },

  hero:      { alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1.5, borderRadius: 14, padding: 20, marginBottom: 12 },
  heroIcon:  { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroName:  { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  beltRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  beltDot:   { width: 9, height: 9, borderRadius: 5 },
  beltTxt:   { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  heroLvl:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  heroDesc:  { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 },

  expHint:   { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6 },

  skillCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 13, marginBottom: 8, gap: 10 },
  skillLeft: { flex: 1 },
  skillName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  skillDesc: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  skillMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skillMetaTxt: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  skillRight:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  skillLvl:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700' },

  addBtn:    { marginTop: 8 },
});

export default MartialArtDetailScreen;
