import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Import screens and navigators
import HomeStackNavigator from './HomeStackNavigator'; // <-- Import the new stack navigator
import AIScreen from '../screens/AIScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        tabBarActiveTintColor: theme.colors.accent, // Golden Yellow
        tabBarInactiveTintColor: theme.colors.onSurface,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
        },
      }}
    >
      <Tab.Screen
        name="HomeStack" // <-- Changed name for clarity
        component={HomeStackNavigator} // <-- Use the stack navigator here
        options={{
          title: 'Dashboard',
          headerShown: false, // Hide the tab header, the stack has its own
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="AI Assist"
        component={AIScreen}
        options={{
          title: 'AI Assistant',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="robot" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;
