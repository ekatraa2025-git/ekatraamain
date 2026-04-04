import React, { useState, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import BottomTabBar from '../../components/BottomTabBar';
import { formatFriendlyDate, formatFriendlyDateTime } from '../../utils/formatFriendlyDate';
import { getOccasionAndApplicant } from '../../utils/orderDisplay';
import { getLineItemParts, tierIndexFromOptions, TIER_ACCENT_COLORS } from '../../utils/lineItemDisplay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OrderDetail({ route, navigation }) {
    const { theme } = useTheme();
    const { isAuthenticated, user, session, loading: authLoading } = useAuth();
    const { orderId } = route.params || {};
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actioning, setActioning] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const load = useCallback(async () => {
        if (!orderId) return;
        if (!session?.access_token) {
            setOrder(null);
            setLoadError('sign_in');
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadError(null);
        const { data, error } = await api.getOrder(orderId, session.access_token);
        setLoading(false);
        if (error) {
            setOrder(null);
            setLoadError(error?.message || 'Could not load order.');
            return;
        }
        setOrder(data);
    }, [orderId, session?.access_token]);

    useFocusEffect(
        useCallback(() => {
            if (!orderId) return;
            if (authLoading) {
                setLoading(true);
                return;
            }
            load();
        }, [orderId, load, authLoading])
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
        const { data, error } = await api.acceptQuotation(orderId, quotationId, action, session?.access_token);
        setActioning(null);
        if (error) {
            Alert.alert('Error', error?.message || 'Could not update quotation.');
            return;
        }
        await load();
        if (action === 'accept') {
            const adv = data?.order?.requires_advance_payment && data?.order?.suggested_advance_inr;
            Alert.alert(
                'Quote accepted',
                adv
                    ? `Please complete your 20% advance of ₹${Math.round(Number(data.order.suggested_advance_inr)).toLocaleString('en-IN')} to proceed. You can use Pay balance or checkout flows when available.`
                    : 'Your order is confirmed with the vendor.',
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

    if (loading || authLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Order Details</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
                <BottomTabBar navigation={navigation} activeRoute="MyOrders" />
            </SafeAreaView>
        );
    }

    if (loadError) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Order Details</Text>
                </View>
                <View style={[styles.errorWrap, { padding: 20 }]}>
                    <Ionicons
                        name={loadError === 'sign_in' ? 'lock-closed-outline' : 'cloud-offline-outline'}
                        size={48}
                        color={theme.textLight}
                        style={{ marginBottom: 12 }}
                    />
                    <Text style={[styles.errorTitle, { color: theme.text }]}>
                        {loadError === 'sign_in' ? 'Sign in required' : 'Could not load order'}
                    </Text>
                    <Text style={[styles.errorSub, { color: theme.textLight }]}>
                        {loadError === 'sign_in'
                            ? 'Sign in to see vendor quotes, items, and status for this order.'
                            : loadError}
                    </Text>
                    {loadError === 'sign_in' ? (
                        <TouchableOpacity
                            style={[styles.retryBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.retryBtnText}>Sign in</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.retryBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
                            onPress={() => load()}
                        >
                            <Text style={styles.retryBtnText}>Try again</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <BottomTabBar navigation={navigation} activeRoute="MyOrders" />
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Order Details</Text>
                </View>
                <Text style={[styles.emptyText, { color: theme.text, padding: 20 }]}>No order data.</Text>
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
    const { occasionLabel, applicantLabel } = getOccasionAndApplicant(order);

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
                    <Text style={[styles.detailLabel, { color: theme.textLight }]}>Occasion</Text>
                    {occasionLabel ? (
                        <Text style={[styles.occasionLine, { color: theme.text }]}>{occasionLabel}</Text>
                    ) : (
                        <Text style={[styles.meta, { color: theme.textLight, fontStyle: 'italic' }]}>Not set</Text>
                    )}
                    <Text style={[styles.detailLabel, { color: theme.textLight, marginTop: 10 }]}>Who applied</Text>
                    {applicantLabel ? (
                        <Text style={[styles.applicantLine, { color: theme.text }]}>{applicantLabel}</Text>
                    ) : (
                        <Text style={[styles.meta, { color: theme.textLight, fontStyle: 'italic' }]}>Not set</Text>
                    )}
                    {order?.contact_name && (
                        <Text style={[styles.meta, { color: theme.textLight, marginTop: 8 }]}>{order.contact_name}</Text>
                    )}
                    {order?.event_date ? (
                        <Text style={[styles.meta, { color: theme.textLight }]}>
                            Event date: {formatFriendlyDate(order.event_date)}
                        </Text>
                    ) : null}
                    {order?.created_at ? (
                        <Text style={[styles.meta, { color: theme.textLight }]}>
                            Ordered: {formatFriendlyDateTime(order.created_at)}
                        </Text>
                    ) : null}
                    {order?.work_started_at ? (
                        <Text style={[styles.meta, { color: theme.textLight, marginTop: 6 }]}>
                            Work started: {formatFriendlyDateTime(order.work_started_at)}
                        </Text>
                    ) : null}
                    {order?.work_completed_at ? (
                        <Text style={[styles.meta, { color: theme.textLight }]}>
                            Work completed: {formatFriendlyDateTime(order.work_completed_at)}
                        </Text>
                    ) : null}
                    {order?.start_otp && (
                        <View style={[styles.completionOtpBox, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]}>
                            <Text style={[styles.completionOtpLabel, { color: theme.textLight }]}>Start work OTP (share with vendor)</Text>
                            <Text style={[styles.completionOtpValue, { color: colors.primary }]}>{order.start_otp}</Text>
                        </View>
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
                        {items.map((item, i) => {
                            const parts = getLineItemParts(item);
                            const accentIdx = tierIndexFromOptions(item.options);
                            const accent =
                                accentIdx >= 0
                                    ? TIER_ACCENT_COLORS[accentIdx % TIER_ACCENT_COLORS.length]
                                    : colors.primary;
                            const tierLine = [parts.tierName, parts.qtyLabel].filter(Boolean).join(' · ');
                            const qty = Number(item.quantity) || 1;
                            return (
                                <View
                                    key={item.id || i}
                                    style={[
                                        styles.orderItemCard,
                                        {
                                            borderBottomColor: theme.border,
                                            borderLeftColor: accent,
                                        },
                                    ]}
                                >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        {parts.categoryName ? (
                                            <Text style={[styles.itemCat, { color: theme.textLight }]}>
                                                {parts.categoryName}
                                            </Text>
                                        ) : null}
                                        <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={2}>
                                            {parts.serviceName} × {qty}
                                        </Text>
                                        {tierLine ? (
                                            <Text style={[styles.itemTierLine, { color: accent }]}>{tierLine}</Text>
                                        ) : null}
                                        {parts.subVariety ? (
                                            <Text style={[styles.itemSub, { color: theme.textLight }]}>{parts.subVariety}</Text>
                                        ) : null}
                                    </View>
                                    <Text style={[styles.itemPrice, { color: theme.text }]}>
                                        ₹{(Number(item.unit_price) * qty).toLocaleString()}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {history.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Status history</Text>
                        {history.map((h, i) => (
                            <View
                                key={h.id || `${h.status}-${h.created_at || ''}-${i}`}
                                style={[styles.historyItem, { borderBottomColor: theme.border }]}
                            >
                                <Text style={[styles.historyStatus, { color: theme.text }]}>{h.status}</Text>
                                {h.note ? (
                                    <Text style={[styles.historyNote, { color: theme.textLight }]}>{h.note}</Text>
                                ) : null}
                                <Text style={[styles.historyDate, { color: theme.textLight }]}>
                                    {h.created_at ? formatFriendlyDateTime(h.created_at) : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Vendor quotes with attachments and accept/reject */}
                <View
                    style={[
                        styles.quotesSectionShell,
                        {
                            borderColor: colors.primary + '44',
                            backgroundColor: theme.card,
                            shadowColor: colors.primary,
                        },
                    ]}
                >
                    <LinearGradient
                        colors={[colors.primary + '35', colors.primary + '12']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.quotesSectionBanner}
                    >
                        <View style={[styles.quotesBannerIcon, { backgroundColor: theme.background + 'CC' }]}>
                            <Ionicons name="pricetags" size={22} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.quotesBannerTitle, { color: theme.text }]}>Vendor quotes</Text>
                            <Text style={[styles.quotesBannerSub, { color: theme.textLight }]}>
                                Compare offers and accept the one that fits your celebration
                            </Text>
                        </View>
                    </LinearGradient>
                    <View style={[styles.quotesSectionInner, { borderTopColor: theme.border }]}>
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
                                    style={[
                                        styles.quoteCard,
                                        {
                                            borderColor: colors.primary + '28',
                                            backgroundColor: theme.background,
                                            borderWidth: 1.5,
                                        },
                                    ]}
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
                                    {q.quotation_submitted_at || q.created_at ? (
                                        <Text style={[styles.quoteMeta, { color: theme.textLight }]}>
                                            Submitted:{' '}
                                            {formatFriendlyDateTime(q.quotation_submitted_at || q.created_at)}
                                        </Text>
                                    ) : null}
                                    {q.service_type ? (
                                        <Text style={[styles.quoteMeta, { color: theme.textLight }]}>
                                            Service: {q.service_type}
                                        </Text>
                                    ) : null}
                                    {q.venue_address ? (
                                        <Text style={[styles.quoteMeta, { color: theme.textLight }]} numberOfLines={3}>
                                            Venue: {q.venue_address}
                                        </Text>
                                    ) : null}
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
                        <View style={styles.quoteEmptyWrap}>
                            <Ionicons name="document-text-outline" size={40} color={theme.textLight} style={{ marginBottom: 8 }} />
                            <Text style={[styles.quoteEmptyTitle, { color: theme.text }]}>No vendor quotes yet</Text>
                            <Text style={[styles.quoteEmpty, { color: theme.textLight }]}>
                                When an allocated vendor submits a quotation, it will appear here. Pull down to refresh.
                            </Text>
                        </View>
                    )}
                    </View>
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
        padding: 14,
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
    },
    detailLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    occasionLine: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
    applicantLine: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    quotesSectionShell: {
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 2,
        overflow: 'hidden',
        elevation: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
    },
    quotesSectionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
    },
    quotesBannerIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quotesBannerTitle: { fontSize: 18, fontWeight: '800' },
    quotesBannerSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
    quotesSectionInner: { padding: 14, borderTopWidth: 1 },
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
    orderItemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderLeftWidth: 4,
    },
    itemCat: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
    itemTitle: { fontSize: 15, fontWeight: '700' },
    itemTierLine: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    itemSub: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
    itemName: { fontSize: 14, flex: 1 },
    itemPrice: { fontSize: 14, fontWeight: '700', minWidth: 72, textAlign: 'right' },
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
    quoteMeta: { fontSize: 12, marginTop: 4, lineHeight: 18 },
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
    quoteEmptyWrap: { alignItems: 'center', paddingVertical: 12 },
    quoteEmptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    quoteEmpty: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    errorSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    retryBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
    retryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
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
