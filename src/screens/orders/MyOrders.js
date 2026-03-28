import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import BottomTabBar from '../../components/BottomTabBar';
import { formatFriendlyDate } from '../../utils/formatFriendlyDate';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'week', label: '7 days' },
    { key: 'month', label: '30 days' },
    { key: '90d', label: '90 days' },
];

function applyDateFilter(orders, filterKey) {
    if (filterKey === 'all' || !Array.isArray(orders)) return orders || [];
    const days = { week: 7, month: 30, '90d': 90 }[filterKey];
    if (!days) return orders;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return orders.filter((o) => {
        const t = o.created_at ? new Date(o.created_at).getTime() : 0;
        return t >= cutoff;
    });
}

export default function MyOrders({ navigation }) {
    const { theme } = useTheme();
    const { isAuthenticated, user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterKey, setFilterKey] = useState('all');

    const load = useCallback(async () => {
        if (!isAuthenticated || !user?.id) {
            setOrders([]);
            setLoading(false);
            return;
        }
        const { data, error } = await api.getOrders(user.id);
        if (!error && Array.isArray(data)) setOrders(data);
        else setOrders([]);
        setLoading(false);
    }, [isAuthenticated, user?.id]);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const filteredOrders = useMemo(() => applyDateFilter(orders, filterKey), [orders, filterKey]);

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>My Orders</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.text }]}>Sign in to see your orders.</Text>
                </View>
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
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>My Orders</Text>
                <View style={{ width: 40 }} />
            </View>

            {orders.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="receipt-outline" size={56} color={theme.textLight} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No orders yet</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.textLight }]}>
                        Orders from checkout will appear here.
                    </Text>
                </View>
            ) : (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                        style={styles.filterScroll}
                    >
                        {FILTERS.map((f) => {
                            const on = filterKey === f.key;
                            return (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterChip,
                                        {
                                            backgroundColor: on ? colors.primary + '22' : theme.card,
                                            borderColor: on ? colors.primary : theme.border,
                                        },
                                    ]}
                                    onPress={() => setFilterKey(f.key)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            { color: on ? colors.primary : theme.textLight },
                                        ]}
                                    >
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    <Text style={[styles.filterHint, { color: theme.textLight }]}>
                        {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}
                        {filterKey !== 'all' ? ' in range' : ''}
                    </Text>
                    <FlatList
                        data={filteredOrders}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                        }
                        renderItem={({ item, index }) => (
                            <TouchableOpacity
                                style={[styles.orderCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                                onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
                                activeOpacity={0.85}
                            >
                                <View style={styles.orderTop}>
                                    <View style={[styles.numBadge, { backgroundColor: colors.primary + '18' }]}>
                                        <Text style={[styles.numText, { color: colors.primary }]}>#{index + 1}</Text>
                                    </View>
                                    <Text style={[styles.orderId, { color: theme.textLight }]} numberOfLines={1}>
                                        {item.id?.slice(0, 8)}…
                                    </Text>
                                    <View style={[styles.orderStatusBadge, { backgroundColor: colors.primary + '14' }]}>
                                        <Text style={[styles.orderStatus, { color: colors.primary }]}>{item.status}</Text>
                                    </View>
                                </View>
                                {item.event_name ? (
                                    <Text style={[styles.occasionName, { color: theme.text }]} numberOfLines={2}>
                                        {item.event_name}
                                    </Text>
                                ) : (
                                    <Text style={[styles.occasionFallback, { color: theme.textLight }]}>Occasion not set</Text>
                                )}
                                <Text style={[styles.orderTotal, { color: theme.text }]}>
                                    ₹{Number(item.total_amount || 0).toLocaleString('en-IN')}
                                </Text>
                                <Text style={[styles.orderDate, { color: theme.textLight }]}>
                                    Placed {item.created_at ? formatFriendlyDate(item.created_at) : '—'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </>
            )}
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
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    filterScroll: { maxHeight: 48, flexGrow: 0 },
    filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        marginRight: 8,
    },
    filterChipText: { fontSize: 13, fontWeight: '700' },
    filterHint: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
    listContent: { padding: 12, paddingBottom: 94 },
    orderCard: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
    },
    orderTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    numBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    numText: { fontSize: 12, fontWeight: '800' },
    orderId: { fontSize: 11, fontFamily: 'monospace', flex: 1 },
    orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    orderStatus: { fontSize: 11, textTransform: 'capitalize', fontWeight: '700' },
    occasionName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
    occasionFallback: { fontSize: 13, marginBottom: 4, fontStyle: 'italic' },
    orderTotal: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
    orderDate: { fontSize: 12 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12 },
    emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    emptyText: { fontSize: 14 },
});
