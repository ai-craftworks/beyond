/**
 * src/screens/MartialArtsScreen.tsx
 * ===================================
 * "Dojo" tab root: lists every martial art with its proficiency (belt + level),
 * and lets the hunter create, edit or delete arts.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getMartialArts, createMartialArt, updateMartialArt, deleteMartialArt, MartialArt,
} from '../database/Database';
import { SystemButton, SystemInput, SectionHeader, EmptyState, ExpBar } from '../components/UIComponents';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getBeltForLevel } from '../constants/game';
import { deleteMedia } from '../utils/media';
import { playSound } from '../utils/sounds';
import { consumeDojoCelebrations, Celebration } from '../utils/celebrations';
import { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICON_CHOICES: React.ComponentProps<typeof Ionicons>['name'][] = [
  'flame', 'flash', 'shield', 'hand-left', 'hand-right',
  'body', 'fitness', 'walk', 'navigate', 'speedometer',
];

const COLOR_CHOICES = [
  COLORS.accentCyan, COLORS.accentBlue, COLORS.accentPurple,
  COLORS.accentGold, COLORS.accentGreen, COLORS.accentRed,
];

const MartialArtsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();

  const [arts, setArts]       = useState<MartialArt[]>([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<MartialArt | null>(null);
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [icon, setIcon]       = useState<string>(ICON_CHOICES[0]);
  const [color, setColor]     = useState<string>(COLOR_CHOICES[0]);
  const [saving, setSaving]   = useState(false);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const celebAnim = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setArts(await getMartialArts());
    // Surface any belt promotions queued by the last session finish.
    const queued = consumeDojoCelebrations();
    if (queued.length > 0) setCelebrations(prev => [...prev, ...queued]);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const activeCelebration = celebrations[0] ?? null;
  useEffect(() => {
    if (!activeCelebration) return;
    celebAnim.setValue(0);
    Animated.timing(celebAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(celebAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
        setCelebrations(prev => prev.slice(1))
      );
    }, 4200);
    return () => clearTimeout(t);
  }, [activeCelebration, celebAnim]);

  const openCreate = () => {
    setEditing(null);
    setName(''); setDesc('');
    setIcon(ICON_CHOICES[0]); setColor(COLOR_CHOICES[0]);
    setModal(true);
  };

  const openEdit = (art: MartialArt) => {
    setEditing(art);
    setName(art.name); setDesc(art.description);
    setIcon(art.icon || ICON_CHOICES[0]);
    setColor(art.color || COLOR_CHOICES[0]);
    setModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('System', 'Martial art name required.');
    setSaving(true);
    try {
      if (editing) {
        await updateMartialArt(editing.id!, {
          name: name.trim(), description: desc.trim(), icon, color,
        });
      } else {
        await createMartialArt({
          name: name.trim(), description: desc.trim(), icon, color,
        });
      }
      setModal(false);
      setEditing(null);
      await load();
    } catch (e) {
      console.error('save martial art error:', e);
      Alert.alert('Error', 'Failed to save martial art.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (art: MartialArt) =>
    Alert.alert(
      'Delete Martial Art',
      `Remove "${art.name}" and all its skills? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const mediaUris = await deleteMartialArt(art.id!);
              mediaUris.forEach(deleteMedia);
              await load();
            } catch (e) {
              console.error('delete martial art error:', e);
              Alert.alert('Error', 'Could not delete the martial art. Please try again.');
            }
          },
        },
      ]
    );

  return (
    <View style={styles.root}>
      <FlatList
        data={arts}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {activeCelebration && (
              <Animated.View style={[
                styles.celebCard,
                { borderColor: activeCelebration.color ?? COLORS.accentGreen, opacity: celebAnim,
                  transform: [{ translateY: celebAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
              ]}>
                <Ionicons name="ribbon" size={20} color={activeCelebration.color ?? COLORS.accentGreen} />
                <View style={styles.celebBody}>
                  <Text style={[styles.celebTitle, { color: activeCelebration.color ?? COLORS.accentGreen }]}>
                    {activeCelebration.title}
                  </Text>
                  {!!activeCelebration.subtitle && (
                    <Text style={styles.celebSub}>{activeCelebration.subtitle}</Text>
                  )}
                </View>
              </Animated.View>
            )}
            <SectionHeader
              title="Martial Arts"
              subtitle={`${arts.length} art${arts.length === 1 ? '' : 's'} practiced`}
              action={{ label: '+ Create', onPress: openCreate }}
            />
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="hand-left"
            title="No martial arts yet"
            subtitle="Create an art, then add skills and tag workouts to train them."
          />
        }
        renderItem={({ item }) => {
          const belt = getBeltForLevel(item.level);
          return (
            <TouchableOpacity
              style={[styles.card, { borderLeftColor: item.color }]}
              activeOpacity={0.8}
              onPress={() => { playSound('navigate'); navigation.navigate('MartialArtDetail', { artId: item.id! }); }}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { borderColor: item.color, backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.titleWrap}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={styles.beltRow}>
                    <View style={[styles.beltDot, { backgroundColor: belt.color }]} />
                    <Text style={[styles.beltTxt, { color: belt.color }]}>{belt.belt} Belt</Text>
                    <Text style={styles.lvlTxt}>· Lv. {item.level}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                    <Ionicons name="create" size={16} color={COLORS.accentCyan} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                    <Ionicons name="close" size={18} color={COLORS.accentRed} />
                  </TouchableOpacity>
                </View>
              </View>

              {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}

              <ExpBar current={item.exp} max={item.exp_to_next || 1} />

              <View style={styles.cardFooter}>
                <Ionicons name="layers-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.footerTxt}>
                  {item.skill_count ?? 0} skill{(item.skill_count ?? 0) === 1 ? '' : 's'}
                </Text>
                <Text style={styles.footerExp}>{item.total_exp} total proficiency</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Create / Edit modal ── */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ {editing ? 'EDIT' : 'NEW'} MARTIAL ART</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}>
              <SystemInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Karate" />
              <SystemInput label="Description" value={desc} onChangeText={setDesc}
                placeholder="Optional..." multiline />

              <Text style={styles.selectLbl}>ICON</Text>
              <View style={styles.chips}>
                {ICON_CHOICES.map(ic => {
                  const on = icon === ic;
                  return (
                    <TouchableOpacity key={ic}
                      style={[styles.iconChip, on && { borderColor: color, backgroundColor: `${color}18` }]}
                      onPress={() => setIcon(ic)}>
                      <Ionicons name={ic} size={18} color={on ? color : COLORS.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.selectLbl}>COLOR</Text>
              <View style={styles.chips}>
                {COLOR_CHOICES.map(c => (
                  <TouchableOpacity key={c}
                    style={[styles.colorChip, { backgroundColor: c }, color === c && styles.colorChipOn]}
                    onPress={() => setColor(c)} />
                ))}
              </View>

              <View style={styles.row}>
                <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                  onPress={() => { setModal(false); setEditing(null); }} />
                <SystemButton title={editing ? 'Save' : 'Create'} style={styles.flex1}
                  onPress={handleSave} loading={saving} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bgPrimary },
  list:        { padding: 16, paddingBottom: 100 },
  celebCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.bgSecondary, borderWidth: 1.5, borderRadius: 12, padding: 13, marginBottom: 12 },
  celebBody:   { flex: 1 },
  celebTitle:  { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  celebSub:    { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 15 },

  card:        { backgroundColor: COLORS.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderMain, borderLeftWidth: 3, padding: 13, marginBottom: 10 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  iconWrap:    { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  titleWrap:   { flex: 1 },
  cardName:    { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  beltRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  beltDot:     { width: 8, height: 8, borderRadius: 4 },
  beltTxt:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  lvlTxt:      { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  cardDesc:    { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn:   { padding: 4 },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  footerTxt:   { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  footerExp:   { color: COLORS.textMuted, fontSize: 11, marginLeft: 'auto' },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '92%' },
  handle:      { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },

  selectLbl:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  iconChip:    { width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderMain, alignItems: 'center', justifyContent: 'center' },
  colorChip:   { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorChipOn: { borderColor: COLORS.textPrimary },

  row:         { flexDirection: 'row', gap: 12, marginTop: 6 },
  flex1:       { flex: 1 },
});

export default MartialArtsScreen;
