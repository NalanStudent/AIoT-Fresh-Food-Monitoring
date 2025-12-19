import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, List, Switch, useTheme } from 'react-native-paper';
import { ThemeContext } from '../context/ThemeContext';

const SettingsScreen = () => {
  const theme = useTheme();
  const { isDark, toggleTheme } = useContext(ThemeContext);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <List.Section style={styles.section}>
        <List.Subheader style={{ color: theme.colors.onSurface }}>Appearance</List.Subheader>
        <List.Item
          title="Dark Mode"
          left={() => <List.Icon icon="theme-light-dark" style={{ marginLeft: 16 }} />}
          right={() => <Switch value={isDark} onValueChange={toggleTheme} />}
        />
      </List.Section>

      <List.Section style={styles.section}>
        <List.Subheader style={{ color: theme.colors.onSurface }}>Notifications</List.Subheader>
         <List.Item
          title="Push Alerts"
          left={() => <List.Icon icon="bell" style={{ marginLeft: 16 }} />}
          right={() => <Switch value={true} disabled />} // Placeholder
        />
      </List.Section>

      <List.Section style={styles.section}>
        <List.Subheader style={{ color: theme.colors.onSurface }}>Account</List.Subheader>
         <List.Item
          title="Logout"
          left={() => <List.Icon icon="logout" style={{ marginLeft: 16 }} />}
          onPress={() => console.log("Logout pressed")} // Placeholder
        />
      </List.Section>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: 16,
  }
});

export default SettingsScreen;