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

const PAYMENT_OPTIONS = [
    { key: 'advance', label: 'Pay 20% Advance Now', desc: 'Secure your booking with advance payment', icon: 'card' },
    { key: 'on_finalization', label: 'Cash on Order Finalization', desc: 'Pay after vendors confirm pricing & details', icon: 'cash' },
];

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

    const eventInfo = cartDetails || cart || {};
    const items = eventInfo.items || cart?.items || [];
    const totalAmount = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

    const advanceAmount = Math.round((totalAmount * 20) / 100);
    const balanceAmount = totalAmount - advanceAmount;

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

        if (paymentMode === 'on_finalization') {
            setSaving(true);
            const { data: order, error } = await api.checkout({
                cart_id: cartId,
                user_id: uid,
                payment_mode: 'on_finalization',
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
                totalAmount,
                advanceAmount: 0,
                balanceAmount: totalAmount,
                plannedBudget: eventInfo.planned_budget || null,
                paymentMode: 'on_finalization',
            });
            return;
        }

        setSaving(true);
        const { data: paymentData, error: paymentErr } = await api.createPaymentOrder({
            cart_id: cartId,
            user_id: uid,
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
                name: 'eKatRaa',
                description: `Advance payment (20%) - ₹${advanceAmount.toLocaleString()}`,
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
                    });
                    setSaving(false);
                    if (verifyErr) {
                        Alert.alert('Verification failed', verifyErr.message || 'Payment could not be verified.');
                        return;
                    }
                    clearCart();
                    navigation.replace('OrderSummary', {
                        orderId: order?.id,
                        order,
                        cartItems: items,
                        totalAmount,
                        advanceAmount,
                        balanceAmount,
                        plannedBudget: eventInfo.planned_budget || null,
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
                                {items.map((item, idx) => (
                                    <View key={item.id || idx} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.itemName, { color: theme.text }]}>{item.name || item.offerable_services?.name || 'Service'}</Text>
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
                                ))}
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                                    <Text style={[styles.totalValue, { color: colors.primary }]}>₹{totalAmount.toLocaleString()}</Text>
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
                            <Text style={[styles.paymentInfoTitle, { color: theme.text }]}>Payment Method</Text>
                            {PAYMENT_OPTIONS.map((opt) => {
                                const isSelected = paymentMode === opt.key;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        style={[
                                            styles.paymentOption,
                                            { borderColor: isSelected ? colors.primary : theme.border, backgroundColor: isSelected ? colors.primary + '08' : 'transparent' },
                                        ]}
                                        onPress={() => setPaymentMode(opt.key)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.paymentOptionRadio, { borderColor: isSelected ? colors.primary : theme.border }]}>
                                            {isSelected && <View style={[styles.paymentOptionRadioInner, { backgroundColor: colors.primary }]} />}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.paymentOptionLabel, { color: theme.text }]}>{opt.label}</Text>
                                            <Text style={[styles.paymentOptionDesc, { color: theme.textLight }]}>{opt.desc}</Text>
                                        </View>
                                        <Ionicons name={opt.icon} size={20} color={isSelected ? colors.primary : theme.textLight} />
                                    </TouchableOpacity>
                                );
                            })}
                            {paymentMode === 'advance' && (
                                <Text style={[styles.paymentInfoText, { color: theme.textLight, marginTop: 8 }]}>
                                    Pay 20% advance (₹{advanceAmount.toLocaleString()}) now. Balance ₹{balanceAmount.toLocaleString()} payable later.
                                </Text>
                            )}
                            {paymentMode === 'on_finalization' && (
                                <Text style={[styles.paymentInfoText, { color: theme.textLight, marginTop: 8 }]}>
                                    Pay full amount (₹{totalAmount.toLocaleString()}) after vendors confirm pricing and details.
                                </Text>
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
});
