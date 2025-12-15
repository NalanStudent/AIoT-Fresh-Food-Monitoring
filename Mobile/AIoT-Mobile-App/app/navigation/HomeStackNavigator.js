import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from 'react-native-paper';

import HomeScreen from '../screens/HomeScreen';
import DeviceDetailScreen from '../screens/DeviceDetailScreen';

const Stack = createStackNavigator();

const HomeStackNavigator = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
      }}
    >
      <Stack.Screen 
        name="HomeDashboard" // A unique name for the screen in this stack
        component={HomeScreen} 
        options={{ headerShown: false }} // We'll use the header from the tab navigator
      />
      <Stack.Screen 
        name="DeviceDetail" 
        component={DeviceDetailScreen} 
        options={({ route }) => ({ 
          title: route.params.containerId, // Set the header title dynamically
        })}
      />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
