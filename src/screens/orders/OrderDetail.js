import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import BottomTabBar from '../../components/BottomTabBar';

export default function OrderDetail({ route, navigation }) {
    const { theme } = useTheme();
    const { orderId } = route.params || {};
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!orderId) return;
        const { data, error } = await api.getOrder(orderId);
        if (!error) setOrder(data);
        setLoading(false);
    }, [orderId]);

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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Order</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <Text style={[styles.statusBadge, { color: theme.text }]}>{order?.status || '—'}</Text>
                    <Text style={[styles.total, { color: theme.text }]}>
                        ₹{Number(order?.total_amount || 0).toLocaleString()}
                    </Text>
                    {order?.contact_name && (
                        <Text style={[styles.meta, { color: theme.textLight }]}>{order.contact_name}</Text>
                    )}
                    {order?.event_date && (
                        <Text style={[styles.meta, { color: theme.textLight }]}>Event: {order.event_date}</Text>
                    )}
                </View>

                {items.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Items</Text>
                        {items.map((item, i) => (
                            <View key={i} style={styles.itemRow}>
                                <Text style={[styles.itemName, { color: theme.text }]}>
                                    {item.name || 'Item'} × {item.quantity}
                                </Text>
                                <Text style={[styles.itemPrice, { color: theme.textLight }]}>
                                    ₹{(Number(item.unit_price) * Number(item.quantity)).toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {history.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Status history</Text>
                        {history.map((h, i) => (
                            <Text key={i} style={[styles.historyItem, { color: theme.textLight }]}>
                                {h.status} {h.note ? `— ${h.note}` : ''} ({h.created_at ? new Date(h.created_at).toLocaleString() : ''})
                            </Text>
                        ))}
                    </View>
                )}

                {/* Vendor quotes - updates when vendors submit quotes; pull to refresh */}
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Vendor quotes</Text>
                    {quotes.length > 0 ? (
                        quotes.map((q, i) => (
                            <View key={i} style={[styles.quoteRow, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.quoteVendor, { color: theme.text }]}>{q.vendor_name || 'Vendor'}</Text>
                                <Text style={[styles.quoteAmount, { color: colors.primary }]}>
                                    {q.amount != null ? `₹${Number(q.amount).toLocaleString()}` : '—'}
                                </Text>
                                <Text style={[styles.quoteStatus, { color: theme.textLight }]}>{q.status || 'Submitted'}</Text>
                                {q.note ? <Text style={[styles.quoteNote, { color: theme.textLight }]}>{q.note}</Text> : null}
                            </View>
                        ))
                    ) : (
                        <Text style={[styles.quoteEmpty, { color: theme.textLight }]}>
                            No quotes yet. Vendors can submit quotes for your order—pull to refresh for updates.
                        </Text>
                    )}
                </View>
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
    scroll: { padding: 16, paddingBottom: 40 },
    card: {
        padding: 16,
        borderRadius: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#00000010',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    statusBadge: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize', marginBottom: 4 },
    total: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
    meta: { fontSize: 14, marginBottom: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    itemName: { fontSize: 14 },
    itemPrice: { fontSize: 14 },
    historyItem: { fontSize: 13, marginBottom: 4 },
    quoteRow: { paddingVertical: 12, borderBottomWidth: 1 },
    quoteVendor: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    quoteAmount: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    quoteStatus: { fontSize: 13, textTransform: 'capitalize' },
    quoteNote: { fontSize: 12, marginTop: 4 },
    quoteEmpty: { fontSize: 14, fontStyle: 'italic' },
    emptyText: { padding: 16 },
});
