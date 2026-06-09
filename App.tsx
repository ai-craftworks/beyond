import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'; // ← added useSafeAreaInsets

import { initDatabase, getPlayer } from './src/database/Database';
import { COLORS } from './src/constants/game';

import RegistrationScreen from './src/screens/RegistrationScreen';
import DashboardScreen    from './src/screens/DashboardScreen';
import ExercisesScreen    from './src/screens/ExercisesScreen';
import PlansScreen        from './src/screens/PlansScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import SessionScreen      from './src/screens/SessionScreen';
import { initAudio, playSound } from './src/utils/sounds';

export type RootStackParamList = {
  Registration: undefined;
  Main:         undefined;
  Session:      { sessionId: number };
};

export type TabParamList = {
  Dashboard: undefined;
  Exercises: undefined;
  Plans:     undefined;
  Profile:   undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

// ── Tab icon component ───────────────────────
// A simple wrapper that renders an emoji as the tab icon.
// `focused` controls whether it uses the active or inactive colour.
const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <Text style={{ fontSize: 20, color: focused ? COLORS.accentCyan : COLORS.textMuted }}>
    {emoji}
  </Text>
);

// ── Main tab navigator ───────────────────────
const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets(); // ← reads the phone's gesture nav bar height

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgSecondary,
          borderTopWidth: 1,
          borderTopColor: COLORS.borderMain,
          height: 62 + insets.bottom,        // ← adds phone nav bar space
          paddingBottom: insets.bottom + 4,  // ← pushes content above nav bar
          paddingTop: 8,
        },
        tabBarActiveTintColor:   COLORS.accentCyan,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Status',
          headerShown: true,
          headerTitle: 'Beyond',           // ← app name
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: COLORS.accentCyan,
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚔️" focused={focused} />,  // ← icon
        }}
      />
      <Tab.Screen
        name="Exercises"
        component={ExercisesScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Exercises',
          headerShown: true,
          headerTitle: 'Exercises',
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: COLORS.accentCyan,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏋️" focused={focused} />,  // ← icon
        }}
      />
      <Tab.Screen
        name="Plans"
        component={PlansScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Plans',
          headerShown: true,
          headerTitle: 'Plans',
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: COLORS.accentCyan,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,  // ← icon
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Profile',
          headerShown: true,
          headerTitle: 'Profile',
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: COLORS.accentCyan,
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,  // ← icon
        }}
      />
    </Tab.Navigator>
  );
};

// ── Root app ─────────────────────────────────
const App: React.FC = () => {
  const [appState, setAppState] = useState<'loading' | 'register' | 'main'>('loading');

  useEffect(() => { bootstrap(); }, []);

  const bootstrap = async () => {
    try {
      await initAudio();
      playSound('boot'); 
      await initDatabase();
      const player = await getPlayer();
      setAppState(player ? 'main' : 'register');
    } catch (e) {
      console.error('Bootstrap error:', e);
      setAppState('register');
    }
  };

  if (appState === 'loading') {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator color={COLORS.accentCyan} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={appState === 'register' ? 'Registration' : 'Main'}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.bgPrimary },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Registration" component={RegistrationScreen} />
          <Stack.Screen name="Main"         component={MainTabs} />
          <Stack.Screen
            name="Session"
            component={SessionScreen}
            options={{
              headerShown: true,
              headerTitle: 'Quest In Progress',
              headerStyle: styles.header,
              headerTitleStyle: styles.headerTitle,
              headerTintColor: COLORS.accentCyan,
              animation: 'slide_from_bottom',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: COLORS.bgPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderMain,
    elevation: 0, shadowOpacity: 0,
  },
  headerTitle: {
    color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.5,
  },
});

export default App;