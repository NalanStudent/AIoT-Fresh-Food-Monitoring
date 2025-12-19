import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme, Card, Text } from 'react-native-paper';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { LineChart } from 'react-native-chart-kit';

import { db } from '../services/firebaseConfig';
import DeviceMap from '../components/DeviceMap';

const DeviceDetailScreen = ({ route }) => {
  const theme = useTheme();
  const { containerId } = route.params;

  const [container, setContainer] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch container static data
    const fetchContainerData = async () => {
      const docRef = doc(db, 'containers', containerId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setContainer({ id: docSnap.id, ...docSnap.data() });
      }
    };
    fetchContainerData();

    // Listener for real-time telemetry
    const telemetryQuery = query(collection(db, 'containers', containerId, 'telemetry'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeTelemetry = onSnapshot(telemetryQuery, (snapshot) => {
      const telemetryData = snapshot.docs.map(doc => ({...doc.data(), id: doc.id })).reverse(); // reverse to show oldest first on chart
      setTelemetry(telemetryData);
      if(loading) setLoading(false);
    });

    // Listener for real-time alerts from the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const alertsQuery = query(
      collection(db, 'containers', containerId, 'alerts'),
      where('timestamp', '>=', oneHourAgo.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => ({...doc.data(), id: doc.id }));
      setAlerts(alertsData);
    });

    return () => {
      unsubscribeTelemetry();
      unsubscribeAlerts();
    };
  }, [containerId]);

  const latestTelemetry = container?.latest_telemetry || {};
  const isOnline = container?.status?.state === 'online';

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => `rgba(${theme.dark ? '255, 255, 255' : '38, 50, 56'}, ${opacity})`, // Text color for chart
    strokeWidth: 2,
    propsForDots: { r: "4", strokeWidth: "2", stroke: theme.colors.accent },
  };

  const tempChartData = {
    labels: telemetry.map((t, index) => index % 5 === 0 ? new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''), // Show every 5th label
    datasets: [{ data: telemetry.map(t => t.temperature_c || 0) }],
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Status Summary Card */}
      <Card style={[styles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Text style={styles.title}>Status Summary</Text>
          <Text>Food Type: {container?.selected_food_type || 'N/A'}</Text>
          <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
          <Text>Last Seen: {container?.last_seen ? new Date(container.last_seen).toLocaleString() : 'N/A'}</Text>
        </Card.Content>
      </Card>

      {/* Live Telemetry Grid */}
      <Card style={[styles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Text style={styles.title}>Live Telemetry</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}><Text>Temperature</Text><Text style={styles.gridValue}>{`${latestTelemetry.temperature_c?.toFixed(1) ?? '--'}°C`}</Text></View>
            <View style={styles.gridItem}><Text>Humidity</Text><Text style={styles.gridValue}>{`${latestTelemetry.humidity_pct?.toFixed(1) ?? '--'}%`}</Text></View>
            <View style={styles.gridItem}><Text>MQ4 Gas</Text><Text style={styles.gridValue}>{`${latestTelemetry.mq4_ppm ?? '--'} ppm`}</Text></View>
            <View style={styles.gridItem}><Text>Satellites</Text><Text style={styles.gridValue}>{latestTelemetry.gps?.satellites ?? '--'}</Text></View>
          </View>
        </Card.Content>
      </Card>

      {/* GPS Location Card (Always Rendered) */}
      <Card style={[styles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Text style={styles.title}>GPS Location</Text>

          {latestTelemetry.gps?.fix && latestTelemetry.gps?.lat !== undefined && latestTelemetry.gps?.lon !== undefined ? (
            <DeviceMap latitude={latestTelemetry.gps.lat} longitude={latestTelemetry.gps.lon} />
          ) : (
            <View style={styles.noLocationContainer}>
              <Text style={{color: theme.colors.text}}>Current Location not Found...</Text>
            </View>
          )}
        </Card.Content>
      </Card>
      
      {/* Historical Data Chart */}
      {telemetry.length > 1 && (
        <Card style={[styles.card, {backgroundColor: theme.colors.surface}]}>
          <Card.Content>
            <Text style={styles.title}>Temperature History (°C)</Text>
            <LineChart
              data={tempChartData}
              width={Dimensions.get('window').width - 48} // card padding
              height={220}
              chartConfig={chartConfig}
              bezier
            />
          </Card.Content>
        </Card>
      )}

      {/* Recent Alerts List */}
      <Card style={[styles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Text style={styles.title}>Recent Alerts</Text>
          {alerts.length > 0 ? alerts.map(alert => (
            <View key={alert.id} style={styles.alertItem}>
              <View style={[styles.alertDot, {backgroundColor: theme.colors[alert.level] || theme.colors.text}]} />
              <Text style={{flex: 1}}>{alert.message} at {new Date(alert.timestamp).toLocaleTimeString()}</Text>
            </View>
          )) : <Text>No recent alerts.</Text>}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    margin: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  gridItem: { width: '45%', alignItems: 'center', marginVertical: 10 },
  gridValue: { fontSize: 24, fontWeight: 'bold' },
  alertItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  noLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 200, // Match map height for consistency
    marginTop: 10,
  },
});

export default DeviceDetailScreen;