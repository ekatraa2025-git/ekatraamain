import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
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

export default function Cart({ route, navigation }) {
    const { theme } = useTheme();
    const { isAuthenticated, user } = useAuth();
    const { cartId: globalCartId, refreshCartCount } = useCart();
    const cartId = route.params?.cartId || globalCartId;

    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadCart = useCallback(async () => {
        if (!cartId) {
            setLoading(false);
            return;
        }
        const { data, error } = await api.getCart(cartId);
        if (error) {
            Alert.alert('Error', error.message);
            setCart(null);
        } else {
            setCart(data);
        }
        setLoading(false);
    }, [cartId]);

    useEffect(() => {
        loadCart();
    }, [loadCart]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadCart();
        setRefreshing(false);
    }, [loadCart]);

    const handleUpdateQty = async (itemId, quantity) => {
        if (quantity < 1) return;
        const { error } = await api.updateCartItem(itemId, { quantity });
        if (error) Alert.alert('Error', error.message);
        else { await loadCart(); refreshCartCount(); }
    };

    const handleRemove = async (itemId) => {
        const { error } = await api.removeCartItem(itemId);
        if (error) Alert.alert('Error', error.message);
        else { await loadCart(); refreshCartCount(); }
    };

    const handleCheckout = () => {
        if (!cart?.items?.length) {
            Alert.alert('Cart is empty', 'Add services first.');
            return;
        }
        navigation.navigate('Checkout', {
            cartId: cart.id,
            userId: isAuthenticated && user?.id ? user.id : null,
            cart,
        });
    };

    if (!cartId) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Cart</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.emptyContainer}>
                    <Ionicons name="cart-outline" size={64} color={theme.textLight} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Your cart is empty</Text>
                    <Text style={[styles.emptyText, { color: theme.textLight }]}>Browse services from Home to get started.</Text>
                    <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
                        <Text style={styles.shopBtnText}>Browse Services</Text>
                    </TouchableOpacity>
                </View>
                <BottomTabBar navigation={navigation} activeRoute="Cart" />
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const items = cart?.items || [];
    const total = items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unit_price || 0)), 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Cart</Text>
                <View style={{ width: 40 }} />
            </View>

            {items.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="cart-outline" size={64} color={theme.textLight} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Your cart is empty</Text>
                    <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
                        <Text style={styles.shopBtnText}>Browse services</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <View style={[styles.summaryHeader, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.summaryTitle, { color: theme.text }]}>Order summary</Text>
                        <Text style={[styles.summaryCount, { color: theme.textLight }]}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
                    </View>
                    <FlatList
                        data={items}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                        }
                        renderItem={({ item }) => {
                            const service = item.service || item;
                            const name = service?.name || item.name || 'Service';
                            const price = Number(item.unit_price || 0);
                            const qty = Number(item.quantity) || 1;
                            const tierLabel = getTierLabel(item.options);
                            return (
                                <View style={[styles.itemCard, { backgroundColor: theme.card }]}>
                                    <Text style={[styles.itemName, { color: theme.text }]}>{name}</Text>
                                    {tierLabel ? (
                                        <Text style={[styles.itemTier, { color: colors.primary }]}>{tierLabel}</Text>
                                    ) : null}
                                    <Text style={[styles.itemPrice, { color: theme.textLight }]}>
                                        ₹{price.toLocaleString()} × {qty} = ₹{(price * qty).toLocaleString()}
                                    </Text>
                                    <View style={styles.itemActions}>
                                        <View style={styles.qtyRow}>
                                            <TouchableOpacity
                                                style={[styles.qtyBtn, { borderColor: theme.border }]}
                                                onPress={() => handleUpdateQty(item.id, qty - 1)}
                                            >
                                                <Ionicons name="remove" size={18} color={theme.text} />
                                            </TouchableOpacity>
                                            <Text style={[styles.qtyText, { color: theme.text }]}>{qty}</Text>
                                            <TouchableOpacity
                                                style={[styles.qtyBtn, { borderColor: theme.border }]}
                                                onPress={() => handleUpdateQty(item.id, qty + 1)}
                                            >
                                                <Ionicons name="add" size={18} color={theme.text} />
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity onPress={() => handleRemove(item.id)}>
                                            <Ionicons name="trash-outline" size={22} color="#E11D48" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        }}
                    />
                    <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                        <Text style={[styles.totalValue, { color: theme.text }]}>₹{total.toLocaleString()}</Text>
                        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
                            <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
            <BottomTabBar navigation={navigation} activeRoute="Cart" cartItemCount={items.length} />
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
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    summaryTitle: { fontSize: 16, fontWeight: '600' },
    summaryCount: { fontSize: 14 },
    listContent: { padding: 16, paddingBottom: 170 },
    itemCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    itemName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    itemTier: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
    itemPrice: { fontSize: 14, marginBottom: 12 },
    itemActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    qtyBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    qtyText: { fontSize: 16, fontWeight: '600', minWidth: 24, textAlign: 'center' },
    footer: {
        marginHorizontal: 16,
        marginBottom: 78,
        padding: 16,
        borderWidth: 1,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 4,
    },
    totalLabel: { fontSize: 14 },
    totalValue: { fontSize: 20, fontWeight: 'bold', marginVertical: 8 },
    checkoutBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    checkoutBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
    emptyText: { fontSize: 14, marginTop: 8 },
    shopBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.primary, borderRadius: 10 },
    shopBtnText: { color: '#FFF', fontWeight: '600' },
});
