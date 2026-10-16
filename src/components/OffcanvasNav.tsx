/**
 * src/components/OffcanvasNav.tsx
 * =================================
 * Solo Leveling-themed offcanvas navigation drawer.
 *
 * - NavProvider / useNav: shared open/close state for the overlay.
 * - HamburgerButton: header button that opens the drawer.
 * - OffcanvasNav: the slide-in panel (profile block + menu items).
 *
 * Built with plain RN Animated + Modal so it needs no reanimated
 * (SDK 57 ships reanimated 4, which @react-navigation/drawer v6 can't use).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, getRankForLevel } from '../constants/game';
import { getPlayer, Player } from '../database/Database';
import { playSound } from '../utils/sounds';
import { percentOf } from '../utils/math';
import { navigationRef } from '../navigation/ref';
import type { IonName } from './UIComponents';

// ── Context ──────────────────────────────────

interface NavCtx { open: boolean; openNav: () => void; closeNav: () => void; }
const NavContext = createContext<NavCtx | null>(null);

export const useNav = (): NavCtx => {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within <NavProvider>');
  return ctx;
};

export const NavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const openNav  = useCallback(() => setOpen(true), []);
  const closeNav = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openNav, closeNav }), [open, openNav, closeNav]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
};

// ── Hamburger button ─────────────────────────

export const HamburgerButton: React.FC<{ color?: string }> = ({ color = COLORS.accentCyan }) => {
  const { openNav } = useNav();
  return (
    <TouchableOpacity
      style={styles.hamburger}
      onPress={() => { playSound('click'); openNav(); }}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="menu" size={24} color={color} />
    </TouchableOpacity>
  );
};

// ── Menu config ──────────────────────────────

type TabName = 'Home' | 'Exercises' | 'Profile' | 'Plans' | 'Dojo';

const MENU: { key: string; label: string; icon: IonName; iconOn: IonName; tab?: TabName }[] = [
  { key: 'Home',      label: 'Home',      icon: 'home-outline',              iconOn: 'home',              tab: 'Home' },
  { key: 'Exercises', label: 'Exercises', icon: 'barbell-outline',           iconOn: 'barbell',           tab: 'Exercises' },
  { key: 'Profile',   label: 'Profile',   icon: 'person-outline',            iconOn: 'person',            tab: 'Profile' },
  { key: 'Plans',     label: 'Plans',     icon: 'list-outline',              iconOn: 'list',              tab: 'Plans' },
  { key: 'Groups',    label: 'Groups',    icon: 'pricetags-outline',         iconOn: 'pricetags' },
  { key: 'Dojo',      label: 'Dojo',      icon: 'hand-left-outline',         iconOn: 'hand-left',         tab: 'Dojo' },
  { key: 'Guide',     label: 'Guide',     icon: 'information-circle-outline', iconOn: 'information-circle' },
];

// ── Overlay ──────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_W = Math.min(SCREEN_W * 0.82, 340);

export const OffcanvasNav: React.FC = () => {
  const { open, closeNav } = useNav();
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(false);
  const [active, setActive]   = useState<string>('Home');
  const [player, setPlayer]   = useState<Player | null>(null);

  const tx      = useRef(new Animated.Value(-PANEL_W)).current;
  const fade    = useRef(new Animated.Value(0)).current;

  const refreshPlayer = useCallback(() => {
    getPlayer().then(setPlayer).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setActive(navigationRef.getCurrentRoute()?.name ?? 'Home');
      refreshPlayer();
      setMounted(true);
      Animated.parallel([
        Animated.timing(tx,   { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(tx,   { toValue: -PANEL_W, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0,        duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (item: typeof MENU[number]) => {
    playSound('navigate');
    closeNav();
    if (item.tab) {
      navigationRef.navigate('Main', { screen: item.tab });
    } else if (item.key === 'Groups') {
      navigationRef.navigate('Groups', { kind: 'exercise' });
    } else {
      navigationRef.navigate('Guide');
    }
  };

  const openProfile = () => {
    playSound('navigate');
    closeNav();
    navigationRef.navigate('Main', { screen: 'Profile' });
  };

  if (!mounted) return null;

  const rank = player ? getRankForLevel(player.level) : null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={closeNav} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeNav} />
        </Animated.View>

        <Animated.View style={[styles.panel, { width: PANEL_W, transform: [{ translateX: tx }] }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 20 }}
          >
            {/* Brand */}
            <View style={styles.brand}>
              <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandName}>Beyond</Text>
              <Text style={styles.brandTag}>Your Journey · Your Evolution</Text>
            </View>

            {/* Profile block */}
            <TouchableOpacity style={styles.profile} activeOpacity={0.8} onPress={openProfile}>
              <View style={[styles.avatar, { borderColor: rank?.color ?? COLORS.accentCyan }]}>
                <Text style={[styles.avatarTxt, { color: rank?.color ?? COLORS.accentCyan }]}>
                  {rank?.rank ?? '?'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>{player?.name ?? 'Hunter'}</Text>
                <Text style={[styles.profileRank, { color: rank?.color ?? COLORS.textSecondary }]} numberOfLines={1}>
                  {rank?.label ?? 'Unranked'}{player ? `  ·  Lv. ${player.level}` : ''}
                </Text>
                {!!player?.title && <Text style={styles.profileTitle} numberOfLines={1}>「{player.title}」</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            {player && (
              <View style={styles.miniExp}>
                <View style={styles.miniExpBg}>
                  <View style={[styles.miniExpFill, { width: `${percentOf(player.exp, player.exp_to_next || 1)}%` }]} />
                </View>
              </View>
            )}

            <View style={styles.divider} />

            {/* Menu */}
            {MENU.map(item => {
              const on = active === item.key;
              return (
                <TouchableOpacity key={item.key} style={[styles.item, on && styles.itemOn]} activeOpacity={0.75} onPress={() => go(item)}>
                  <Ionicons name={on ? item.iconOn : item.icon} size={20} color={on ? COLORS.accentCyan : COLORS.textSecondary} />
                  <Text style={[styles.itemTxt, on && styles.itemTxtOn]}>{item.label}</Text>
                  {on && <View style={styles.itemDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Styles ───────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1, flexDirection: 'row' },
  backdrop:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)' },
  panel:      { backgroundColor: COLORS.bgSecondary, borderRightWidth: 1, borderRightColor: COLORS.accentCyan, paddingHorizontal: 18 },

  hamburger:  { paddingHorizontal: 12, paddingVertical: 4 },

  brand:      { alignItems: 'center', marginBottom: 18 },
  logo:       { width: 84, height: 84, marginBottom: 8 },
  brandName:  { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  brandTag:   { color: COLORS.accentCyan, fontSize: 10, fontWeight: '600', letterSpacing: 1.4, marginTop: 4, textTransform: 'uppercase' },

  profile:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.bgTertiary, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderMain, padding: 12 },
  avatar:     { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgPrimary },
  avatarTxt:  { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  profileInfo:{ flex: 1 },
  profileName:{ color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  profileRank:{ fontSize: 11, fontWeight: '700', marginTop: 1 },
  profileTitle:{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  miniExp:     { marginTop: 8 },
  miniExpBg:   { height: 4, backgroundColor: COLORS.borderMain, borderRadius: 2, overflow: 'hidden' },
  miniExpFill: { height: '100%', backgroundColor: COLORS.accentCyan, borderRadius: 2 },

  divider:    { height: 1, backgroundColor: COLORS.borderDim, marginVertical: 16 },

  item:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2 },
  itemOn:     { backgroundColor: COLORS.bgTertiary, borderWidth: 1, borderColor: COLORS.borderGlow },
  itemTxt:    { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600', letterSpacing: 0.3, flex: 1 },
  itemTxtOn:  { color: COLORS.accentCyan },
  itemDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accentCyan },
});
