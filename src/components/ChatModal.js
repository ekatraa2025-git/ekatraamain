import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

const INITIAL_MESSAGES = [
    { id: '1', text: "Namaste! 🙏 I am Ekatraa AI.", sender: 'bot' },
    { id: '2', text: "I can help you plan weddings, funerals, birthdays, or any get-together. What are you looking for today?", sender: 'bot' }
];

export default function ChatModal({ visible, onClose }) {
    const { theme, isDarkMode } = useTheme();
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef(null);

    const sendMessage = async () => {
        const trimmed = inputText.trim();
        if (!trimmed) return;

        const history = messages.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            text: m.text,
        }));

        const userMsg = { id: Date.now().toString(), text: trimmed, sender: 'user' };
        setMessages((prev) => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            const { data, error } = await api.postAiChat({
                message: trimmed,
                history,
            });
            if (error) {
                const botMsg = {
                    id: (Date.now() + 1).toString(),
                    text: error.message || 'Could not reach Ekatraa AI. Check your connection and API settings.',
                    sender: 'bot',
                };
                setMessages((prev) => [...prev, botMsg]);
                return;
            }
            let reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
            if (/^model\s*:\s*claude/i.test(reply) && reply.length < 160) {
                reply = '';
            }
            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: reply || 'No reply from AI.',
                sender: 'bot',
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch (e) {
            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: e?.message || 'Something went wrong.',
                sender: 'bot',
            };
            setMessages((prev) => [...prev, botMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
        }
    }, [messages, isTyping]);

    const renderItem = ({ item }) => (
        <View style={[
            styles.messageBubble,
            item.sender === 'user' ? styles.userBubble : styles.botBubble,
            item.sender === 'user' ? { backgroundColor: theme.primary } : { backgroundColor: theme.inputBackground }
        ]}>
            <Text style={[
                styles.messageText,
                item.sender === 'user' ? { color: '#FFF' } : { color: theme.text }
            ]}>{item.text}</Text>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.text }]}>Ekatraa AI Support 🤖</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close-circle" size={30} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                {/* Chat Area */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.chatContent}
                    ListFooterComponent={isTyping ? (
                        <View style={styles.typingIndicator}>
                            <ActivityIndicator size="small" color={theme.primary} />
                            <Text style={[styles.typingText, { color: theme.textLight }]}>Ekatraa AI is typing...</Text>
                        </View>
                    ) : null}
                />

                {/* Input Area */}
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}>
                    <View style={[styles.inputContainer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Type a message..."
                            placeholderTextColor={theme.textLight}
                            onSubmitEditing={sendMessage}
                        />
                        <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: theme.primary }]}>
                            <Ionicons name="send" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    chatContent: {
        padding: 20,
        paddingBottom: 40,
    },
    messageBubble: {
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        maxWidth: '80%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 2,
    },
    botBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 2,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        paddingHorizontal: 20,
        marginRight: 12,
        borderWidth: 1,
    },
    sendBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
        marginTop: 5,
    },
    typingText: {
        marginLeft: 8,
        fontSize: 12,
        fontStyle: 'italic',
    }
});
