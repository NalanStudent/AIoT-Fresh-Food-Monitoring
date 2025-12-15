import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme, Card, Title, Paragraph } from 'react-native-paper';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import MapView, { Marker } from 'react-native-maps';
import { LineChart } from 'react-native-chart-kit';

import { db } from '../services/firebaseConfig';

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

    // Listener for real-time alerts
    const alertsQuery = query(collection(db, 'containers', containerId, 'alerts'), orderBy('timestamp', 'desc'), limit(10));
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
    color: (opacity = 1) => `rgba(${theme.dark ? '224, 224, 224' : '38, 50, 56'}, ${opacity})`, // Text color
    strokeWidth: 2,
    propsForDots: { r: "4", strokeWidth: "2", stroke: theme.colors.accent },
  };

  const tempChartData = {
    labels: telemetry.map(t => new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})),
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
      <Card style={styles.card}>
        <Card.Content>
          <Title>Status Summary</Title>
          <Paragraph>Food Type: {container?.selected_food_type || 'N/A'}</Paragraph>
          <Paragraph>Status: {isOnline ? 'Online' : 'Offline'}</Paragraph>
          <Paragraph>Last Seen: {container?.last_seen ? new Date(container.last_seen).toLocaleString() : 'N/A'}</Paragraph>
        </Card.Content>
      </Card>

      {/* Live Telemetry Grid */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Live Telemetry</Title>
          <View style={styles.grid}>
            <View style={styles.gridItem}><Text>Temperature</Text><Text style={styles.gridValue}>{latestTelemetry.temperature_c?.toFixed(1) ?? '--'}°C</Text></View>
            <View style={styles.gridItem}><Text>Humidity</Text><Text style={styles.gridValue}>{latestTelemetry.humidity_pct?.toFixed(1) ?? '--'}%</Text></View>
            <View style={styles.gridItem}><Text>MQ4 Gas</Text><Text style={styles.gridValue}>{latestTelemetry.mq4_ppm ?? '--'} ppm</Text></View>
            <View style={styles.gridItem}><Text>Satellites</Text><Text style={styles.gridValue}>{latestTelemetry.gps?.satellites ?? '--'}</Text></View>
          </View>
        </Card.Content>
      </Card>

      {/* GPS Location Card */}
      {latestTelemetry.gps?.lat && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>GPS Location</Title>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: latestTelemetry.gps.lat,
                longitude: latestTelemetry.gps.lon,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={{ latitude: latestTelemetry.gps.lat, longitude: latestTelemetry.gps.lon }} />
            </MapView>
          </Card.Content>
        </Card>
      )}
      
      {/* Historical Data Chart */}
      {telemetry.length > 1 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Temperature History (°C)</Title>
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
      <Card style={styles.card}>
        <Card.Content>
          <Title>Recent Alerts</Title>
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
  card: { margin: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  gridItem: { width: '45%', alignItems: 'center', marginVertical: 10 },
  gridValue: { fontSize: 24, fontWeight: 'bold' },
  map: { width: '100%', height: 200, marginTop: 10 },
  alertItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
});

export default DeviceDetailScreen;