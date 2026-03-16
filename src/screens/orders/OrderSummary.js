import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import BottomTabBar from '../../components/BottomTabBar';

const TIER_LABELS = {
    price_basic: 'Basic',
    price_classic_value: 'Classic Value',
    price_signature: 'Signature',
    price_prestige: 'Prestige',
    price_royal: 'Royal',
    price_imperial: 'Imperial',
    basic: 'Basic',
    classic: 'Classic Value',
    signature: 'Signature',
    prestige: 'Prestige',
    royal: 'Royal',
    imperial: 'Imperial',
};

function getTierLabel(options) {
    const tier = options?.tier;
    if (!tier) return null;
    if (TIER_LABELS[tier]) return TIER_LABELS[tier];
    const normalized = String(tier).replace(/^price_/, '');
    return TIER_LABELS[normalized] || (normalized.charAt(0).toUpperCase() + normalized.slice(1));
}

export default function OrderSummary({ route, navigation }) {
    const { theme } = useTheme();
    const { orderId, order, cartItems = [], totalAmount = 0, advanceAmount, balanceAmount, plannedBudget, paymentMode } = route.params || {};

    const itemCount = cartItems.length;
    // Placeholder: number of vendors that can fulfill the selection (per service type). In future from API.
    const vendorsCountPlaceholder = Math.max(3, Math.min(12, itemCount * 4));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Order summary</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.successCard, { backgroundColor: theme.card }]}>
                    <View style={styles.successIconWrap}>
                        <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
                    </View>
                    <Text style={[styles.successTitle, { color: theme.text }]}>Order placed successfully</Text>
                    {orderId && (
                        <Text style={[styles.orderId, { color: theme.textLight }]}>Order #{(orderId + '').slice(-8)}</Text>
                    )}
                </View>

                <Text style={[styles.sectionTitle, { color: theme.text }]}>Services selected</Text>
                {(cartItems || []).map((item, index) => {
                    const name = item.service?.name || item.name || 'Service';
                    const tierLabel = getTierLabel(item.options);
                    const price = Number(item.unit_price || 0);
                    const qty = Number(item.quantity) || 1;
                    const lineTotal = price * qty;
                    return (
                        <View key={item.id || index} style={[styles.itemCard, { backgroundColor: theme.card }]}>
                            <Text style={[styles.itemName, { color: theme.text }]}>{name}</Text>
                            {tierLabel ? (
                                <Text style={[styles.itemTier, { color: colors.primary }]}>{tierLabel}</Text>
                            ) : null}
                            <View style={styles.itemRow}>
                                <Text style={[styles.itemMeta, { color: theme.textLight }]}>
                                    ₹{price.toLocaleString()} × {qty}
                                </Text>
                                <Text style={[styles.itemTotal, { color: theme.text }]}>₹{lineTotal.toLocaleString()}</Text>
                            </View>
                        </View>
                    );
                })}

                <View style={[styles.totalCard, { backgroundColor: theme.card }]}>
                    <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Total amount</Text>
                        <Text style={[styles.totalValue, { color: theme.text }]}>₹{Number(totalAmount).toLocaleString()}</Text>
                    </View>
                    {advanceAmount != null && advanceAmount > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, { color: theme.textLight }]}>Advance paid (20%)</Text>
                            <Text style={[styles.totalValue, { color: '#16a34a' }]}>₹{Number(advanceAmount).toLocaleString()}</Text>
                        </View>
                    )}
                    {balanceAmount != null && balanceAmount > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, { color: theme.textLight }]}>
                                {paymentMode === 'on_finalization' ? 'Pay on order finalization' : 'Balance payable'}
                            </Text>
                            <Text style={[styles.totalValue, { color: theme.text }]}>₹{Number(balanceAmount).toLocaleString()}</Text>
                        </View>
                    )}
                    {plannedBudget != null && plannedBudget > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, { color: theme.textLight }]}>Your budget</Text>
                            <Text style={[styles.totalValue, { color: theme.text }]}>₹{Number(plannedBudget).toLocaleString()}</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.vendorsCard, { backgroundColor: theme.card }]}>
                    <View style={styles.vendorsIconWrap}>
                        <Ionicons name="people" size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.vendorsTitle, { color: theme.text }]}>Vendors for your services</Text>
                    <Text style={[styles.vendorsCount, { color: colors.primary }]}>
                        {vendorsCountPlaceholder}+ vendors available
                    </Text>
                    <Text style={[styles.vendorsDesc, { color: theme.textLight }]}>
                        Vendors are matched by service type and your budget. You'll receive quotes from vendors—compare prices and confirm from your order details.
                    </Text>
                    <Text style={[styles.vendorsBreakdown, { color: theme.textLight }]}>
                        {itemCount} service{itemCount !== 1 ? 's' : ''} selected. Each service may have multiple vendors; quotes will appear on the order detail screen as vendors respond.
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => navigation.navigate('OrderDetail', { orderId })}
                >
                    <Text style={styles.primaryBtnText}>View order details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                    onPress={() => navigation.navigate('Home')}
                >
                    <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Back to home</Text>
                </TouchableOpacity>
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
    scroll: { padding: 16, paddingBottom: 52 },
    successCard: {
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    successIconWrap: { marginBottom: 12 },
    successTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    orderId: { fontSize: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    itemCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#00000010',
    },
    itemName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    itemTier: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemMeta: { fontSize: 14 },
    itemTotal: { fontSize: 15, fontWeight: '700' },
    totalCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#00000010',
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    totalLabel: { fontSize: 15 },
    totalValue: { fontSize: 18, fontWeight: '700' },
    vendorsCard: {
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    vendorsIconWrap: { marginBottom: 12 },
    vendorsTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
    vendorsCount: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    vendorsDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
    vendorsBreakdown: { fontSize: 13, lineHeight: 18 },
    primaryBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    secondaryBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: '600' },
});
