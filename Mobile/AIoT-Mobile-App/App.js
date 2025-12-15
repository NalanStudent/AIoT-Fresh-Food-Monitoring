import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider, ThemeContext } from './app/context/ThemeContext';
import { darkTheme, lightTheme } from './app/theme/theme';
import AppNavigator from './app/navigation/AppNavigator';

const AppContent = () => {
  const { isDark } = useContext(ThemeContext);
  const navigationTheme = isDark ? darkTheme : lightTheme;

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}