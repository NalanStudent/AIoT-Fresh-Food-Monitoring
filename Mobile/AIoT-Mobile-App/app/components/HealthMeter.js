import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

const HealthMeter = ({ percentage }) => {
  const theme = useTheme();

  const getColor = () => {
    if (percentage > 75) return theme.colors.success; // Green
    if (percentage > 40) return theme.colors.warning; // Orange
    return theme.colors.critical; // Red
  };

  const meterStyle = {
    backgroundColor: getColor(),
    width: `${percentage}%`,
  };

  return (
    <View style={styles.container}>
      <View style={[styles.meter, meterStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 8,
    width: '100%',
    backgroundColor: '#404040', // A neutral dark background for the bar
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  meter: {
    height: '100%',
  },
});

export default HealthMeter;
