import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Text, useTheme, Chip } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Get a reference to the functions service
const functions = getFunctions();
// Get a reference to the callable function
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

const AIScreen = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

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
      // Call the cloud function
      const result = await askGemini({ prompt: textToSend });
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
  }, [inputText]);
  
  const handleChipPress = (prompt) => {
    handleSend(prompt);
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.sender === 'user';
    const messageStyle = isUser ? styles.userMessage : styles.aiMessage;
    const textStyle = { color: isUser ? '#FFFFFF' : theme.colors.text };
    const bubbleStyle = { 
      backgroundColor: isUser ? theme.colors.primary : theme.colors.surface 
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

  // Add a temporary loading message while the AI is "thinking"
  const displayMessages = loading 
    ? [{ id: 'loading', sender: 'loading' }, ...messages] 
    : messages;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={displayMessages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        inverted
      />
      
      <View style={styles.chipContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {promptChips.map((prompt, index) => (
            <Chip 
              key={index}
              style={styles.chip} 
              onPress={() => handleChipPress(prompt)}
              icon="arrow-up-circle-outline"
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
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageList: { paddingHorizontal: 10, },
  messageContainer: { marginVertical: 5, maxWidth: '80%' },
  userMessage: { alignSelf: 'flex-end' },
  aiMessage: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 18 },
  chipContainer: { paddingVertical: 8, paddingLeft: 10, borderTopWidth: 1, borderTopColor: '#333' },
  chip: { marginRight: 8, backgroundColor: 'rgba(255, 193, 7, 0.1)'},
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  input: { flex: 1, height: 40, paddingHorizontal: 10, },
  sendButton: { marginLeft: 8 },
});

export default AIScreen;
