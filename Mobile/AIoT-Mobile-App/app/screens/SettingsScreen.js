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
        <List.Subheader>Appearance</List.Subheader>
        <List.Item
          title="Dark Mode"
          left={() => <List.Icon icon="theme-light-dark" />}
          right={() => <Switch value={isDark} onValueChange={toggleTheme} />}
        />
      </List.Section>

      <List.Section style={styles.section}>
        <List.Subheader>Notifications</List.Subheader>
         <List.Item
          title="Push Alerts"
          left={() => <List.Icon icon="bell" />}
          right={() => <Switch value={true} disabled />} // Placeholder
        />
      </List.Section>

      <List.Section style={styles.section}>
        <List.Subheader>Account</List.Subheader>
         <List.Item
          title="Logout"
          left={() => <List.Icon icon="logout" />}
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