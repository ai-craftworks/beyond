/**
 * src/screens/MartialArtDetailScreen.tsx
 * =========================================
 * One martial art: its proficiency header (belt, level, EXP) and two tabs —
 * the skills trained under it, and the tutorials (ordered note series)
 * written about it.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getMartialArt, getSkills, getSkillGroups,
  MartialArt, Skill, SkillGroup,
} from '../database/Database';
import {
  SystemPanel, SystemButton, SectionHeader, ExpBar, EmptyState, FilterChip, SegmentedTabs,
} from '../components/UIComponents';
import SkillFormModal from '../components/SkillFormModal';
import TutorialsSection from '../components/TutorialsSection';
import SkillGroupSheet from '../components/SkillGroupSheet';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getBeltForLevel, parseGroupIds } from '../constants/game';
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
  const [skillGroups, setSkillGroups] = useState<SkillGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState<number | 'all' | 'ungrouped'>('all');
  const [tab, setTab]         = useState<'skills' | 'tutorials'>('skills');
  const [loading, setLoading] = useState(true);
  const [skillModal, setSkillModal] = useState(false);
  const [groupSheet, setGroupSheet] = useState(false);

  const load = async () => {
    const [a, s, g] = await Promise.all([
      getMartialArt(artId), getSkills(artId), getSkillGroups(artId),
    ]);
    setArt(a);
    setSkills(s);
    setSkillGroups(g);
    // A group may have just been deleted — fall back to "All" if the filter vanished.
    setGroupFilter(prev =>
      typeof prev === 'number' && !g.some(x => x.id === prev) ? 'all' : prev
    );
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [artId]));

  if (loading) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  if (!art) {
    return (
      <View style={styles.loadRoot}>
        <Ionicons name="help-circle-outline" size={44} color={COLORS.textMuted} />
        <Text style={styles.missingTxt}>This martial art no longer exists.</Text>
        <SystemButton title="Go Back" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const belt = getBeltForLevel(art.level);

  const groupsOf = (s: Skill): SkillGroup[] => {
    const ids = parseGroupIds(s.groups);
    return skillGroups.filter(g => ids.includes(g.id!));
  };

  const visibleSkills = skills.filter(s => {
    if (groupFilter === 'all') return true;
    const ids = parseGroupIds(s.groups);
    return groupFilter === 'ungrouped' ? ids.length === 0 : ids.includes(groupFilter);
  });

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

        <SegmentedTabs
          tabs={[
            { key: 'skills', label: 'Skills', icon: 'layers-outline' },
            { key: 'tutorials', label: 'Tutorials', icon: 'book-outline' },
          ]}
          value={tab}
          onChange={k => setTab(k as 'skills' | 'tutorials')}
        />

        {tab === 'skills' && (<>
        <SectionHeader
          title="Skills"
          subtitle={`${skills.length} skill${skills.length === 1 ? '' : 's'}`}
          secondary={{ label: 'Groups', onPress: () => setGroupSheet(true) }}
          action={{ label: '+ Add Skill', onPress: () => setSkillModal(true) }}
        />

        {skillGroups.length > 0 && (
          <View style={styles.chipRow}>
            <FilterChip label="All" active={groupFilter === 'all'} onPress={() => setGroupFilter('all')} />
            {skillGroups.map(g => (
              <FilterChip key={g.id} label={g.name} color={g.color}
                active={groupFilter === g.id} onPress={() => setGroupFilter(g.id!)} />
            ))}
            <FilterChip label="Ungrouped" active={groupFilter === 'ungrouped'}
              onPress={() => setGroupFilter('ungrouped')} />
          </View>
        )}

        {visibleSkills.length === 0 ? (
          <EmptyState icon="layers-outline"
            title={groupFilter === 'all' ? 'No skills yet' : 'No matching skills'}
            subtitle={groupFilter === 'all'
              ? 'Add a skill, then tag workouts so training levels it up.'
              : 'Try another group filter, or assign skills via edit.'} />
        ) : (
          visibleSkills.map(skill => {
            const tags = groupsOf(skill);
            return (
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
                {tags.length > 0 && (
                  <View style={styles.tagRow}>
                    {tags.slice(0, 2).map(t => (
                      <View key={t.id} style={[styles.tag, { borderColor: t.color, backgroundColor: `${t.color}18` }]}>
                        <View style={[styles.tagDot, { backgroundColor: t.color }]} />
                        <Text style={[styles.tagTxt, { color: t.color }]} numberOfLines={1}>{t.name}</Text>
                      </View>
                    ))}
                    {tags.length > 2 && <Text style={styles.tagMore}>+{tags.length - 2}</Text>}
                  </View>
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
            );
          })
        )}

        </>)}

        {tab === 'tutorials' && <TutorialsSection martialArtId={artId} />}
      </ScrollView>

      <SkillFormModal
        visible={skillModal}
        martialArtId={artId}
        initial={null}
        onClose={() => setSkillModal(false)}
        onSaved={load}
      />

      <SkillGroupSheet
        visible={groupSheet}
        martialArtId={artId}
        onClose={() => setGroupSheet(false)}
        onSaved={load}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:  { padding: 16 },
  loadRoot: { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingTxt: { color: COLORS.textMuted, fontSize: 14, marginBottom: 4 },

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
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  tag:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 120 },
  tagDot:    { width: 6, height: 6, borderRadius: 3 },
  tagTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  tagMore:   { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  skillMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skillMetaTxt: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  skillRight:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  skillLvl:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700' },
});

export default MartialArtDetailScreen;
