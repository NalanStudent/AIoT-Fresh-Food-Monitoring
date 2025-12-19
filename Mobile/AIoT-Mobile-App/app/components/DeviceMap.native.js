import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const DeviceMap = ({ latitude, longitude }) => (
  <MapView
    style={styles.map}
    initialRegion={{
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }}
  >
    <Marker coordinate={{ latitude, longitude }} />
  </MapView>
);

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 200,
    marginTop: 10,
  },
});

export default DeviceMap;
