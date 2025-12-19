import { DefaultTheme } from 'react-native-paper';

// From mobile_design.txt
// Primary Action/Highlight: Golden Yellow (#FFC107)
// Primary Brand: Deep Navy (#00334E)
// Dark Mode Backgrounds: App(#141b1f), Card(#1e282e), Text(#E0E0E0)
// Light Mode Backgrounds: App(#F5F7FA), Card(#FFFFFF), Text(#263238)

const sharedColors = {
  primary: '#00334E', // Deep Navy
  accent: '#FFC107',  // Golden Yellow
  success: '#43c249ff', // Forest Green
  warning: '#ef9043ff', // Orange
  critical: '#ce5555ff', // Crimson Red
};

export const lightTheme = {
  ...DefaultTheme,
  roundness: 12,
  colors: {
    ...DefaultTheme.colors,
    primary: sharedColors.primary,
    accent: sharedColors.accent,
    background: '#fbf5d4ff', // Pale Gray
    surface: '#ffffffff',     // Pure White
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
    surface: '#1c303cff',     // Dark Slate
    text: '#E0E0E0',        // Off-white
    onSurface: '#e0e0e0ff',
    ...sharedColors,
  },
};
