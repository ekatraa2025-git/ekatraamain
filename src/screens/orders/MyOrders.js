import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import BottomTabBar from '../../components/BottomTabBar';

export default function MyOrders({ navigation }) {
    const { theme } = useTheme();
    const { isAuthenticated, user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
                    <Ionicons name="receipt-outline" size={64} color={theme.textLight} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No orders yet</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.textLight }]}>
                        Orders from the new flow will appear here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.orderCard, { backgroundColor: theme.card }]}
                            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
                            activeOpacity={0.85}
                        >
                            <View style={styles.orderTopRow}>
                                <Text style={[styles.orderId, { color: theme.text }]}>#{item.id?.slice(0, 8)}…</Text>
                                <View style={[styles.orderStatusBadge, { backgroundColor: colors.primary + '14' }]}>
                                    <Text style={[styles.orderStatus, { color: colors.primary }]}>{item.status}</Text>
                                </View>
                            </View>
                            <Text style={[styles.orderTotal, { color: theme.text }]}>₹{Number(item.total_amount || 0).toLocaleString()}</Text>
                            <Text style={[styles.orderDate, { color: theme.textLight }]}>
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
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
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16, paddingBottom: 94 },
    orderCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#00000010',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    orderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    orderId: { fontSize: 13, fontFamily: 'monospace' },
    orderTotal: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    orderStatus: { fontSize: 12, textTransform: 'capitalize', fontWeight: '700' },
    orderDate: { fontSize: 12, marginTop: 4 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
    emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    emptyText: { fontSize: 14 },
});
