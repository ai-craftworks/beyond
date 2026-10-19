/**
 * ESLint flat config for Beyond (SDK 57).
 * `npm run lint` → eslint .   (CI runs typecheck + lint + tests)
 */

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'android/**',
      'ios/**',
      '.expo/**',
      'dist/**',
      'node_modules/**',
      'memory/**',
    ],
  },
  {
    rules: {
      // React Compiler rules below don't model common React Native idioms:
      // `refs` fires on standard Animated.Value refs used in render, and
      // `set-state-in-effect` fires on the modal "reset form when opened"
      // pattern. Keep both visible as warnings without failing CI; the
      // remaining react-hooks rules (exhaustive-deps, etc.) stay as-is.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
