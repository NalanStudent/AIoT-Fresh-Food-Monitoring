import { DefaultTheme } from 'react-native-paper';

// From mobile_design.txt
// Primary Action/Highlight: Golden Yellow (#FFC107)
// Primary Brand: Deep Navy (#00334E)
// Dark Mode Backgrounds: App(#141b1f), Card(#1e282e), Text(#E0E0E0)
// Light Mode Backgrounds: App(#F5F7FA), Card(#FFFFFF), Text(#263238)

const sharedColors = {
  primary: '#00334E', // Deep Navy
  accent: '#FFC107',  // Golden Yellow
  success: '#2E7D32', // Forest Green
  warning: '#EF6C00', // Orange
  critical: '#C62828', // Crimson Red
};

export const lightTheme = {
  ...DefaultTheme,
  roundness: 12,
  colors: {
    ...DefaultTheme.colors,
    primary: sharedColors.primary,
    accent: sharedColors.accent,
    background: '#F5F7FA', // Pale Gray
    surface: '#FFFFFF',     // Pure White
    text: '#263238',        // Dark Slate
    onSurface: '#263238',
    ...sharedColors,
  },
};

export const darkTheme = {
  ...DefaultTheme,
  dark: true,
  roundness: 12,
  mode: 'adaptive',
  colors: {
    ...DefaultTheme.colors,
    primary: sharedColors.primary,
    accent: sharedColors.accent,
    background: '#141b1f', // Deep Charcoal
    surface: '#1e282e',     // Dark Slate
    text: '#E0E0E0',        // Off-white
    onSurface: '#E0E0E0',
    ...sharedColors,
  },
};
