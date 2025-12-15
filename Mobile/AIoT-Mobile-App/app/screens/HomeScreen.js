import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import { collection, onSnapshot, query } from 'firebase/firestore';

import { db } from '../services/firebaseConfig';
import ContainerCard from '../components/ContainerCard';

const HomeScreen = ({ navigation }) => {
  const theme = useTheme();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'containers'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const containersData = [];
      querySnapshot.forEach((doc) => {
        containersData.push({ id: doc.id, ...doc.data() });
      });
      setContainers(containersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching containers: ", error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleCardPress = (containerId) => {
    // Navigate to Device Detail Screen, passing the containerId as a param
    navigation.navigate('DeviceDetail', { containerId });
  };
  
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={containers}
        renderItem={({ item }) => (
          <ContainerCard
            container={item}
            onPress={() => handleCardPress(item.id)}
          />
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.container}>
            <Text style={{color: theme.colors.text}}>No containers found.</Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 8 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;