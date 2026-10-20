/**
 * src/navigation/ref.ts
 * ======================
 * Global navigation ref so non-screen UI (the offcanvas nav overlay)
 * can drive navigation without being mounted inside a screen.
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';
import { playSound } from '../utils/sounds';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Plays the `navigate` blip only when the destination actually differs from
 * the current route — re-pressing the tab/sidebar item you are already on
 * stays silent, so navigation never stacks a second sound on arrival.
 */
export const playNavSound = (target: string): void => {
  if (navigationRef.getCurrentRoute()?.name !== target) playSound('navigate');
};
