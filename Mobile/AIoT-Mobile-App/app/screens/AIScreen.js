import React, { useState, useCallback, useLayoutEffect, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, Chip } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Picker } from '@react-native-picker/picker';

// Get a reference to the functions service
const functions = getFunctions();
const askGemini = httpsCallable(functions, 'askGemini');

const initialMessages = [
  {
    id: '1',
    text: 'Hello! How can I help you with your supply chain today?',
    sender: 'ai',
  },
];

const promptChips = [
  "What is the status of all containers?",
  "Any critical alerts?",
  "Forecast temperature for container-001",
];

const AIScreen = ({ navigation }) => {
  const theme = useTheme();
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null); // null for 'All Containers'

  // Fetch containers for the dropdown
  useEffect(() => {
    const fetchContainers = async () => {
      const querySnapshot = await getDocs(collection(db, "containers"));
      const containerList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContainers(containerList);
    };
    fetchContainers();
  }, []);

  const handleClear = () => {
    setMessages(initialMessages);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleClear} style={{ marginRight: 15 }}>
          <MaterialCommunityIcons 
            name="trash-can-outline" 
            size={24} 
            color={theme.colors.text}
          />
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  const handleSend = useCallback(async (promptText) => {
    const textToSend = promptText || inputText;
    if (textToSend.trim().length === 0) return;

    const newMessage = {
      id: Math.random().toString(),
      text: textToSend,
      sender: 'user',
    };

    setMessages(prevMessages => [newMessage, ...prevMessages]);
    setInputText('');
    setLoading(true);

    try {
      // Include containerId if one is selected
      const payload = { prompt: textToSend };
      if (selectedContainer) {
        payload.containerId = selectedContainer;
      }

      const result = await askGemini(payload);
      const aiResponseText = result.data.response;

      const aiResponse = {
        id: Math.random().toString(),
        text: aiResponseText,
        sender: 'ai',
      };
      setMessages(prevMessages => [aiResponse, ...prevMessages]);

    } catch (error) {
      console.error("Error calling cloud function:", error);
      const errorResponse = {
        id: Math.random().toString(),
        text: 'Sorry, I ran into an error. Please try again.',
        sender: 'ai',
      };
      setMessages(prevMessages => [errorResponse, ...prevMessages]);
    } finally {
      setLoading(false);
    }
  }, [inputText, selectedContainer]);
  
  const handleChipPress = (prompt) => {
    handleSend(prompt);
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === 'user';
    const messageStyle = isUser ? styles.userMessage : styles.aiMessage;
    const textStyle = { color: isUser ? theme.colors.text : theme.colors.text };
    const bubbleStyle = { 
      backgroundColor: isUser ? theme.colors.accent + '80' : theme.colors.surface 
    };

    if (item.sender === 'loading') {
        return (
             <View style={[styles.messageContainer, styles.aiMessage]}>
                <View style={[styles.bubble, bubbleStyle]}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                </View>
            </View>
        )
    }

    return (
      <View style={[styles.messageContainer, messageStyle]}>
        <View style={[styles.bubble, bubbleStyle]}>
          <Text style={textStyle}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const displayMessages = loading 
    ? [{ id: 'loading', sender: 'loading' }, ...messages] 
    : messages;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          inverted
        />
        
        <View style={styles.contextContainer}>
          <Text style={{color: theme.colors.text, marginRight: 10, fontWeight: 'bold'}}>Focus:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedContainer}
              onValueChange={(itemValue) => setSelectedContainer(itemValue)}
              style={[styles.picker, { color: theme.colors.text }]}
              dropdownIconColor={theme.colors.text}
            >
              <Picker.Item label="All Containers" value={null} />
              {containers.map(c => (
                <Picker.Item key={c.id} label={c.id} value={c.id} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.chipContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {promptChips.map((prompt, index) => (
              <Chip 
                key={index}
                style={[styles.chip, { backgroundColor: theme.colors.surface }]} 
                textStyle={{ color: theme.colors.text }} 
                onPress={() => handleChipPress(prompt)}
                icon={() => (
                  <MaterialCommunityIcons 
                    name="arrow-up-circle-outline" 
                    size={20} 
                    color={theme.colors.accent} 
                  />
                )}
              >
                {prompt}
              </Chip>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]}>
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a question..."
            placeholderTextColor={theme.colors.onSurface}
            onSubmitEditing={() => handleSend()}
          />
          <Pressable onPress={() => handleSend()} style={styles.sendButton} disabled={loading}>
            <MaterialCommunityIcons name="send-circle" size={36} color={loading ? theme.colors.disabled : theme.colors.accent} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageList: { paddingHorizontal: 10, },
  messageContainer: { marginVertical: 5, maxWidth: '80%' },
  userMessage: { alignSelf: 'flex-end' },
  aiMessage: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 18 },
  contextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  chipContainer: { paddingVertical: 8, paddingLeft: 10, borderTopWidth: 1, borderTopColor: '#333' },
  chip: { marginRight: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  input: { flex: 1, height: 40, paddingHorizontal: 10, },
  sendButton: { marginLeft: 8 },
});

export default AIScreen;
