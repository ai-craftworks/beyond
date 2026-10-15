/**
 * src/screens/SkillDetailScreen.tsx
 * ===================================
 * One skill: demo media, proficiency, and the workouts tagged to it.
 * Workouts are added via the shared WorkoutSelect screen (mode 'skill').
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSkill, getExercisesForSkill, getMartialArt, removeExerciseFromSkill,
  deleteSkill, Skill, MartialArt, Exercise,
} from '../database/Database';
import { SystemPanel, SystemButton, SectionHeader, ExpBar, EmptyState } from '../components/UIComponents';
import MediaViewer from '../components/MediaViewer';
import SkillFormModal from '../components/SkillFormModal';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getBeltForLevel, parseBodyParts, bodyPartLabel, unitSuffix } from '../constants/game';
import { deleteMedia } from '../utils/media';
import { playSound } from '../utils/sounds';
import { RootStackParamList } from '../../App';

type Route = RouteProp<RootStackParamList, 'SkillDetail'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'SkillDetail'>;

const SkillDetailScreen: React.FC = () => {
  const route       = useRoute<Route>();
  const navigation  = useNavigation<Nav>();
  const insets      = useSafeAreaInsets();
  const { skillId } = route.params;

  const [skill, setSkill]         = useState<Skill | null>(null);
  const [art, setArt]             = useState<MartialArt | null>(null);
  const [workouts, setWorkouts]   = useState<Exercise[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editModal, setEditModal] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, [skillId]));

  const load = async () => {
    const s = await getSkill(skillId);
    setSkill(s);
    if (s) {
      const [a, ws] = await Promise.all([getMartialArt(s.martial_art_id), getExercisesForSkill(skillId)]);
      setArt(a);
      setWorkouts(ws);
    }
    setLoading(false);
  };

  const handleRemoveWorkout = (ex: Exercise) =>
    Alert.alert('Untag Workout', `Remove "${ex.name}" from this skill?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeExerciseFromSkill(skillId, ex.id!);
          await load();
        },
      },
    ]);

  const handleDeleteSkill = () =>
    Alert.alert('Delete Skill', `Remove "${skill?.name}"? Tagged workouts stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const mediaUri = await deleteSkill(skillId);
          deleteMedia(mediaUri);
          navigation.goBack();
        },
      },
    ]);

  if (loading || !skill) {
    return (
      <View style={styles.loadRoot}>
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  const belt = getBeltForLevel(skill.level);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        {!!art && (
          <Text style={[styles.artTag, { color: art.color }]}>{art.name.toUpperCase()}</Text>
        )}
        <Text style={styles.skillName}>{skill.name}</Text>
        <View style={styles.beltRow}>
          <View style={[styles.beltDot, { backgroundColor: belt.color }]} />
          <Text style={[styles.beltTxt, { color: belt.color }]}>{belt.belt} Belt</Text>
          <Text style={styles.lvlTxt}>· Lv. {skill.level}</Text>
        </View>

        <View style={styles.mediaWrap}>
          <MediaViewer mediaType={skill.media_type} mediaUri={skill.media_uri} />
        </View>

        {!!skill.description && <Text style={styles.desc}>{skill.description}</Text>}

        <SystemPanel>
          <ExpBar current={skill.exp} max={skill.exp_to_next || 1} />
          <Text style={styles.expHint}>{skill.total_exp} total proficiency EXP</Text>
        </SystemPanel>

        <View style={styles.actions}>
          <SystemButton title="Edit Skill" icon="create-outline" variant="ghost"
            style={styles.flex1} onPress={() => setEditModal(true)} />
          <SystemButton title="Delete" icon="trash-outline" variant="danger"
            style={styles.flex1} onPress={handleDeleteSkill} />
        </View>

        <SectionHeader
          title="Tagged Workouts"
          subtitle={`${workouts.length} tagged`}
          action={{
            label: '+ Add Workouts',
            onPress: () => navigation.navigate('WorkoutSelect', {
              mode: 'skill', skillId, skillName: skill.name,
            }),
          }}
        />

        {workouts.length === 0 ? (
          <EmptyState icon="barbell" title="No workouts tagged"
            subtitle="Tag workouts so completing them raises this skill's proficiency." />
        ) : (
          workouts.map(ex => {
            const parts = parseBodyParts(ex.body_parts);
            return (
              <View key={ex.id} style={styles.workoutRow}>
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutName}>{ex.name}</Text>
                  <Text style={styles.workoutMeta}>
                    +{ex.exp_per_unit ?? ex.exp_reward} EXP / {ex.exp_unit_count ?? 1}{' '}
                    {unitSuffix(ex.primary_unit ?? ex.unit_type ?? 'reps')}
                    {parts.length > 0 ? `  ·  ${parts.map(bodyPartLabel).join(' · ')}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { playSound('click'); handleRemoveWorkout(ex); }} style={styles.removeBtn}>
                  <Ionicons name="close" size={18} color={COLORS.accentRed} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <SkillFormModal
        visible={editModal}
        martialArtId={skill.martial_art_id}
        initial={skill}
        onClose={() => setEditModal(false)}
        onSaved={load}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.bgPrimary },
  content:  { padding: 16 },
  loadRoot: { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },

  artTag:   { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  skillName:{ color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  beltRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  beltDot:  { width: 9, height: 9, borderRadius: 5 },
  beltTxt:  { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  lvlTxt:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  mediaWrap:{ marginBottom: 14 },
  desc:     { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  expHint:  { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6 },

  actions:  { flexDirection: 'row', gap: 12, marginBottom: 4 },
  flex1:    { flex: 1 },

  workoutRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  workoutInfo: { flex: 1 },
  workoutName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  workoutMeta: { color: COLORS.textMuted, fontSize: 11 },
  removeBtn:   { padding: 4 },
});

export default SkillDetailScreen;
