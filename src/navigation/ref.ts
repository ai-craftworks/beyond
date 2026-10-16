/**
 * src/navigation/ref.ts
 * ======================
 * Global navigation ref so non-screen UI (the offcanvas nav overlay)
 * can drive navigation without being mounted inside a screen.
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
