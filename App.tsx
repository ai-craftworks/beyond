import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initDatabase, getPlayer } from './src/database/Database';
import { COLORS } from './src/constants/game';
import { initAudio } from './src/utils/sounds';

import RegistrationScreen from './src/screens/RegistrationScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import PlansScreen from './src/screens/PlansScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SessionScreen from './src/screens/SessionScreen';

export type RootStackParamList = {
  Registration: undefined;
  Main: undefined;
  Session: { sessionId: number };
};

export type TabParamList = {
  Dashboard: undefined;
  Exercises: undefined;
  Plans: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgSecondary,
          borderTopWidth: 1,
          borderTopColor: COLORS.borderMain,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.accentCyan,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ title: '⚔  Status', headerShown: true, headerStyle: styles.header, headerTitleStyle: styles.headerTitle, headerTintColor: COLORS.accentCyan }} />
      <Tab.Screen name="Exercises" component={ExercisesScreen}
        options={{ title: '🏋  Exercises', headerShown: true, headerStyle: styles.header, headerTitleStyle: styles.headerTitle, headerTintColor: COLORS.accentCyan }} />
      <Tab.Screen name="Plans" component={PlansScreen}
        options={{ title: '📋  Plans', headerShown: true, headerStyle: styles.header, headerTitleStyle: styles.headerTitle, headerTintColor: COLORS.accentCyan }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ title: '👤  Profile', headerShown: true, headerStyle: styles.header, headerTitleStyle: styles.headerTitle, headerTintColor: COLORS.accentCyan }} />
    </Tab.Navigator>
  )
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<'loading' | 'register' | 'main'>('loading');

  useEffect(() => { bootstrap(); }, []);

  const bootstrap = async () => {
    try {
      await initAudio(); 
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
          <Stack.Screen name="Main" component={MainTabs} />
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
