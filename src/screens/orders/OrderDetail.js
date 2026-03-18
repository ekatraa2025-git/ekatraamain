import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Linking,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import BottomTabBar from '../../components/BottomTabBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OrderDetail({ route, navigation }) {
    const { theme } = useTheme();
    const { isAuthenticated, user } = useAuth();
    const { orderId } = route.params || {};
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actioning, setActioning] = useState(null);

    const load = useCallback(async () => {
        if (!orderId) return;
        const { data, error } = await api.getOrder(orderId, user?.id);
        if (!error) setOrder(data);
        setLoading(false);
    }, [orderId, user?.id]);

    useEffect(() => {
        load();
    }, [load]);

    useFocusEffect(
        useCallback(() => {
            if (orderId) load();
        }, [orderId, load])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleAcceptReject = async (quotationId, action) => {
        if (!isAuthenticated || !user?.id) {
            Alert.alert('Login required', 'Please sign in to accept or reject quotes.');
            navigation.navigate('Login');
            return;
        }
        setActioning(quotationId);
        const { data, error } = await api.acceptQuotation(orderId, quotationId, action);
        setActioning(null);
        if (error) {
            Alert.alert('Error', error?.message || 'Could not update quotation.');
            return;
        }
        await load();
        if (action === 'accept') {
            Alert.alert(
                'Quote Accepted',
                'Your order is confirmed. You can pay the balance once the vendor marks the order as complete.',
                [{ text: 'OK' }]
            );
        }
    };

    const openImage = (url) => {
        if (url && (url.startsWith('http') || url.startsWith('https'))) {
            Linking.openURL(url);
        }
    };

    if (!orderId) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.emptyText, { color: theme.text }]}>No order specified.</Text>
                <BottomTabBar navigation={navigation} activeRoute="MyOrders" />
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
                <BottomTabBar navigation={navigation} activeRoute="MyOrders" />
            </SafeAreaView>
        );
    }

    const items = order?.items || [];
    const history = order?.status_history || [];
    const quotes = order?.quotes || order?.vendor_quotes || [];
    const advancePaid = Number(order?.advance_amount || 0);
    const acceptedQuote = quotes.find((q) => (q.status || '').toLowerCase() === 'accepted');
    const agreedTotal = acceptedQuote ? Number(acceptedQuote.amount || 0) : Number(order?.total_amount || 0);
    const balanceDue = Math.max(0, agreedTotal - advancePaid);
    const isCompleted = (order?.status || '').toLowerCase() === 'completed';
    const showPayBalance = !!acceptedQuote && balanceDue > 0 && isCompleted;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Order Details</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Order summary card */}
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusPill, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.statusBadge, { color: colors.primary }]}>
                                {order?.status || '—'}
                            </Text>
                        </View>
                        <Text style={[styles.total, { color: theme.text }]}>
                            ₹{Number(order?.total_amount || 0).toLocaleString()}
                        </Text>
                    </View>
                    {advancePaid > 0 && (
                        <Text style={[styles.meta, { color: theme.textLight }]}>
                            Advance paid: ₹{advancePaid.toLocaleString()}
                        </Text>
                    )}
                    {order?.contact_name && (
                        <Text style={[styles.meta, { color: theme.textLight }]}>{order.contact_name}</Text>
                    )}
                    {order?.event_date && (
                        <Text style={[styles.meta, { color: theme.textLight }]}>Event: {order.event_date}</Text>
                    )}
                    {order?.completion_otp && (
                        <View style={[styles.completionOtpBox, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                            <Text style={[styles.completionOtpLabel, { color: theme.textLight }]}>Completion OTP (share with vendor)</Text>
                            <Text style={[styles.completionOtpValue, { color: colors.primary }]}>{order.completion_otp}</Text>
                        </View>
                    )}
                    {showPayBalance && (
                        <TouchableOpacity
                            style={[styles.payBalanceBtn, { backgroundColor: colors.primary }]}
                            onPress={() =>
                                navigation.navigate('BalancePayment', {
                                    orderId,
                                    order,
                                    balanceAmount: balanceDue,
                                })
                            }
                        >
                            <Ionicons name="card-outline" size={20} color="#FFF" />
                            <Text style={styles.payBalanceBtnText}>Pay Balance ₹{balanceDue.toLocaleString()}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {items.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Items</Text>
                        {items.map((item, i) => (
                            <View key={item.id || i} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                                    {item.name || 'Item'} × {item.quantity}
                                </Text>
                                <Text style={[styles.itemPrice, { color: theme.text }]}>
                                    ₹{(Number(item.unit_price) * Number(item.quantity)).toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {history.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Status history</Text>
                        {history.map((h, i) => (
                            <View key={i} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.historyStatus, { color: theme.text }]}>{h.status}</Text>
                                {h.note ? (
                                    <Text style={[styles.historyNote, { color: theme.textLight }]}>{h.note}</Text>
                                ) : null}
                                <Text style={[styles.historyDate, { color: theme.textLight }]}>
                                    {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Vendor quotes with attachments and accept/reject */}
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Vendor quotes</Text>
                    {quotes.length > 0 ? (
                        quotes.map((q, i) => {
                            const statusLower = (q.status || '').toLowerCase();
                            const canAct = statusLower === 'submitted' || statusLower === 'pending';
                            const quoteAmount = Number(q.amount || 0);
                            const balance = Math.max(0, quoteAmount - advancePaid);
                            const att = q.attachments && typeof q.attachments === 'object' ? q.attachments : {};
                            const attEntries = Object.entries(att);
                            return (
                                <View
                                    key={q.id || i}
                                    style={[styles.quoteCard, { borderColor: theme.border, backgroundColor: theme.background }]}
                                >
                                    <View style={styles.quoteHeader}>
                                        <Text style={[styles.quoteVendor, { color: theme.text }]}>
                                            {q.vendor_name || 'Vendor'}
                                        </Text>
                                        <Text style={[styles.quoteAmount, { color: colors.primary }]}>
                                            {quoteAmount > 0 ? `₹${quoteAmount.toLocaleString()}` : '—'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.quoteStatus, { color: theme.textLight }]}>
                                        {q.status || 'Submitted'}
                                    </Text>
                                    {q.note ? (
                                        <Text style={[styles.quoteNote, { color: theme.textLight }]}>{q.note}</Text>
                                    ) : null}

                                    {/* Quotation attachments */}
                                    {attEntries.length > 0 && (
                                        <View style={styles.attachmentsSection}>
                                            <Text style={[styles.attachmentsLabel, { color: theme.textLight }]}>
                                                Attachments
                                            </Text>
                                            <View style={styles.attachmentsRow}>
                                                {attEntries.flatMap(([category, urls]) =>
                                                    Array.isArray(urls)
                                                        ? urls
                                                              .filter(Boolean)
                                                              .map((url, j) => (
                                                                  <TouchableOpacity
                                                                      key={`${category}-${j}`}
                                                                      onPress={() => openImage(url)}
                                                                      style={styles.attachmentThumb}
                                                                  >
                                                                      <Image
                                                                          source={{ uri: url }}
                                                                          style={styles.attachmentImg}
                                                                          resizeMode="cover"
                                                                      />
                                                                      <Text
                                                                          style={[styles.attachmentCat, { color: theme.textLight }]}
                                                                          numberOfLines={1}
                                                                      >
                                                                          {category}
                                                                      </Text>
                                                                  </TouchableOpacity>
                                                              ))
                                                        : []
                                                )}
                                            </View>
                                        </View>
                                    )}

                                    {canAct && (
                                        <View style={styles.quoteActions}>
                                            <TouchableOpacity
                                                style={[styles.rejectBtn, { borderColor: theme.border }]}
                                                onPress={() =>
                                                    Alert.alert(
                                                        'Reject quote?',
                                                        'This quote will be marked as rejected.',
                                                        [
                                                            { text: 'Cancel', style: 'cancel' },
                                                            {
                                                                text: 'Reject',
                                                                style: 'destructive',
                                                                onPress: () => handleAcceptReject(q.id, 'reject'),
                                                            },
                                                        ]
                                                    )
                                                }
                                                disabled={!!actioning}
                                            >
                                                <Ionicons name="close-circle-outline" size={18} color="#c0392b" />
                                                <Text style={styles.rejectBtnText}>Reject</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                                                onPress={() => handleAcceptReject(q.id, 'accept')}
                                                disabled={!!actioning}
                                            >
                                                {actioning === q.id ? (
                                                    <ActivityIndicator color="#FFF" size="small" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                                                        <Text style={styles.acceptBtnText}>Accept</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    ) : (
                        <Text style={[styles.quoteEmpty, { color: theme.textLight }]}>
                            No quotes yet. Vendors can submit quotes for your order—pull to refresh for updates.
                        </Text>
                    )}
                </View>
                <View style={styles.bottomSpacer} />
            </ScrollView>
            <BottomTabBar navigation={navigation} activeRoute="MyOrders" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
    bottomSpacer: { height: 80 },
    card: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    statusPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusBadge: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
    total: { fontSize: 22, fontWeight: 'bold' },
    meta: { fontSize: 14, marginBottom: 2 },
    payBalanceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginTop: 12,
        gap: 8,
    },
    payBalanceBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    itemName: { fontSize: 14, flex: 1 },
    itemPrice: { fontSize: 14, fontWeight: '600' },
    historyItem: {
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    historyStatus: { fontSize: 14, fontWeight: '600' },
    historyNote: { fontSize: 13, marginTop: 2 },
    historyDate: { fontSize: 12, marginTop: 2 },
    quoteCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    quoteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    quoteVendor: { fontSize: 15, fontWeight: '600', flex: 1 },
    quoteAmount: { fontSize: 16, fontWeight: '700' },
    quoteStatus: { fontSize: 13, textTransform: 'capitalize', marginBottom: 2 },
    quoteNote: { fontSize: 12, marginTop: 4 },
    attachmentsSection: { marginTop: 12 },
    attachmentsLabel: { fontSize: 12, marginBottom: 8, textTransform: 'capitalize' },
    attachmentsRow: { flexDirection: 'row', flexWrap: 'wrap' },
    attachmentThumb: {
        width: (SCREEN_WIDTH - 32 - 32) / 3 - 8,
        marginRight: 8,
        marginBottom: 8,
        borderRadius: 8,
        overflow: 'hidden',
    },
    attachmentImg: {
        width: (SCREEN_WIDTH - 32 - 32) / 3 - 8,
        height: 72,
    },
    attachmentCat: { fontSize: 10, marginTop: 2 },
    quoteActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 2,
        gap: 6,
    },
    rejectBtnText: { color: '#c0392b', fontWeight: '600', fontSize: 14 },
    acceptBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    acceptBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
    quoteEmpty: { fontSize: 14, fontStyle: 'italic' },
    emptyText: { padding: 16 },
    completionOtpBox: {
        marginTop: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
    },
    completionOtpLabel: { fontSize: 12, marginBottom: 4 },
    completionOtpValue: { fontSize: 24, fontWeight: '800', letterSpacing: 4 },
});
