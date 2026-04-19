import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { loadCurrentUser } from '../store';
import * as API from '../services/api';

import LoginScreen     from '../screens/LoginScreen';
import KYCScreen       from '../screens/KYCScreen';
import HomeScreen      from '../screens/HomeScreen';
import GigDetailScreen from '../screens/GigDetailScreen';
import MyGigsScreen    from '../screens/MyGigsScreen';
import ProfileScreen   from '../screens/ProfileScreen';
import { colors, typography } from '../utils/theme';

const Stack  = createNativeStackNavigator();
const Tab    = createBottomTabNavigator();

// ─── Main tab navigator ───────────────────────────────────────────────
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        const icons = {
          Home:    focused ? 'home'           : 'home-outline',
          MyGigs:  focused ? 'briefcase'      : 'briefcase-outline',
          Profile: focused ? 'person-circle'  : 'person-circle-outline',
        };
        return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
      },
      tabBarActiveTintColor:   colors.primary,
      tabBarInactiveTintColor: colors.textTertiary,
      tabBarStyle: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        height: 70,
        paddingBottom: 10,
        paddingTop: 6,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      headerStyle: {
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      headerTitleStyle: { ...typography.h4, color: colors.text },
      headerTintColor: colors.primary,
    })}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: 'KaamSetu', tabBarLabel: 'Home' }}
    />
    <Tab.Screen
      name="MyGigs"
      component={MyGigsScreen}
      options={{ title: 'My Gigs', tabBarLabel: 'My Gigs' }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'My Profile', tabBarLabel: 'Profile' }}
    />
  </Tab.Navigator>
);

// ─── Auth stack ───────────────────────────────────────────────────────
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

// ─── App stack (authenticated) ────────────────────────────────────────
const AppStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: colors.surface,
      },
      headerTintColor: colors.primary,
      headerTitleStyle: { ...typography.h4, color: colors.text },
      headerBackTitleVisible: false,
    }}
  >
    <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="KYC"       component={KYCScreen}       options={{ title: 'Verify Identity', headerBackVisible: false }} />
    <Stack.Screen name="GigDetail" component={GigDetailScreen} options={{ title: 'Gig Details' }} />
  </Stack.Navigator>
);

// ─── Root Navigator ───────────────────────────────────────────────────
export default function AppNavigator() {
  const dispatch  = useDispatch();
  const { user, bootstrapped } = useSelector(s => s.auth);

  useEffect(() => {
    // Try to restore session from stored token
    const bootstrap = async () => {
      const token = await API.getStoredToken();
      if (token) dispatch(loadCurrentUser());
      else        dispatch({ type: 'auth/loadCurrentUser/rejected' });
    };
    bootstrap();
  }, []);

  if (!bootstrapped) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
