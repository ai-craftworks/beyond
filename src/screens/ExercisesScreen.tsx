import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createExercise, deleteExercise, updateExercise, Exercise, MediaType, getExercises, getGroups, Group } from '../database/Database';
import { SystemButton, SystemInput, SectionHeader, EmptyState, SystemDropdown, SystemMultiDropdown, FilterSheet, FilterSection, FilterChip, FilterButton } from '../components/UIComponents';
import ActionBar from '../components/ActionBar';
import MediaField from '../components/MediaField';
import WorkoutRow from '../components/WorkoutRow';
import ExerciseDetailSheet from '../components/ExerciseDetailSheet';
import { deleteMedia } from '../utils/media';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, EXERCISE_CATEGORIES, STATS, UNIT_TYPES, BODY_PARTS, parseBodyParts, parseUnits, parseGroupIds, unitSuffix, statAccent, expBadgeLabel, prLabel, workoutMetaLine } from '../constants/game';
import { filterExercises } from '../utils/filterExercises';
import type { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const emptyDefaults = (): Record<string, string> => ({ reps: '10' });

const ExercisesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);
  const [modal, setModal]         = useState(false);
  const [loading, setLoading]     = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail]         = useState<Exercise | null>(null);

  const [editModal, setEditModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Exercise | null>(null);
  const [editName, setEditName]       = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [editUnits, setEditUnits]         = useState<string[]>(['reps']);
  const [editUnitDefaults, setEditUnitDefaults] = useState<Record<string, string>>(emptyDefaults());
  const [editPrimary, setEditPrimary]     = useState('reps');
  const [editExpPerUnit, setEditExpPerUnit] = useState('2');
  const [editExpUnitCount, setEditExpUnitCount] = useState('1');
  const [editStatType, setEditStatType]   = useState('strength');
  const [editExpPerStatPt, setEditExpPerStatPt] = useState('20');
  const [editCategory, setEditCategory]   = useState('strength');
  const [editBodyParts, setEditBodyParts] = useState<string[]>([]);
  const [editGroups, setEditGroups]       = useState<number[]>([]);
  const [editMediaType, setEditMediaType] = useState<MediaType>('none');
  const [editMediaUri, setEditMediaUri]   = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const editOriginalUri = useRef('');

  const [name, setName]               = useState('');
  const [desc, setDesc]               = useState('');
  const [units, setUnits]             = useState<string[]>(['reps']);
  const [unitDefaults, setUnitDefaults] = useState<Record<string, string>>(emptyDefaults());
  const [primaryUnit, setPrimaryUnit] = useState('reps');
  const [expPerUnit, setExpPerUnit]   = useState('2');
  const [expUnitCount, setExpUnitCount] = useState('1');
  const [statType, setStatType]       = useState('strength');
  const [category, setCategory]       = useState('strength');
  const [bodyParts, setBodyParts]     = useState<string[]>([]);
  const [selGroups, setSelGroups]     = useState<number[]>([]);
  const [expPerStatPt, setExpPerStatPt] = useState('20');
  const [mediaType, setMediaType]     = useState<MediaType>('none');
  const [mediaUri, setMediaUri]       = useState('');

  // List search / filters
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('all');
  const [partFilter, setPartFilter] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);

  const load = async () => {
    const [exs, grps] = await Promise.all([getExercises(), getGroups('exercise')]);
    setExercises(exs);
    setGroups(grps);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const groupOptions = groups.map(g => ({ value: String(g.id), label: g.name, color: g.color }));
  const groupColor = (id: number) => groups.find(g => g.id === id)?.color ?? COLORS.textSecondary;

  const resetForm = () => {
    setName(''); setDesc(''); setUnits(['reps']); setUnitDefaults(emptyDefaults());
    setPrimaryUnit('reps'); setExpPerUnit('2'); setExpUnitCount('1');
    setExpPerStatPt('20');
    setStatType('strength'); setCategory('strength'); setBodyParts([]); setSelGroups([]);
    setMediaType('none'); setMediaUri('');
  };

  // Create mode has no DB-stored original — any current pick is uncommitted.
  const discardCreateMedia = () => {
    if (mediaUri) deleteMedia(mediaUri);
  };

  const closeCreateModal = () => {
    discardCreateMedia();
    resetForm();
    setModal(false);
  };

  const handleCreateMediaChange = (next: { type: MediaType; uri: string }) => {
    if (mediaUri && next.uri !== mediaUri) deleteMedia(mediaUri);
    setMediaType(next.type);
    setMediaUri(next.uri);
  };

  const toggleUnit = (
    type: string,
    list: string[],
    setList: (v: string[]) => void,
    defaults: Record<string, string>,
    setDefaults: (v: Record<string, string>) => void,
    primary: string,
    setPrimary: (v: string) => void,
  ) => {
    if (list.includes(type)) {
      const next = list.filter(t => t !== type);
      if (next.length === 0) return; // always keep at least one unit
      setList(next);
      if (primary === type) setPrimary(next[0]);
    } else {
      setList([...list, type]);
      if (defaults[type] === undefined) {
        setDefaults({ ...defaults, [type]: type === 'reps' ? '10' : '' });
      }
    }
  };

  const buildUnitsJson = (list: string[], defaults: Record<string, string>): string =>
    JSON.stringify(list.map(type => ({
      type,
      label: unitSuffix(type),
      default: Number(defaults[type]) || 0,
    })));

  const handleCreate = async () => {
    if (!name.trim())                                    return Alert.alert('System', 'Exercise name required.');
    if (isNaN(Number(expPerUnit)) || Number(expPerUnit) <= 0) return Alert.alert('System', 'Enter a valid EXP per unit (must be greater than 0).');
    const primary = units.includes(primaryUnit) ? primaryUnit : units[0];
    const unit = UNIT_TYPES.find(u => u.value === primary)!;
    setLoading(true);
    try {
      await createExercise({
        name:           name.trim(),
        description:    desc.trim(),
        exp_reward:     Number(expPerUnit),
        unit_type:      primary,
        exp_per_unit:   Number(expPerUnit),
        exp_unit_count: Number(expUnitCount) || 1,
        unit_label:     unit.suffix,
        units:          buildUnitsJson(units, unitDefaults),
        primary_unit:   primary,
        exp_per_stat_point: Number(expPerStatPt) || 20,  
        stat_type:      statType,
        category,
        media_type:     mediaType,
        media_uri:      mediaUri,
      }, bodyParts, selGroups);
      resetForm(); // media file is now committed to the DB — do not delete it
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', 'Failed to create exercise. Please try again.');
      console.error('createExercise error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (ex: Exercise) =>
    Alert.alert('Delete', `Remove "${ex.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const mediaFile = await deleteExercise(ex.id!);
            deleteMedia(mediaFile);
            await load();
          } catch (e) {
            console.error('delete exercise error:', e);
            Alert.alert('Error', 'Could not delete the exercise. Please try again.');
          }
        },
      },
    ]);

  const openEdit = (ex: Exercise) => {
    setEditTarget(ex);
    setEditName(ex.name);
    setEditDesc(ex.description);
    const parsed = parseUnits(ex.units);
    const fallbackType = ex.unit_type ?? 'reps';
    const list = parsed.length > 0 ? parsed : [{ type: fallbackType, label: unitSuffix(fallbackType), default: 0 }];
    const defaults: Record<string, string> = {};
    for (const u of list) defaults[u.type] = String(u.default);
    const primary = ex.primary_unit && list.some(u => u.type === ex.primary_unit) ? ex.primary_unit : list[0].type;
    setEditUnits(list.map(u => u.type));
    setEditUnitDefaults(defaults);
    setEditPrimary(primary);
    setEditExpPerUnit(String(ex.exp_per_unit ?? ex.exp_reward ?? 2));
    setEditExpUnitCount(String(ex.exp_unit_count ?? 1));   
    setEditExpPerStatPt(String(ex.exp_per_stat_point ?? 20));
    setEditStatType(ex.stat_type);
    setEditCategory(ex.category);
    setEditBodyParts(parseBodyParts(ex.body_parts));
    setEditGroups(parseGroupIds(ex.groups));
    setEditMediaType(ex.media_type ?? 'none');
    setEditMediaUri(ex.media_uri ?? '');
    editOriginalUri.current = ex.media_uri ?? '';
    setEditModal(true);
  };

  const closeEditModal = () => {
    // Discard an uncommitted pick; the DB-stored original is never touched here.
    if (editMediaUri && editMediaUri !== editOriginalUri.current) deleteMedia(editMediaUri);
    setEditModal(false);
    setEditTarget(null);
  };

  const handleEditMediaChange = (next: { type: MediaType; uri: string }) => {
    if (editMediaUri && editMediaUri !== editOriginalUri.current && next.uri !== editMediaUri) {
      deleteMedia(editMediaUri);
    }
    setEditMediaType(next.type);
    setEditMediaUri(next.uri);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return Alert.alert('System', 'Exercise name required.');
    if (isNaN(Number(editExpPerUnit)) || Number(editExpPerUnit) <= 0)
      return Alert.alert('System', 'Enter a valid EXP per unit.');
    const primary = editUnits.includes(editPrimary) ? editPrimary : editUnits[0];
    const unit = UNIT_TYPES.find(u => u.value === primary)!;
    setEditLoading(true);
    try {
      await updateExercise(editTarget!.id!, {
        name:         editName.trim(),
        description:  editDesc.trim(),
        unit_type:    primary,
        exp_per_unit: Number(editExpPerUnit),
        exp_unit_count: Number(editExpUnitCount) || 1,
        exp_reward:   Number(editExpPerUnit),
        unit_label:   unit.suffix,
        units:        buildUnitsJson(editUnits, editUnitDefaults),
        primary_unit: primary,
        stat_type:    editStatType,
        category:     editCategory,
        exp_per_stat_point: Number(editExpPerStatPt) || 20,
        media_type:   editMediaType,
        media_uri:    editMediaUri,
      }, editBodyParts, editGroups);
      // The replaced original is no longer referenced — clean it up.
      if (editOriginalUri.current && editOriginalUri.current !== editMediaUri) {
        deleteMedia(editOriginalUri.current);
      }
      setEditModal(false);
      setEditTarget(null);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to update exercise.');
    } finally {
      setEditLoading(false);
    }
  };

  const selectedUnit = UNIT_TYPES.find(u => u.value === primaryUnit);
  /** Up to 3 group colour dots, shown after the meta line. */
  const groupDots = (ex: Exercise) => {
    const ids = parseGroupIds(ex.groups);
    if (ids.length === 0) return null;
    return (
      <View style={styles.dotsRow}>
        {ids.slice(0, 3).map(id => (
          <View key={id} style={[styles.dot, { backgroundColor: groupColor(id) }]} />
        ))}
        {ids.length > 3 && <Text style={styles.dotMore}>+{ids.length - 3}</Text>}
      </View>
    );
  };
  const filtersActive = search.trim() !== '' || catFilter !== 'all' || partFilter.length > 0 || groupFilter.length > 0;
  const filterCount = (catFilter !== 'all' ? 1 : 0) + (partFilter.length > 0 ? 1 : 0) + (groupFilter.length > 0 ? 1 : 0);
  const resetFilters = () => { setCatFilter('all'); setPartFilter([]); setGroupFilter([]); };
  const togglePart = (v: string) => setPartFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleGroupF = (v: string) => setGroupFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const shown = filterExercises(exercises, { search, category: catFilter, bodyParts: partFilter, groups: groupFilter.map(Number) });

  return (
    <View style={styles.root}>
      <FlatList
        data={shown}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <SectionHeader title="Exercise Library"
              subtitle={filtersActive ? `${shown.length} / ${exercises.length} shown` : `${exercises.length} exercises`}
              secondary={{ label: 'Groups', onPress: () => navigation.navigate('Groups', { kind: 'exercise' }) }}
              action={{ label: '+ Create', onPress: () => setModal(true) }} />

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
                placeholder="Search name or description" placeholderTextColor={COLORS.textMuted} />
              <FilterButton count={filterCount} onPress={() => setFiltersOpen(true)} />
            </View>
          </>
        }
        ListEmptyComponent={<EmptyState icon="barbell"
          title={filtersActive ? 'No matching exercises' : 'No exercises yet'}
          subtitle={filtersActive ? 'Try a different search or filter.' : 'Create your first exercise.'} />}
        renderItem={({ item }) => (
          <WorkoutRow
            title={item.name}
            meta={workoutMetaLine(item)}
            metaAccessory={
              <>
                {groupDots(item)}
                {prLabel(item) && (
                  <View style={styles.prPill}>
                    <Text style={styles.prPillTxt}>★ {prLabel(item)}</Text>
                  </View>
                )}
              </>
            }
            accent={statAccent(item.category)}
            exp={expBadgeLabel(item)}
            onPress={() => setDetail(item)}
          />
        )}
      />

      <Modal visible={modal} animationType="slide" transparent onRequestClose={closeCreateModal}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ NEW EXERCISE</Text>
            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <SystemInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Push-ups" />
              <SystemInput label="Description" value={desc} onChangeText={setDesc} placeholder="Optional..." multiline />

              {/* Units */}
              <Text style={styles.selectLbl}>UNITS</Text>
              <View style={styles.chips}>
                {UNIT_TYPES.map(u => {
                  const on = units.includes(u.value);
                  return (
                    <TouchableOpacity key={u.value}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggleUnit(u.value, units, setUnits, unitDefaults, setUnitDefaults, primaryUnit, setPrimaryUnit)}>
                      <View style={styles.chipRow}>
                        <Ionicons name={u.icon} size={12} color={on ? COLORS.accentCyan : COLORS.textSecondary} />
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{u.label}</Text>
                      </View>
                      <Text style={styles.chipDesc}>{u.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Default value per unit */}
              <Text style={styles.selectLbl}>DEFAULT VALUES</Text>
              {units.map(type => (
                <View key={type} style={styles.unitRow}>
                  <Text style={styles.unitRowLbl}>{unitSuffix(type)}</Text>
                  <TextInput
                    style={styles.unitRowInput}
                    value={unitDefaults[type] ?? ''}
                    onChangeText={v => setUnitDefaults(prev => ({ ...prev, [type]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
              <Text style={styles.expHint}>A modifier unit scales EXP by actual ÷ default (default 5 kg → 7.5 kg = ×1.5).</Text>

              {/* Primary / EXP driver */}
              <Text style={styles.selectLbl}>EXP DRIVER</Text>
              <View style={styles.chips}>
                {units.map(type => (
                  <TouchableOpacity key={type}
                    style={[styles.chip, primaryUnit === type && styles.chipOn]}
                    onPress={() => setPrimaryUnit(type)}>
                    <Text style={[styles.chipTxt, primaryUnit === type && styles.chipTxtOn]}>{unitSuffix(type)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* EXP per N units */}
              <View style={styles.row}>
                <SystemInput
                  label="EXP Gained"
                  value={expPerUnit}
                  onChangeText={setExpPerUnit}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1"
                  style={styles.flex1}
                />
                <View style={styles.perLabel}>
                  <Text style={styles.perLabelTxt}>per</Text>
                </View>
                <SystemInput
                  label={`${selectedUnit?.suffix ?? 'units'} done`}
                  value={expUnitCount}
                  onChangeText={setExpUnitCount}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 10"
                  style={styles.flex1}
                />
              </View>
              <Text style={styles.expHint}>
                {Number(expPerUnit) || 0} EXP per {Number(expUnitCount) || 1} {selectedUnit?.suffix ?? 'units'}.{' '}
                Example: 50 {selectedUnit?.suffix ?? 'units'} ={'  '}
                {(((Number(expPerUnit) || 0) / (Number(expUnitCount) || 1)) * 50).toFixed(1)} EXP
              </Text>

              {/* Category */}
              <SystemDropdown
                label="Category"
                options={EXERCISE_CATEGORIES}
                value={category}
                onChange={(v) => {
                  setCategory(v);
                  const c = EXERCISE_CATEGORIES.find(x => x.value === v);
                  if (c) setStatType(c.stat);
                }}
              />

              {/* Stat boost */}
              <Text style={styles.selectLbl}>STAT BOOST</Text>
              <View style={styles.chips}>
                {STATS.map(s => (
                  <TouchableOpacity key={s.key}
                    style={[styles.chip, statType === s.key && styles.chipOn]}
                    onPress={() => setStatType(s.key)}>
                    <View style={styles.chipRow}>
                      <Ionicons name={s.icon} size={12} color={s.color} />
                      <Text style={[styles.chipTxt, statType === s.key && styles.chipTxtOn]}>{s.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <SystemInput
                label={`EXP needed for +1 ${statType.toUpperCase()} point`}
                value={expPerStatPt}
                onChangeText={setExpPerStatPt}
                keyboardType="decimal-pad"
                placeholder="e.g. 20"
              />
              <Text style={styles.expHint}>
                Every {expPerStatPt || '20'} EXP from this exercise = +1 {statType.toUpperCase()}.
                Example: earn {Number(expPerStatPt || 20) * 3} EXP → +3 {statType.toUpperCase()}
              </Text>

              {/* Body parts */}
              <SystemMultiDropdown
                label="Body Parts"
                options={BODY_PARTS}
                values={bodyParts}
                onChange={setBodyParts}
              />
              <Text style={styles.expHint}>Select every muscle group this exercise targets.</Text>

              <SystemMultiDropdown
                label="Groups"
                options={groupOptions}
                values={selGroups.map(String)}
                onChange={ids => setSelGroups(ids.map(Number))}
                placeholder={groups.length === 0 ? 'No groups yet' : 'Any'}
              />

              <MediaField
                mediaType={mediaType}
                mediaUri={mediaUri}
                onChange={handleCreateMediaChange}
              />

            </ScrollView>

            {/* Pinned outside the scroll view so the form can be submitted
                without scrolling to the bottom of it. */}
            <ActionBar style={styles.footer}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                onPress={closeCreateModal} />
              <SystemButton title="Create" style={styles.flex1}
                onPress={handleCreate} loading={loading} />
            </ActionBar>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT EXERCISE MODAL ── */}
      <Modal visible={editModal} animationType="slide" transparent onRequestClose={closeEditModal}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>◆ EDIT EXERCISE</Text>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}>
              <SystemInput label="Name" value={editName} onChangeText={setEditName} />
              <SystemInput label="Description" value={editDesc} onChangeText={setEditDesc} multiline />

              <Text style={styles.selectLbl}>UNITS</Text>
              <View style={styles.chips}>
                {UNIT_TYPES.map(u => {
                  const on = editUnits.includes(u.value);
                  return (
                    <TouchableOpacity key={u.value}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggleUnit(u.value, editUnits, setEditUnits, editUnitDefaults, setEditUnitDefaults, editPrimary, setEditPrimary)}>
                      <View style={styles.chipRow}>
                        <Ionicons name={u.icon} size={12} color={on ? COLORS.accentCyan : COLORS.textSecondary} />
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{u.label}</Text>
                      </View>
                      <Text style={styles.chipDesc}>{u.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.selectLbl}>DEFAULT VALUES</Text>
              {editUnits.map(type => (
                <View key={type} style={styles.unitRow}>
                  <Text style={styles.unitRowLbl}>{unitSuffix(type)}</Text>
                  <TextInput
                    style={styles.unitRowInput}
                    value={editUnitDefaults[type] ?? ''}
                    onChangeText={v => setEditUnitDefaults(prev => ({ ...prev, [type]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
              <Text style={styles.expHint}>A modifier unit scales EXP by actual ÷ default.</Text>

              <Text style={styles.selectLbl}>EXP DRIVER</Text>
              <View style={styles.chips}>
                {editUnits.map(type => (
                  <TouchableOpacity key={type}
                    style={[styles.chip, editPrimary === type && styles.chipOn]}
                    onPress={() => setEditPrimary(type)}>
                    <Text style={[styles.chipTxt, editPrimary === type && styles.chipTxtOn]}>{unitSuffix(type)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <SystemInput label="EXP Gained" value={editExpPerUnit} onChangeText={setEditExpPerUnit}
                  keyboardType="decimal-pad" style={styles.flex1} />
                <View style={styles.perLabel}>
                  <Text style={styles.perLabelTxt}>per</Text>
                </View>
                <SystemInput
                  label={`${unitSuffix(editPrimary)} done`}
                  value={editExpUnitCount} onChangeText={setEditExpUnitCount}
                  keyboardType="decimal-pad" style={styles.flex1} />
              </View>

              <SystemDropdown
                label="Category"
                options={EXERCISE_CATEGORIES}
                value={editCategory}
                onChange={(v) => {
                  setEditCategory(v);
                  const c = EXERCISE_CATEGORIES.find(x => x.value === v);
                  if (c) setEditStatType(c.stat);
                }}
              />

              <Text style={styles.selectLbl}>STAT BOOST</Text>
              <View style={styles.chips}>
                {STATS.map(s => (
                  <TouchableOpacity key={s.key}
                    style={[styles.chip, editStatType === s.key && styles.chipOn]}
                    onPress={() => setEditStatType(s.key)}>
                    <View style={styles.chipRow}>
                      <Ionicons name={s.icon} size={12} color={s.color} />
                      <Text style={[styles.chipTxt, editStatType === s.key && styles.chipTxtOn]}>{s.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <SystemInput
                label={`EXP needed for +1 ${editStatType.toUpperCase()} point`}
                value={editExpPerStatPt}
                onChangeText={setEditExpPerStatPt}
                keyboardType="decimal-pad"
                placeholder="e.g. 20"
              />
              <Text style={styles.expHint}>
                Every {editExpPerStatPt || '20'} EXP from this exercise = +1 {editStatType.toUpperCase()}.
                Example: earn {Number(editExpPerStatPt || 20) * 3} EXP → +3 {editStatType.toUpperCase()}
              </Text>

              {/* Body parts */}
              <SystemMultiDropdown
                label="Body Parts"
                options={BODY_PARTS}
                values={editBodyParts}
                onChange={setEditBodyParts}
              />
              <Text style={styles.expHint}>Select every muscle group this exercise targets.</Text>

              <SystemMultiDropdown
                label="Groups"
                options={groupOptions}
                values={editGroups.map(String)}
                onChange={ids => setEditGroups(ids.map(Number))}
                placeholder={groups.length === 0 ? 'No groups yet' : 'Any'}
              />

              <MediaField
                mediaType={editMediaType}
                mediaUri={editMediaUri}
                onChange={handleEditMediaChange}
              />

            </ScrollView>

            {/* Pinned outside the scroll view so the form can be submitted
                without scrolling to the bottom of it. */}
            <ActionBar style={styles.footer}>
              <SystemButton title="Cancel" variant="ghost" style={styles.flex1}
                onPress={closeEditModal} />
              <SystemButton title="Save" style={styles.flex1}
                onPress={handleSaveEdit} loading={editLoading} />
            </ActionBar>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ExerciseDetailSheet
        exercise={detail}
        groups={groups}
        onClose={() => setDetail(null)}
        onEdit={ex => { setDetail(null); openEdit(ex); }}
        onDelete={ex => { setDetail(null); handleDelete(ex); }}
      />

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={resetFilters}
      >
        <FilterSection label="Category">
          <FilterChip label="All" active={catFilter === 'all'} onPress={() => setCatFilter('all')} />
          {EXERCISE_CATEGORIES.map(c => (
            <FilterChip key={c.value} label={c.label} color={statAccent(c.value)}
              active={catFilter === c.value}
              onPress={() => setCatFilter(catFilter === c.value ? 'all' : c.value)} />
          ))}
        </FilterSection>

        <FilterSection label="Body Parts">
          {BODY_PARTS.map(b => (
            <FilterChip key={b.value} label={b.label} active={partFilter.includes(b.value)}
              onPress={() => togglePart(b.value)} />
          ))}
        </FilterSection>

        <FilterSection label="Groups">
          {groups.length === 0 ? (
            <Text style={styles.filterEmpty}>No groups yet — create some from the Groups screen.</Text>
          ) : groups.map(g => (
            <FilterChip key={g.id} label={g.name} color={g.color}
              active={groupFilter.includes(String(g.id))}
              onPress={() => toggleGroupF(String(g.id))} />
          ))}
        </FilterSection>
      </FilterSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bgPrimary },
  list:       { padding: 16, paddingBottom: 100 },

  dotsRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:        { width: 7, height: 7, borderRadius: 3.5 },
  dotMore:    { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  prPill:     { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.accentGold, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, marginTop: 4 },
  prPillTxt:  { color: COLORS.accentGold, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  searchRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, marginBottom: 14, gap: 8 },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 11 },
  filterEmpty: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' },
  dropRow:    { flexDirection: 'row', gap: 12 },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: COLORS.bgPanel, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: COLORS.accentCyan, padding: 20, maxHeight: '95%' },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: COLORS.accentCyan, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 18 },

  selectLbl:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  chip:       { borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  chipRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipOn:     { borderColor: COLORS.accentCyan, backgroundColor: `${COLORS.accentCyan}18` },
  chipTxt:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTxtOn:  { color: COLORS.accentCyan },
  chipDesc:   { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },
  expHint:    { color: COLORS.textMuted, fontSize: 11, marginBottom: 14, fontStyle: 'italic' },

  row:        { flexDirection: 'row', gap: 12, marginBottom: 6 },
  flex1:      { flex: 1 },
  body:       { flexShrink: 1 },
  footer:     { marginTop: 16 },

  perLabel:    { justifyContent: 'flex-end', paddingBottom: 14, alignItems: 'center', paddingHorizontal: 6 },
  perLabelTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  unitRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  unitRowLbl:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', width: 70 },
  unitRowInput: { flex: 1, backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderMain, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: COLORS.textPrimary, fontSize: 14 },
});

export default ExercisesScreen;