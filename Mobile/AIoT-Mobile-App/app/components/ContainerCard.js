import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import HealthMeter from './HealthMeter';

// A simple utility to calculate health based on one metric.
// In a real app, this would be more complex, considering all metrics.
const calculateHealth = (telemetry, thresholds) => {
  if (!telemetry || !thresholds) return 100; // Default to healthy if no data

  const { temperature_c } = telemetry;
  const { temperature } = thresholds;

  if (!temperature || temperature_c === undefined) return 100;

  const { warn, critical } = temperature;

  if (temperature_c >= critical) return 25;
  if (temperature_c >= warn) return 50;

  // Simple linear scale from warn (51%) to healthy (100%)
  const safeRange = warn - 5; // Assuming 'healthy' is 5 degrees below warn
  const health = Math.max(51, ((warn - temperature_c) / (warn - safeRange)) * 49 + 51);
  
  return Math.min(100, Math.round(health));
};


const ContainerCard = ({ container, onPress }) => {
  const theme = useTheme();
  const { device_id, selected_food_type, latest_telemetry, status, threshold_overrides, active_alerts } = container;

  const healthPercentage = calculateHealth(latest_telemetry, threshold_overrides);

  const isOnline = status?.state === 'online';
  const cardStyle = {
    ...styles.card,
    backgroundColor: theme.colors.surface,
    opacity: isOnline ? 1 : 0.8,
  };

  return (
    <Pressable onPress={onPress}>
      <Card style={cardStyle}>
        <Card.Content>
          <View style={styles.header}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{device_id}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusIndicator, { backgroundColor: isOnline ? theme.colors.success : theme.colors.disabled }]} />
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          <Text variant="bodyMedium" style={styles.cargoText}>
            Cargo: {selected_food_type || 'Not Set'}
          </Text>

          <View style={styles.telemetryRow}>
            <View style={styles.telemetryItem}>
              <MaterialCommunityIcons name="thermometer" size={16} color={theme.colors.text} />
              <Text style={styles.telemetryText}>
                {latest_telemetry?.temperature_c?.toFixed(1) ?? '--'}°C
              </Text>
            </View>
            <View style={styles.telemetryItem}>
              <MaterialCommunityIcons name="water-percent" size={16} color={theme.colors.text} />
              <Text style={styles.telemetryText}>
                {latest_telemetry?.humidity_pct?.toFixed(1) ?? '--'}%
              </Text>
            </View>
          </View>
          
          <HealthMeter percentage={healthPercentage} />

        </Card.Content>
        {active_alerts > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: theme.colors.critical }]}>
            <Text style={styles.alertText}>{active_alerts} CRITICAL ALERT(S)</Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden', // to make banner corners rounded
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cargoText: {
    marginBottom: 12,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryText: {
    marginLeft: 5,
  },
  alertBanner: {
    padding: 8,
    alignItems: 'center',
  },
  alertText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default ContainerCard;
