import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DeviceMap = () => (
  <View style={styles.mapPlaceholder}>
    <Text>Maps are not available on the web.</Text>
  </View>
);

const styles = StyleSheet.create({
  mapPlaceholder: {
    width: '100%',
    height: 200,
    marginTop: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
});

export default DeviceMap;
