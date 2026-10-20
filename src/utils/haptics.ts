/**
 * src/utils/haptics.ts
 * ====================
 * Thin wrapper over expo-haptics so every call site stays one line and
 * degrades silently (web / unsupported devices never throw).
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

let hapticsEnabled = true;

/** Master toggle — loaded from the settings store at bootstrap. */
export const setHapticsEnabled = (enabled: boolean): void => { hapticsEnabled = enabled; };
export const areHapticsEnabled = (): boolean => hapticsEnabled;

const safe = (fn: () => Promise<void>) => {
  if (!supported || !hapticsEnabled) return;
  fn().catch(() => {});
};

/** Light tap — button presses, row taps. */
export const hapticTap = (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Medium thud — completing an exercise / primary actions. */
export const hapticHeavy = (): void => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Success — session completed, level up, saved. */
export const hapticSuccess = (): void => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Warning — delete, penalty, abandon. */
export const hapticWarning = (): void => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
