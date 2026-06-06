/**
 * src/utils/sounds.ts
 * ====================
 * Solo Leveling-style sound effects using expo-av.
 * All sounds use freely available public domain audio URLs.
 * Loaded lazily (only when first played) to avoid blocking startup.
 */

import { Audio } from 'expo-av';

// Keep loaded sounds cached so they don't reload every time
const cache: Record<string, Audio.Sound> = {};

// Public domain / royalty-free sound URLs
// Replace these with your own .mp3 files in /assets/sounds/ if preferred
const SOUND_URLS: Record<string, any> = {
    // Short UI click — played when tapping a button or completing an exercise
    //   click: 'https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3',
    // Whoosh / power sound — played when finishing a session
    //   complete: 'https://cdn.freesound.org/previews/270/270404_5123851-lq.mp3',
    // Bell / chime — played when levelling up
    //   levelup: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
    // Short success ping — played when earning a title
    //   title: 'https://cdn.freesound.org/previews/411/411642_5121236-lq.mp3',
    click: require('../../assets/sounds/click.mp3'),
    complete: require('../../assets/sounds/complete.mp3'),
    levelup: require('../../assets/sounds/levelup.mp3'),
    title: require('../../assets/sounds/title.mp3'),
};

/**
 * Call this once at app startup (in App.tsx useEffect) to configure audio.
 */
export const initAudio = async (): Promise<void> => {
    await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
    });
};

/**
 * Plays a named sound effect. Loads it on first play, then reuses cached version.
 * Fails silently if the sound cannot load (e.g. no internet on first launch).
 */
export const playSound = async (name: keyof typeof SOUND_URLS): Promise<void> => {
    try {
        if (!cache[name]) {
            const { sound } = await Audio.Sound.createAsync( SOUND_URLS[name] );
            cache[name] = sound;
        }
        // Rewind to start in case it was played before
        await cache[name].setPositionAsync(0);
        await cache[name].playAsync();
    } catch (e) {
        // Silent fail — sound is enhancement, not critical
        console.warn('Sound play failed:', name, e);
    }
};

/**
 * Unloads all cached sounds. Call when app goes to background (optional cleanup).
 */
export const unloadSounds = async (): Promise<void> => {
    for (const sound of Object.values(cache)) {
        await sound.unloadAsync();
    }
};