import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'; // ← added useSafeAreaInsets

import { initDatabase, getPlayer } from './src/database/Database';
import type { Plan } from './src/database/Database';
import { COLORS } from './src/constants/game';
import { Ionicons } from '@expo/vector-icons';
import { NavProvider, OffcanvasNav, HamburgerButton } from './src/components/OffcanvasNav';
import { navigationRef } from './src/navigation/ref';

import RegistrationScreen from './src/screens/RegistrationScreen';
import DashboardScreen    from './src/screens/DashboardScreen';
import ExercisesScreen    from './src/screens/ExercisesScreen';
import PlansScreen        from './src/screens/PlansScreen';
import ManagePlanScreen   from './src/screens/ManagePlanScreen';
import WorkoutSelectScreen from './src/screens/WorkoutSelectScreen';
import MartialArtsScreen  from './src/screens/MartialArtsScreen';
import MartialArtDetailScreen from './src/screens/MartialArtDetailScreen';
import SkillDetailScreen  from './src/screens/SkillDetailScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import SessionScreen      from './src/screens/SessionScreen';
import AboutScreen from './src/screens/AboutScreen';
import { initAudio, playSound } from './src/utils/sounds';

export type RootStackParamList = {
  Registration: undefined;
  Main:         NavigatorScreenParams<TabParamList> | undefined;
  Session:      { sessionId: number };
  ManagePlan:   { plan: Plan };
  WorkoutSelect:
    | { mode: 'plan'; planId: number; planName: string }
    | { mode: 'bonus'; sessionId: number }
    | { mode: 'skill'; skillId: number; skillName: string };
  MartialArtDetail: { artId: number };
  SkillDetail:      { skillId: number };
  Guide:            undefined;
};

export type TabParamList = {
  Home:      undefined;
  Exercises: undefined;
  Profile:   undefined;
  Plans:     undefined;
  Dojo:      undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

// ── Main tab navigator ───────────────────────
const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets(); // ← reads the phone's gesture nav bar height

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: true,
        headerLeft: () => <HamburgerButton />,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTintColor: COLORS.accentCyan,
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
        name="Exercises"
        component={ExercisesScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Exercises',
          headerTitle: 'Exercises',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={22}
              color={focused ? COLORS.accentCyan : COLORS.textMuted} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Profile',
          headerTitle: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22}
              color={focused ? COLORS.accentCyan : COLORS.textMuted} />
          ),
        }}
      />

      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Home',
          headerTitle: 'Beyond',           // ← app name
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22}
              color={focused ? COLORS.accentCyan : COLORS.textMuted} />
          ),
        }}
      />

      <Tab.Screen
        name="Plans"
        component={PlansScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Plans',
          headerTitle: 'Plans',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={22}
              color={focused ? COLORS.accentCyan : COLORS.textMuted} />
          ),
        }}
      />

      <Tab.Screen
        name="Dojo"
        component={MartialArtsScreen}
        listeners={{ tabPress: () => playSound('navigate') }}
        options={{
          title: 'Dojo',
          headerTitle: 'Martial Arts',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'hand-left' : 'hand-left-outline'} size={22}
              color={focused ? COLORS.accentCyan : COLORS.textMuted} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// ── Root app ─────────────────────────────────
const App: React.FC = () => {
  const [appState, setAppState] = useState<'loading' | 'register' | 'main' | 'error'>('loading');
  const [bootstrapError, setBootstrapError] = useState<string>('');

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
      setBootstrapError(e instanceof Error ? e.message : String(e));
      setAppState('error');
    }
  };

  if (appState === 'loading') {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <Image source={require('./assets/images/logo.png')} style={styles.splashLogo} resizeMode="contain" />
        <Text style={styles.splashName}>Beyond</Text>
        <Text style={styles.splashTag}>Your Journey · Your Evolution</Text>
        <ActivityIndicator color={COLORS.accentCyan} size="large" style={styles.splashSpinner} />
      </View>
    );
  }

  if (appState === 'error') {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <Text style={styles.errorTitle}>SYSTEM FAILURE</Text>
        <Text style={styles.errorMsg}>
          The System failed to initialise. Please restart the app or reinstall if the problem persists.
        </Text>
        {!!bootstrapError && <Text style={styles.errorDetail}>{bootstrapError}</Text>}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavProvider>
        <NavigationContainer ref={navigationRef}>
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
            <Stack.Screen
              name="ManagePlan"
              component={ManagePlanScreen}
              options={({ route }) => ({
                headerShown: true,
                headerTitle: route.params.plan.name,
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.accentCyan,
                animation: 'slide_from_right',
              })}
            />
            <Stack.Screen
              name="WorkoutSelect"
              component={WorkoutSelectScreen}
              options={({ route }) => ({
                headerShown: true,
                headerTitle: route.params.mode === 'plan'
                  ? `Add to ${route.params.planName}`
                  : route.params.mode === 'skill'
                    ? `Add to ${route.params.skillName}`
                    : 'Add Bonus Quest',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.accentCyan,
                animation: 'slide_from_right',
              })}
            />
            <Stack.Screen
              name="MartialArtDetail"
              component={MartialArtDetailScreen}
              options={{
                headerShown: true,
                headerTitle: 'Martial Art',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.accentCyan,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="SkillDetail"
              component={SkillDetailScreen}
              options={{
                headerShown: true,
                headerTitle: 'Skill',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.accentCyan,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="Guide"
              component={AboutScreen}
              options={{
                headerShown: true,
                headerTitle: 'System Guide',
                headerLeft: () => <HamburgerButton />,
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.accentCyan,
                animation: 'slide_from_right',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <OffcanvasNav />
      </NavProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: COLORS.bgPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  splashLogo:    { width: 160, height: 160, marginBottom: 12 },
  splashName:    { color: COLORS.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: 6, textTransform: 'uppercase' },
  splashTag:     { color: COLORS.accentCyan, fontSize: 11, fontWeight: '600', letterSpacing: 2, marginTop: 6, textTransform: 'uppercase' },
  splashSpinner: { marginTop: 28 },
  errorTitle: {
    color: COLORS.accentRed, fontSize: 18, fontWeight: '800', letterSpacing: 2,
    marginBottom: 12,
  },
  errorMsg: {
    color: COLORS.textSecondary, fontSize: 14, textAlign: 'center',
    paddingHorizontal: 40, lineHeight: 20, marginBottom: 8,
  },
  errorDetail: {
    color: COLORS.textMuted, fontSize: 12, textAlign: 'center',
    paddingHorizontal: 40,
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