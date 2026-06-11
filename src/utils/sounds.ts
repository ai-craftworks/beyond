/**
 * src/utils/sounds.ts
 * ====================
 * Sound engine for Beyond using expo-audio (replaces deprecated expo-av).
 * All sounds are loaded once and cached. Fails silently so sound never
 * breaks the app.
 *
 * Sound events:
 *   boot        – deep system hum on app start
 *   navigate    – soft UI blip on screen change
 *   click       – crisp tap feedback on any button press
 *   exerciseDone – power hit when an exercise is checked off
 *   sessionDone – triumphant whoosh on session completion
 *   levelUp     – epic chime on level up
 *   title       – crystalline ping when a title is earned
 *   penalty     – low warning tone on missed quest penalty
 *   profile     – ambient system scan on profile open
 *   questStart  – tension build when entering a session
 */

import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// ─────────────────────────────────────────────
// SOUND SOURCES
// Using royalty-free sounds from freesound.org (CC0 public domain).
// Replace any URL with a local file: require('../../assets/sounds/click.mp3')
// ─────────────────────────────────────────────

const SOUNDS: Record<string, string | number> = {
  // Short deep power-on hum
  boot:         require("../../assets/sounds/boot.mp3"),
  // Soft UI blip — tab switches, screen transitions
  navigate:     require("../../assets/sounds/navigate.mp3"),
  // Crisp click — button taps
  click:        require('../../assets/sounds/click.mp3'),
  // Impact hit — exercise completion
  exerciseDone: require("../../assets/sounds/exerciseDone.mp3"),
  // Power whoosh — session complete
  sessionDone:  require("../../assets/sounds/sessionDone.mp3"),
  // Epic multi-tone chime — level up
  levelUp:      require('../../assets/sounds/levelup.mp3'),
  // Crystal ping — title earned
  title:        require('../../assets/sounds/title.mp3'),
  // Low warning drone — penalty applied
  penalty:      require('../../assets/sounds/penalty.mp3'),
  // Ambient scan — profile opened
  profile:      require('../../assets/sounds/profile.mp3'),
  // Tension swell — session started
  questStart:   require('../../assets/sounds/questStart.mp3'),
};

// Cache of loaded players
const cache: Map<string, AudioPlayer> = new Map();

// Volume levels per sound (0.0 – 1.0)
const VOLUMES: Record<string, number> = {
  boot:         0.6,
  navigate:     0.35,
  click:        0.45,
  exerciseDone: 0.75,
  sessionDone:  0.85,
  levelUp:      1.0,
  title:        0.9,
  penalty:      0.8,
  profile:      0.4,
  questStart:   0.65,
};

let audioReady = false;

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

/**
 * Call once at app startup (in App.tsx bootstrap).
 * Configures audio mode and pre-loads all sounds.
 */
export const initAudio = async (): Promise<void> => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,  // play even when phone is on silent
    });
    audioReady = true;
    // Pre-load all sounds in background so first play is instant
    preloadAll();
  } catch (e) {
    console.warn('Audio init failed:', e);
  }
};

/**
 * Plays a named sound. Safe to call even if audio failed to init.
 * Non-blocking — returns immediately, plays in background.
 */
export const playSound = (name: keyof typeof SOUNDS): void => {
  if (!audioReady) return;
  _play(name).catch(() => {}); // fire and forget, never throws
};

// ─────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────

const preloadAll = async () => {
  for (const name of Object.keys(SOUNDS)) {
    try {
      if (!cache.has(name)) {
        const player = createAudioPlayer(SOUNDS[name] as any);
        player.volume = VOLUMES[name] ?? 0.7;
        cache.set(name, player);
      }
    } catch (_) {}
  }
};

const _play = async (name: string): Promise<void> => {
  try {
    let player = cache.get(name);
    if (!player) {
      player = createAudioPlayer(SOUNDS[name] as any);
      player.volume = VOLUMES[name] ?? 0.7;
      cache.set(name, player);
    }
    // Rewind to start then play
    await player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn(`Sound "${name}" failed:`, e);
  }
};