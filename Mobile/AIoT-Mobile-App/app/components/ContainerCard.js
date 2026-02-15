import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import HealthMeter from './HealthMeter';

// Improved Health Calculation based on MQ4 (Gas) levels
const calculateHealth = (telemetry, thresholds) => {
  if (!telemetry || !thresholds) return 100; // Default to healthy if no data

  const { mq4_ppm } = telemetry;
  const { mq4 } = thresholds;

  // If no MQ4 data or no thresholds set, assume healthy
  if (mq4_ppm === undefined || mq4_ppm === null || !mq4) return 100;

  const { warn, critical } = mq4;

  // If thresholds are missing, return 100
  if (warn === undefined || warn === null || critical === undefined || critical === null) return 100;

  // 1. Critical or above: 0% Health (Spoiled)
  if (mq4_ppm >= critical) return 0;

  // 2. Below Warning: 100% - 50% Health (Linear scaling)
  // Logic: 0 ppm = 100%, Warn ppm = 50%
  if (mq4_ppm < warn) {
      // Scale: 0 -> 100%, warn -> 50%
      // Formula: 100 - (ppm / warn) * 50
      // Example: warn=100. ppm=0 -> 100%. ppm=50 -> 75%. ppm=100 -> 50%.
      const health = 100 - (mq4_ppm / warn) * 50;
      return Math.round(Math.max(50, health));
  }

  // 3. Between Warning and Critical: 50% - 0% Health (Rapid drop)
  // Logic: Warn = 50%, Critical = 0%
  // Formula: 50 - ((ppm - warn) / (critical - warn)) * 50
  const range = critical - warn;
  if (range <= 0) return 0; // Avoid division by zero
  
  const health = 50 - ((mq4_ppm - warn) / range) * 50;
  return Math.round(Math.max(0, health));
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
