import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRazorpay } from '@codearcade/expo-razorpay';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import BottomTabBar from '../../components/BottomTabBar';
import {
    ADVANCE_PAYMENT_POLICY,
    CANCELLATION_POLICY,
    REFUND_POLICY,
    TERMS_AND_CONDITIONS,
    PROTECTION_PLAN_DETAILS,
    PROTECTION_HEADLINE,
    PROTECTION_SUB,
    POLICY_MODAL_LABELS,
} from '../../content/checkoutPolicyTexts';
import { computeProtectionAmountInr, computeAdvanceInrFromBase } from '../../utils/bookingProtection';

const ADVANCE_HEADLINE = 'Pay 20% advance & confirm booking now. (Recommended)';
const ADVANCE_BULLETS = [
    'Instant booking confirmation (recommended vendor by Ekatraa)',
    'Vendor reserved exclusively for your event',
    'Priority support & smooth execution',
    'Confirmed availability guaranteed',
];
const ADVANCE_FOOTER = '100% secure payment | verified vendors | govt-compliant process';

const LATER_HEADLINE = 'Explore & pay 20% later.';
const LATER_BULLETS = [
    'Explore multiple vendor options',
    'Get assistance from the Ekatraa team',
    'Confirm anytime by paying 20% advance',
    'Availability subject to demand',
];
const LATER_FOOTER = 'High-demand vendors get booked quickly. Confirm now to avoid unavailability.';

const POLICY_CONTENT = {
    advance: ADVANCE_PAYMENT_POLICY,
    cancellation: CANCELLATION_POLICY,
    refund: REFUND_POLICY,
    terms: TERMS_AND_CONDITIONS,
    protection: PROTECTION_PLAN_DETAILS,
};

const POLICY_KEYS = ['advance', 'cancellation', 'refund', 'terms', 'protection'];

export default function Checkout({ route, navigation }) {
    const { openCheckout, closeCheckout, RazorpayUI } = useRazorpay();
    const { theme } = useTheme();
    const { isAuthenticated, user } = useAuth();
    const { clearCart, cartItemCount } = useCart();
    const { cartId, userId: paramUserId, cart } = route.params || {};

    const [paymentMode, setPaymentMode] = useState('advance');
    const [saving, setSaving] = useState(false);
    const [cartDetails, setCartDetails] = useState(null);
    const [loadingCart, setLoadingCart] = useState(true);
    const [protectionPlanEnabled, setProtectionPlanEnabled] = useState(true);
    const [protectionSettings, setProtectionSettings] = useState(null);
    const [policyModal, setPolicyModal] = useState(null);
    const [agreements, setAgreements] = useState({
        advance: false,
        cancellation: false,
        refund: false,
        terms: false,
        protection: false,
    });

    const allPoliciesAgreed = POLICY_KEYS.every((k) => agreements[k]);

    const approvePolicyModal = () => {
        if (policyModal && POLICY_KEYS.includes(policyModal)) {
            setAgreements((prev) => ({ ...prev, [policyModal]: true }));
        }
        setPolicyModal(null);
    };

    useEffect(() => {
        if (!cartId) {
            setLoadingCart(false);
            return;
        }
        (async () => {
            const { data } = await api.getCart(cartId);
            if (data) setCartDetails(data);
            setLoadingCart(false);
        })();
    }, [cartId]);

    useEffect(() => {
        (async () => {
            const { data } = await api.getBookingProtection();
            if (data) setProtectionSettings(data);
        })();
    }, []);

    const eventInfo = cartDetails || cart || {};
    const items = eventInfo.items || cart?.items || [];
    const totalAmount = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

    const getServiceDisplayName = (item) =>
        item?.service?.name || item?.offerable_services?.name || item?.name || 'Service';

    const getCategoryName = (item) => item?.service?.category?.name || null;

    const protectionAmount = computeProtectionAmountInr(totalAmount, protectionSettings, protectionPlanEnabled);
    const grandTotal = totalAmount + protectionAmount;
    const advanceAmount = computeAdvanceInrFromBase(totalAmount, protectionAmount, 20);
    const balanceAmount = grandTotal - advanceAmount;

    const handleSubmit = async () => {
        const uid = paramUserId || (isAuthenticated && user?.id ? user.id : null);
        if (!uid) {
            Alert.alert('Login required', 'Please sign in to place an order.');
            navigation.navigate('Login');
            return;
        }
        if (!cartId) {
            Alert.alert('Error', 'No cart to checkout.');
            return;
        }

        if (!allPoliciesAgreed) {
            const pending = POLICY_KEYS.filter((k) => !agreements[k]).map((k) => POLICY_MODAL_LABELS[k] || k);
            Alert.alert(
                'Review policies',
                `Please open each policy below and tap “I have read and agree”. Pending: ${pending.join(', ')}.`
            );
            return;
        }

        if (paymentMode === 'on_finalization') {
            setSaving(true);
            const { data: order, error } = await api.checkout({
                cart_id: cartId,
                user_id: uid,
                payment_mode: 'on_finalization',
                booking_protection: protectionPlanEnabled,
            });
            setSaving(false);
            if (error) {
                Alert.alert('Checkout failed', error?.message || 'Could not place order. Please try again.');
                return;
            }
            clearCart();
            navigation.replace('OrderSummary', {
                orderId: order?.id,
                order,
                cartItems: items,
                totalAmount: grandTotal,
                servicesSubtotal: totalAmount,
                protectionAmount,
                grandTotal,
                advanceAmount: 0,
                balanceAmount: grandTotal,
                plannedBudget: eventInfo.planned_budget || null,
                paymentMode: 'on_finalization',
                bookingProtection: protectionPlanEnabled,
            });
            return;
        }

        setSaving(true);
        const { data: paymentData, error: paymentErr } = await api.createPaymentOrder({
            cart_id: cartId,
            user_id: uid,
            booking_protection: protectionPlanEnabled,
        });
        setSaving(false);
        if (paymentErr || !paymentData?.razorpay_order_id) {
            let errMsg = paymentErr?.message || paymentData?.error || 'Could not create payment. Please try again.';
            let hint = '';
            if (errMsg.toLowerCase().includes('razorpay') || errMsg.toLowerCase().includes('configured')) {
                hint = '\n\nAdd RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend (Vercel → Settings → Environment Variables), then redeploy.';
            } else if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('endpoint')) {
                hint = '\n\nRedeploy the backend to Vercel so payment routes are included. Or use local backend: set EXPO_PUBLIC_API_URL=http://localhost:3000 in ekatraa .env.';
            }
            Alert.alert('Payment setup failed', errMsg + hint);
            return;
        }
        openCheckout(
            {
                key: paymentData.key,
                amount: paymentData.amount,
                currency: 'INR',
                order_id: paymentData.razorpay_order_id,
                name: 'Ekatraa',
                description: `Advance payment (20%) - ₹${(paymentData.advance_amount ?? advanceAmount).toLocaleString()}`,
                prefill: {
                    name: eventInfo.contact_name || '',
                    email: eventInfo.contact_email || user?.email || '',
                    contact: eventInfo.contact_mobile || user?.phone || '',
                },
                theme: { color: colors.primary },
            },
            {
                onSuccess: async (data) => {
                    closeCheckout();
                    setSaving(true);
                    const { data: order, error: verifyErr } = await api.verifyPayment({
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_signature: data.razorpay_signature,
                        cart_id: cartId,
                        user_id: uid,
                        booking_protection: protectionPlanEnabled,
                    });
                    setSaving(false);
                    if (verifyErr) {
                        Alert.alert('Verification failed', verifyErr.message || 'Payment could not be verified.');
                        return;
                    }
                    clearCart();
                    const advPaid =
                        order?.advance_amount != null ? Number(order.advance_amount) : advanceAmount;
                    const balDue = Math.max(0, grandTotal - advPaid);
                    navigation.replace('OrderSummary', {
                        orderId: order?.id,
                        order,
                        cartItems: items,
                        totalAmount: grandTotal,
                        servicesSubtotal: totalAmount,
                        protectionAmount,
                        grandTotal,
                        advanceAmount: advPaid,
                        balanceAmount: balDue,
                        plannedBudget: eventInfo.planned_budget || null,
                        bookingProtection: protectionPlanEnabled,
                    });
                },
                onFailure: (err) => {
                    Alert.alert('Payment failed', err?.description || 'Payment could not be completed.');
                },
                onClose: () => { },
            }
        );
    };

    const DetailRow = ({ icon, label, value }) => {
        if (!value) return null;
        return (
            <View style={styles.detailRow}>
                <Ionicons name={icon} size={16} color={theme.textLight} />
                <Text style={[styles.detailLabel, { color: theme.textLight }]}>{label}</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Checkout</Text>
                </View>

                {loadingCart ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                        {items.length > 0 && (
                            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Order Summary</Text>
                                {(eventInfo.event_name || eventInfo.event_role) && (
                                    <View
                                        style={[
                                            styles.orderSummaryMeta,
                                            { backgroundColor: theme.background, borderColor: theme.border },
                                        ]}
                                    >
                                        {eventInfo.event_name ? (
                                            <View style={styles.orderMetaRow}>
                                                <Text style={[styles.orderMetaLabel, { color: theme.textLight }]}>
                                                    Occasion
                                                </Text>
                                                <Text style={[styles.orderMetaValue, { color: theme.text }]} numberOfLines={2}>
                                                    {eventInfo.event_name}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {eventInfo.event_role ? (
                                            <View style={styles.orderMetaRow}>
                                                <Text style={[styles.orderMetaLabel, { color: theme.textLight }]}>Role</Text>
                                                <Text style={[styles.orderMetaValue, { color: theme.text }]} numberOfLines={2}>
                                                    {eventInfo.event_role}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}
                                <Text style={[styles.servicesSectionTitle, { color: theme.text }]}>Services</Text>
                                {items.map((item, idx) => {
                                    const cat = getCategoryName(item);
                                    const occ = eventInfo.event_name;
                                    const metaParts = [cat, occ].filter(Boolean);
                                    return (
                                        <View key={item.id || idx} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.itemName, { color: theme.text }]}>
                                                    {getServiceDisplayName(item)}
                                                </Text>
                                                {metaParts.length > 0 ? (
                                                    <Text style={[styles.itemCategoryOccasion, { color: theme.textLight }]}>
                                                        {metaParts.join(' · ')}
                                                    </Text>
                                                ) : null}
                                                {item.options?.tier && (
                                                    <Text style={[styles.itemTier, { color: theme.textLight }]}>
                                                        {item.options.tier.replace('price_', '').replace(/_/g, ' ')}
                                                    </Text>
                                                )}
                                            </View>
                                            <Text style={[styles.itemPrice, { color: theme.text }]}>
                                                ₹{(Number(item.unit_price || 0) * Number(item.quantity || 1)).toLocaleString()}
                                            </Text>
                                        </View>
                                    );
                                })}
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalLabel, { color: theme.textLight }]}>Services subtotal</Text>
                                    <Text style={[styles.totalValue, { color: theme.text, fontSize: 16 }]}>₹{totalAmount.toLocaleString()}</Text>
                                </View>
                                {protectionAmount > 0 ? (
                                    <View style={styles.totalRow}>
                                        <Text style={[styles.totalLabel, { color: theme.textLight }]}>Booking protection</Text>
                                        <Text style={[styles.totalValue, { color: theme.text, fontSize: 16 }]}>₹{protectionAmount.toLocaleString()}</Text>
                                    </View>
                                ) : null}
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalLabel, { color: theme.text }]}>Order total</Text>
                                    <Text style={[styles.totalValue, { color: colors.primary }]}>₹{grandTotal.toLocaleString()}</Text>
                                </View>
                            </View>
                        )}

                        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Event Details</Text>
                            <Text style={[styles.hint, { color: theme.textLight }]}>
                                These details were provided when adding services. Vendors will use them to prepare accurate quotes.
                            </Text>
                            <DetailRow icon="person-outline" label="Name" value={eventInfo.contact_name} />
                            <DetailRow icon="call-outline" label="Phone" value={eventInfo.contact_mobile} />
                            <DetailRow icon="mail-outline" label="Email" value={eventInfo.contact_email} />
                            <DetailRow icon="calendar-outline" label="Event Date" value={eventInfo.event_date} />
                            <DetailRow icon="people-outline" label="Guests" value={eventInfo.guest_count ? String(eventInfo.guest_count) : null} />
                            <DetailRow icon="location-outline" label="Location" value={eventInfo.location_preference} />
                            <DetailRow icon="business-outline" label="Venue" value={eventInfo.venue_preference} />
                            <DetailRow icon="cash-outline" label="Budget" value={eventInfo.planned_budget} />
                        </View>

                        <View style={[styles.paymentInfo, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.paymentInfoTitle, { color: theme.text }]}>Payment method</Text>
                            <TouchableOpacity
                                style={[
                                    styles.paymentOption,
                                    {
                                        borderColor: paymentMode === 'advance' ? colors.primary : theme.border,
                                        backgroundColor: paymentMode === 'advance' ? colors.primary + '08' : 'transparent',
                                    },
                                ]}
                                onPress={() => setPaymentMode('advance')}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.paymentOptionRadio, { borderColor: paymentMode === 'advance' ? colors.primary : theme.border }]}>
                                    {paymentMode === 'advance' && (
                                        <View style={[styles.paymentOptionRadioInner, { backgroundColor: colors.primary }]} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.paymentOptionHeadline, { color: theme.text }]}>{ADVANCE_HEADLINE}</Text>
                                    {ADVANCE_BULLETS.map((line) => (
                                        <Text key={line} style={[styles.paymentBullet, { color: theme.textLight }]}>
                                            ✔ {line}
                                        </Text>
                                    ))}
                                    <Text style={[styles.paymentOptionFooter, { color: theme.textLight }]}>
                                        🔒 {ADVANCE_FOOTER}
                                    </Text>
                                    <Text style={[styles.paymentInfoText, { color: theme.textLight, marginTop: 10 }]}>
                                        Pay 20% advance (₹{advanceAmount.toLocaleString()}) now. Balance ₹{balanceAmount.toLocaleString()} payable later.
                                    </Text>
                                </View>
                                <Ionicons name="card" size={20} color={paymentMode === 'advance' ? colors.primary : theme.textLight} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.paymentOption,
                                    {
                                        borderColor: paymentMode === 'on_finalization' ? colors.primary : theme.border,
                                        backgroundColor: paymentMode === 'on_finalization' ? colors.primary + '08' : 'transparent',
                                    },
                                ]}
                                onPress={() => setPaymentMode('on_finalization')}
                                activeOpacity={0.8}
                            >
                                <View
                                    style={[
                                        styles.paymentOptionRadio,
                                        { borderColor: paymentMode === 'on_finalization' ? colors.primary : theme.border },
                                    ]}
                                >
                                    {paymentMode === 'on_finalization' && (
                                        <View style={[styles.paymentOptionRadioInner, { backgroundColor: colors.primary }]} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.paymentOptionHeadline, { color: theme.text }]}>{LATER_HEADLINE}</Text>
                                    {LATER_BULLETS.map((line) => (
                                        <Text key={line} style={[styles.paymentBullet, { color: theme.textLight }]}>
                                            • {line}
                                        </Text>
                                    ))}
                                    <Text style={[styles.paymentOptionFooter, { color: theme.textLight }]}>🔥 {LATER_FOOTER}</Text>
                                    <Text style={[styles.paymentInfoText, { color: theme.textLight, marginTop: 10 }]}>
                                        Pay full amount (₹{totalAmount.toLocaleString()}) after vendors confirm pricing and details.
                                    </Text>
                                </View>
                                <Ionicons name="cash" size={20} color={paymentMode === 'on_finalization' ? colors.primary : theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.policyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.policyCardTitle, { color: theme.text }]}>Payment options</Text>
                            <Text style={[styles.protectionHeadline, { color: theme.text }]}>{PROTECTION_HEADLINE}</Text>
                            <Text style={[styles.protectionSub, { color: theme.textLight }]}>{PROTECTION_SUB}</Text>
                            <View style={styles.protectionRow}>
                                <Text style={[styles.protectionLabel, { color: theme.text }]}>
                                    {protectionPlanEnabled ? 'Protection plan on' : 'Protection plan off'}
                                </Text>
                                <Switch
                                    value={protectionPlanEnabled}
                                    onValueChange={setProtectionPlanEnabled}
                                    trackColor={{ false: theme.border, true: colors.primary + '88' }}
                                    thumbColor={protectionPlanEnabled ? colors.primary : '#f4f3f4'}
                                />
                            </View>
                            <Text style={[styles.protectionHint, { color: theme.textLight }]}>
                                {protectionPlanEnabled
                                    ? protectionAmount > 0
                                        ? `Add-on: ₹${protectionAmount.toLocaleString()} (included in order total & 20% advance).`
                                        : 'You may be eligible for cancellation/rescheduling benefits per policy.'
                                    : 'Without protection, advances are non-refundable on cancellation/rescheduling (see policies).'}
                            </Text>
                            <TouchableOpacity
                                style={styles.policyLinkBtn}
                                onPress={() => setPolicyModal('protection')}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={agreements.protection ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={18}
                                    color={agreements.protection ? '#16A34A' : theme.textLight}
                                />
                                <Text style={[styles.policyLinkText, { color: colors.primary }]}>
                                    {POLICY_MODAL_LABELS.protection}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
                            </TouchableOpacity>

                            <Text style={[styles.policyLinksIntro, { color: theme.textLight }]}>
                                Policies — open each link and approve to continue:
                            </Text>
                            {['advance', 'cancellation', 'refund', 'terms'].map((key) => (
                                <TouchableOpacity
                                    key={key}
                                    style={styles.policyLinkBtn}
                                    onPress={() => setPolicyModal(key)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={agreements[key] ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={18}
                                        color={agreements[key] ? '#16A34A' : theme.textLight}
                                    />
                                    <Text style={[styles.policyLinkText, { color: colors.primary }]}>
                                        {POLICY_MODAL_LABELS[key]}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
                                </TouchableOpacity>
                            ))}
                            {!allPoliciesAgreed ? (
                                <Text style={[styles.policyWarning, { color: theme.textLight }]}>
                                    All policies above must be opened and accepted before payment.
                                </Text>
                            ) : (
                                <Text style={[styles.policyOk, { color: '#16A34A' }]}>All policies accepted.</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.placeOrderBtn, saving && styles.placeOrderBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.placeOrderBtnText}>
                                    {paymentMode === 'on_finalization' ? 'Place Order (Pay on Finalization)' : `Pay ₹${advanceAmount.toLocaleString()} & Place Order`}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                )}
                {RazorpayUI}

                <Modal visible={policyModal != null} animationType="slide" transparent={false} onRequestClose={() => setPolicyModal(null)}>
                    <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.background }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <TouchableOpacity onPress={() => setPolicyModal(null)} style={styles.modalCloseHit} hitSlop={12}>
                                <Ionicons name="close" size={26} color={theme.text} />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={2}>
                                {policyModal ? POLICY_MODAL_LABELS[policyModal] : ''}
                            </Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator
                        >
                            <Text style={[styles.modalBody, { color: theme.text }]}>
                                {policyModal ? POLICY_CONTENT[policyModal] : ''}
                            </Text>
                        </ScrollView>
                        <View style={[styles.modalFooter, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
                            <TouchableOpacity style={[styles.modalAgreeBtn, { backgroundColor: colors.primary }]} onPress={approvePolicyModal}>
                                <Text style={styles.modalAgreeBtnText}>I have read and agree</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </Modal>

                <BottomTabBar navigation={navigation} activeRoute="Cart" cartItemCount={cartItemCount} />
            </KeyboardAvoidingView>
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
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16, paddingBottom: 56 },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
    orderSummaryMeta: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 14,
        gap: 10,
    },
    orderMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    orderMetaLabel: { fontSize: 12, fontWeight: '600', width: 72, textTransform: 'uppercase', letterSpacing: 0.3 },
    orderMetaValue: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 21 },
    servicesSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
    hint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    itemName: { fontSize: 14, fontWeight: '600' },
    itemTier: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
    itemCategoryOccasion: { fontSize: 12, marginTop: 2, lineHeight: 17 },
    itemPrice: { fontSize: 14, fontWeight: '700' },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
    },
    totalLabel: { fontSize: 16, fontWeight: '700' },
    totalValue: { fontSize: 18, fontWeight: '800' },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    detailLabel: { fontSize: 13, width: 70 },
    detailValue: { flex: 1, fontSize: 14, fontWeight: '600' },
    paymentInfo: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    paymentInfoTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        marginBottom: 10,
        gap: 12,
    },
    paymentOptionRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentOptionRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    paymentOptionLabel: { fontSize: 15, fontWeight: '600' },
    paymentOptionHeadline: { fontSize: 15, fontWeight: '700', marginBottom: 8, lineHeight: 21 },
    paymentBullet: { fontSize: 13, lineHeight: 20, marginTop: 4 },
    paymentOptionFooter: { fontSize: 12, lineHeight: 18, marginTop: 10, fontWeight: '600' },
    paymentOptionDesc: { fontSize: 12, marginTop: 2 },
    paymentInfoText: { fontSize: 14, lineHeight: 20 },
    placeOrderBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 5,
    },
    placeOrderBtnDisabled: { opacity: 0.7 },
    placeOrderBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    policyCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    policyCardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
    protectionHeadline: { fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 6 },
    protectionSub: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
    protectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    protectionLabel: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
    protectionHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
    policyLinksIntro: { fontSize: 12, marginBottom: 8, marginTop: 4 },
    policyLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 8,
    },
    policyLinkText: { flex: 1, fontSize: 14, fontWeight: '600' },
    policyWarning: { fontSize: 12, marginTop: 10 },
    policyOk: { fontSize: 13, fontWeight: '600', marginTop: 10 },
    modalRoot: { flex: 1 },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    modalCloseHit: { padding: 8 },
    modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
    modalScroll: { flex: 1 },
    modalScrollContent: { padding: 16, paddingBottom: 32 },
    modalBody: { fontSize: 14, lineHeight: 22 },
    modalFooter: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    modalAgreeBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalAgreeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
