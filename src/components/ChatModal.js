import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { sanitizeAiDisplayText } from '../utils/sanitizeAiDisplayText';
import AssistantMarkdownMessage from './AssistantMarkdownMessage';
import { colors as brandColors } from '../theme/colors';

const USE_MASTRA_PLANNING =
    process.env.EXPO_PUBLIC_AI_PLANNING === '1' || process.env.EXPO_PUBLIC_AI_PLANNING === 'true';

const SUGGESTED_PROMPTS = [
    'Plan a wedding in Bhubaneswar on a mid-range budget',
    'What services do you offer for a child’s birthday party?',
    'Compare package tiers and what’s included in each',
    'Suggest vendors for traditional Odia catering',
];

const CART_LINE = /(?:^|\n)CART_ACTIONS:(\{[\s\S]*\})\s*$/m;
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function splitCartActions(fullText) {
    const t = String(fullText ?? '');
    const m = t.match(CART_LINE);
    if (!m) {
        return { display: t.trim(), items: [] };
    }
    let items = [];
    try {
        const j = JSON.parse(m[1]);
        if (j && Array.isArray(j.items)) {
            for (const row of j.items) {
                const sid = row && typeof row.service_id === 'string' ? row.service_id.trim() : '';
                if (!UUID_RE.test(sid)) continue;
                const q = Math.min(100, Math.max(1, Math.floor(Number(row.quantity)) || 1));
                const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : null;
                items.push({ service_id: sid, quantity: q, ...(label ? { label } : {}) });
            }
        }
    } catch {
        /* ignore */
    }
    const display = t.replace(CART_LINE, '').trim();
    return { display, items };
}

function buildWelcomeMessages(city, occasionName) {
    const place = city ? ` in ${city}` : '';
    const occ = occasionName
        ? ` If you're planning ${occasionName}, we can talk through budget areas and what to explore next in the app.`
        : '';
    return [
        // { id: '1', text: `Namaste! 🙏 I'm Ekatraa AI — here to help with gatherings using what's in the Ekatraa app${place}.`, sender: 'bot' },
        // { id: '2', text: `Ask about occasions, spending areas, or what to book.${occ} I'll suggest real categories and service types from our catalog when it helps.`, sender: 'bot' },
    ];
}

export default function ChatModal({ visible, onClose, city, occasionId, occasionName, plannedBudgetInr, navigation }) {
    const { theme, isDarkMode } = useTheme();
    const { showToast } = useToast();
    const { isAuthenticated, user } = useAuth();
    const { cartId, setCartId, refreshCartCount } = useCart();
    const insets = useSafeAreaInsets();
    const planningThreadIdRef = useRef(`app-chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    const [messages, setMessages] = useState(() => buildWelcomeMessages(city, occasionName));
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [addingServiceId, setAddingServiceId] = useState(null);
    const flatListRef = useRef(null);
    const prevVisibleRef = useRef(false);

    useEffect(() => {
        if (visible && !prevVisibleRef.current) {
            setMessages(buildWelcomeMessages(city, occasionName));
        }
        prevVisibleRef.current = visible;
    }, [visible, city, occasionName]);

    const MAX_MESSAGE_LENGTH = 2000;

    const onSelectChip = useCallback((text) => {
        const t = String(text || '').trim();
        if (!t) return;
        setInputText(t);
    }, []);

    const ensureCart = useCallback(async () => {
        if (cartId) return cartId;
        const { data, error } = await api.createCart({
            session_id: 'chat-' + Date.now(),
            user_id: isAuthenticated && user?.id ? user.id : null,
            event_name: occasionName || null,
            location_preference: city || null,
            planned_budget_inr: typeof plannedBudgetInr === 'number' && plannedBudgetInr > 0 ? plannedBudgetInr : null,
        });
        if (error) {
            showToast({ variant: 'error', title: 'Cart', message: error.message || 'Could not start a cart.' });
            return null;
        }
        const id = data?.id;
        if (id) {
            await setCartId(id);
            return id;
        }
        return null;
    }, [cartId, setCartId, isAuthenticated, user?.id, occasionName, city, plannedBudgetInr, showToast]);

    const addServiceToCart = useCallback(
        async (serviceId, label) => {
            const sid = String(serviceId || '').trim();
            if (!sid) return;
            setAddingServiceId(sid);
            try {
                const cid = await ensureCart();
                if (!cid) return;
                const { error } = await api.addCartItem({
                    cart_id: cid,
                    service_id: sid,
                    quantity: 1,
                    unit_price: null,
                    options: { source: 'ai_chat', label: label || null },
                });
                if (error) {
                    showToast({ variant: 'error', title: 'Could not add', message: error.message || 'Try again from the service page.' });
                    return;
                }
                await refreshCartCount(cid);
                showToast({
                    variant: 'success',
                    title: 'Added to cart',
                    message: (label && String(label)) || 'Service added.',
                    action: navigation
                        ? { label: 'View cart', onPress: () => navigation.navigate('Cart') }
                        : undefined,
                });
            } finally {
                setAddingServiceId(null);
            }
        },
        [ensureCart, refreshCartCount, showToast, navigation]
    );

    const sendWithText = useCallback(
        async (rawText) => {
            const trimmed = String(rawText || '').trim();
            if (!trimmed || isTyping) return;
            if (trimmed.length > MAX_MESSAGE_LENGTH) {
                showToast({
                    variant: 'error',
                    title: 'Message too long',
                    message: `Please keep messages under ${MAX_MESSAGE_LENGTH} characters.`,
                });
                return;
            }

            const history = messages.map((m) => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                text: splitCartActions(String(m.text ?? '')).display,
            }));

            const userMsg = { id: Date.now().toString(), text: trimmed, sender: 'user' };
            setMessages((prev) => [...prev, userMsg]);
            setInputText('');
            setIsTyping(true);

            try {
                const chatBody = {
                    message: trimmed,
                    history,
                    ...(city ? { city: String(city) } : {}),
                    ...(occasionId != null && String(occasionId).length > 0 ? { occasion_id: String(occasionId) } : {}),
                    ...(occasionName ? { occasion_name: String(occasionName) } : {}),
                    ...(typeof plannedBudgetInr === 'number' && plannedBudgetInr > 0 && Number.isFinite(plannedBudgetInr)
                        ? { planned_budget_inr: plannedBudgetInr }
                        : {}),
                };
                const { data, error } = USE_MASTRA_PLANNING
                    ? await api.postAiPlanningMessage(chatBody, planningThreadIdRef.current)
                    : await api.postAiChat(chatBody);
                if (error) {
                    const rawErr = error.message || 'Could not reach Ekatraa AI. Check your connection and API settings.';
                    setMessages((prev) => [...prev, { id: String(Date.now() + 1), text: rawErr, sender: 'bot' }]);
                    return;
                }
                const rawR = typeof data?.reply === 'string' ? data.reply : '';
                const reply = sanitizeAiDisplayText(rawR);
                setMessages((prev) => [
                    ...prev,
                    { id: String(Date.now() + 1), text: reply || 'No reply from AI.', sender: 'bot' },
                ]);
            } catch (e) {
                setMessages((prev) => [
                    ...prev,
                    { id: String(Date.now() + 1), text: e?.message || 'Something went wrong.', sender: 'bot' },
                ]);
            } finally {
                setIsTyping(false);
            }
        },
        [
            isTyping,
            messages,
            city,
            occasionId,
            occasionName,
            plannedBudgetInr,
            showToast,
        ]
    );

    const sendMessage = () => {
        void sendWithText(inputText);
    };

    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
        }
    }, [messages, isTyping]);

    const showEmptySuggestions = useMemo(
        () => !messages.some((m) => m.sender === 'user') && messages.length <= 2,
        [messages]
    );

    const renderMessage = useCallback(
        ({ item }) => {
            if (item.sender === 'user') {
                return (
                    <View style={styles.userRow}>
                        <LinearGradient
                            colors={[brandColors.primary, brandColors.primaryGradientEnd || brandColors.gradientEnd || '#FFA040']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.userBubble}
                        >
                            <Text style={styles.userText}>{item.text}</Text>
                        </LinearGradient>
                    </View>
                );
            }

            const { display, items } = splitCartActions(item.text);
            return (
                <View style={styles.assistantRow}>
                    <View style={[styles.assistantIcon, { borderColor: theme.border, backgroundColor: theme.card }]}>
                        <Text style={styles.assistantIconText}>✦</Text>
                    </View>
                    <View style={[styles.assistantCol, { borderColor: theme.border, backgroundColor: theme.card }]}>
                        {display ? (
                            <AssistantMarkdownMessage
                                content={display}
                                theme={theme}
                                colors={brandColors}
                                isDarkMode={isDarkMode}
                                onSelectChip={onSelectChip}
                            />
                        ) : (
                            <Text style={{ color: theme.text }}> </Text>
                        )}
                        {items.length > 0 ? (
                            <View style={styles.cartActions}>
                                {items.map((it) => (
                                    <TouchableOpacity
                                        key={it.service_id}
                                        style={[styles.addCartBtn, { borderColor: brandColors.primary }]}
                                        onPress={() => addServiceToCart(it.service_id, it.label)}
                                        disabled={addingServiceId != null}
                                    >
                                        {addingServiceId === it.service_id ? (
                                            <ActivityIndicator size="small" color={brandColors.primary} />
                                        ) : (
                                            <>
                                                <Ionicons name="cart" size={16} color={brandColors.primary} />
                                                <Text style={[styles.addCartBtnText, { color: brandColors.primary }]} numberOfLines={1}>
                                                    Add: {it.label || it.service_id.slice(0, 8) + '…'}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                    </View>
                </View>
            );
        },
        [theme, isDarkMode, onSelectChip, addServiceToCart, addingServiceId]
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <View>
                        <Text style={[styles.title, { color: theme.text }]}>Plan with Ekatraa</Text>
                        <Text style={[styles.subtitle, { color: theme.textLight }]}>Event planning — grounded in the catalog</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={12}>
                        <Ionicons name="close-circle" size={30} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    extraData={{ isTyping, addingServiceId, messages }}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        showEmptySuggestions ? (
                            <View style={[styles.suggestCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                                <Text style={[styles.suggestTitle, { color: theme.text }]}>How can we help you plan today?</Text>
                                <Text style={[styles.suggestSub, { color: theme.textLight }]}>
                                    Tap a suggestion or type your own. Lists and tables are tappable to fill the box — you can edit and send. Use
                                    Add to cart when the assistant suggests a service.
                                </Text>
                                <View style={styles.suggestChips}>
                                    {SUGGESTED_PROMPTS.map((p) => (
                                        <Pressable
                                            key={p}
                                            style={({ pressed }) => [
                                                styles.suggestChip,
                                                { borderColor: theme.border, backgroundColor: isDarkMode ? theme.inputBackground : '#fff', opacity: pressed ? 0.9 : 1 },
                                            ]}
                                            onPress={() => {
                                                void sendWithText(p);
                                            }}
                                            disabled={isTyping}
                                        >
                                            <Text style={[styles.suggestChipText, { color: theme.text }]}>{p}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        ) : null
                    }
                    ListFooterComponent={
                        isTyping ? (
                            <View style={styles.thinkingRow}>
                                <View style={[styles.assistantIcon, { borderColor: theme.border }]}>
                                    <Text style={styles.assistantIconText}>✦</Text>
                                </View>
                                <View style={[styles.thinkingBubble, { borderColor: theme.border, backgroundColor: theme.card }]}>
                                    <Text style={{ color: theme.text, fontWeight: '600' }}>Thinking</Text>
                                    <ActivityIndicator style={{ marginTop: 8 }} size="small" color={brandColors.primary} />
                                </View>
                            </View>
                        ) : null
                    }
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : Math.max(insets.bottom, 12) + 12}
                >
                    <View
                        style={[
                            styles.composer,
                            { borderTopColor: theme.border, backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, 10) },
                        ]}
                    >
                        <Text style={[styles.composerHint, { color: theme.textLight }]}>
                            Lists and pricing table rows are tappable. Edit the message, then Send.
                        </Text>
                        <View style={[styles.composerRow, { borderColor: theme.border, backgroundColor: theme.inputBackground || theme.card }]}>
                            <TextInput
                                style={[styles.composerInput, { color: theme.text }]}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Message Ekatraa…"
                                placeholderTextColor={theme.textLight}
                                multiline
                                maxLength={MAX_MESSAGE_LENGTH}
                                editable={!isTyping}
                            />
                            <TouchableOpacity
                                onPress={sendMessage}
                                style={[
                                    styles.sendFab,
                                    { backgroundColor: brandColors.primary, opacity: !inputText.trim() || isTyping ? 0.4 : 1 },
                                ]}
                                disabled={!inputText.trim() || isTyping}
                            >
                                <Ionicons name="send" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: { fontSize: 18, fontWeight: '700' },
    subtitle: { fontSize: 11, marginTop: 2 },
    listContent: { padding: 12, paddingBottom: 24 },
    userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12, paddingLeft: 48 },
    userBubble: {
        maxWidth: '90%',
        borderRadius: 18,
        borderBottomRightRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
    assistantRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, paddingRight: 8, gap: 8 },
    assistantIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    assistantIconText: { fontSize: 16 },
    assistantCol: { flex: 1, maxWidth: '100%', borderWidth: 1, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12 },
    cartActions: { marginTop: 10, gap: 8 },
    addCartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    addCartBtnText: { flex: 1, fontWeight: '600', fontSize: 14 },
    suggestCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 8 },
    suggestTitle: { fontSize: 16, fontWeight: '700' },
    suggestSub: { fontSize: 13, lineHeight: 20, marginTop: 6 },
    suggestChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    suggestChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
    suggestChipText: { fontSize: 13 },
    thinkingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
    thinkingBubble: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
    composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8 },
    composerHint: { fontSize: 11, marginBottom: 6, marginHorizontal: 4 },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderWidth: 1,
        borderRadius: 16,
        paddingLeft: 12,
        paddingVertical: 6,
    },
    composerInput: { flex: 1, minHeight: 44, maxHeight: 160, fontSize: 15, lineHeight: 20, paddingVertical: 8 },
    sendFab: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', margin: 4 },
});
