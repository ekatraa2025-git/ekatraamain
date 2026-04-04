import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api, useBackendApi } from '../../services/api';
import { resolveStorageUrl } from '../../services/supabase';
import { useCart } from '../../context/CartContext';
import BottomTabBar from '../../components/BottomTabBar';
import { getOfferableTierRows } from '../../utils/lineItemDisplay';

const { width } = Dimensions.get('window');
const GRID_GAP = 10;
const CARD_W = (width - 16 * 2 - GRID_GAP) / 2;

function numPrice(v) {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

export default function SpecialServices({ route, navigation }) {
    const { theme, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const { isAuthenticated, user } = useAuth();
    const { cartId: globalCartId, setCartId: setGlobalCartId, refreshCartCount } = useCart();
    const { occasionId, occasionName, city } = route.params || {};

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(new Map());
    const [cartId, setCartId] = useState(globalCartId || null);
    const [adding, setAdding] = useState(false);
    const useApi = useBackendApi();

    const load = useCallback(async () => {
        if (!useApi) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const { data, error } = await api.getSpecialServices();
        if (error) {
            Alert.alert('Could not load', error.message || 'Try again later.');
            setServices([]);
        } else {
            const resolved = await Promise.all(
                (data || []).map(async (s) => ({
                    ...s,
                    image_url: s.image_url ? await resolveStorageUrl(s.image_url) : null,
                }))
            );
            setServices(resolved);
        }
        setLoading(false);
    }, [useApi]);

    useEffect(() => {
        load();
    }, [load]);

    const selectTier = (svc, tierRow) => {
        setSelected((prev) => {
            const next = new Map(prev);
            const price = tierRow.value;
            if (price <= 0) return prev;
            next.set(svc.id, {
                tierKey: tierRow.key,
                price,
                name: svc.name,
                label: tierRow.label,
                qtyLabel: tierRow.qtyLabel,
                subVariety: tierRow.subVariety,
            });
            return next;
        });
    };

    const toggleService = (svc) => {
        const rows = getOfferableTierRows(svc);
        if (!rows.length) return;
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(svc.id)) next.delete(svc.id);
            else {
                const r = rows[0];
                next.set(svc.id, {
                    tierKey: r.key,
                    price: r.value,
                    name: svc.name,
                    label: r.label,
                    qtyLabel: r.qtyLabel,
                    subVariety: r.subVariety,
                });
            }
            return next;
        });
    };

    const total = [...selected.values()].reduce((s, r) => s + (r.price || 0), 0);

    const addToCart = async () => {
        if (selected.size === 0) {
            Alert.alert('Select items', 'Choose at least one special add-on.');
            return;
        }
        setAdding(true);
        try {
            let cid = cartId;
            if (!cid) {
                const { data: created, error: e1 } = await api.createCart({
                    session_id: 'special-' + Date.now(),
                    user_id: isAuthenticated && user?.id ? user.id : null,
                });
                if (e1) throw new Error(e1.message);
                cid = created?.id;
                if (cid) {
                    setCartId(cid);
                    await setGlobalCartId(cid);
                }
            }
            if (!cid) throw new Error('Could not create cart');

            for (const [serviceId, row] of selected) {
                const unit = numPrice(row.price);
                if (unit == null || unit <= 0) {
                    throw new Error('Invalid price for ' + row.name);
                }
                const { error: e2 } = await api.addCartItem({
                    cart_id: cid,
                    service_id: serviceId,
                    quantity: 1,
                    unit_price: unit,
                    options: {
                        tier: row.tierKey || 'price_basic',
                        occasion: occasionName || 'Special add-ons',
                        category: 'Special add-ons (all occasions)',
                        special_catalog: true,
                        ...(row.qtyLabel ? { qty_label: row.qtyLabel } : {}),
                        ...(row.subVariety ? { sub_variety: row.subVariety } : {}),
                    },
                });
                if (e2) throw new Error(e2.message);
            }
            await refreshCartCount?.(cid);
            Alert.alert('Added to cart', `${selected.size} item(s) added.`, [
                { text: 'View cart', onPress: () => navigation.navigate('Cart') },
                { text: 'OK', style: 'cancel' },
            ]);
        } catch (e) {
            Alert.alert('Cart', e?.message || 'Could not add items.');
        } finally {
            setAdding(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <View style={[styles.backCircle, { backgroundColor: isDarkMode ? '#2D3142' : '#F3F4F6' }]}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                    </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Special add-ons</Text>
                    <Text style={[styles.headerSub, { color: theme.textLight }]}>
                        For every occasion · curated extras
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.textLight }]}>Loading catalogue…</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                >
                    <LinearGradient
                        colors={isDarkMode ? ['#312e81', '#1e1b4b'] : ['#4338CA', '#C2410C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.hero}
                    >
                        <Ionicons name="gift" size={28} color="#FFF" />
                        <Text style={styles.heroTitle}>Special add-ons for any occasion</Text>
                        <Text style={styles.heroSub}>
                            Create your digital e-invites (AI-enabled). Your budget, your shortlisted vendors, your ideas — pick a tier per add-on.
                        </Text>
                    </LinearGradient>

                    {services.length === 0 ? (
                        <Text style={[styles.empty, { color: theme.textLight }]}>
                            No special services yet. Ask your coordinator or check back soon.
                        </Text>
                    ) : (
                        <FlatList
                            data={services}
                            numColumns={2}
                            scrollEnabled={false}
                            keyExtractor={(s) => s.id}
                            columnWrapperStyle={{ gap: GRID_GAP, marginBottom: GRID_GAP }}
                            renderItem={({ item: svc }) => {
                                const tiers = getOfferableTierRows(svc);
                                const isOn = selected.has(svc.id);
                                const sel = selected.get(svc.id);
                                return (
                                    <View
                                        style={[
                                            styles.gridCard,
                                            {
                                                width: CARD_W,
                                                backgroundColor: theme.card,
                                                borderColor: isOn ? colors.primary : theme.border,
                                            },
                                            isOn && { shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8 },
                                        ]}
                                    >
                                        <TouchableOpacity onPress={() => toggleService(svc)} activeOpacity={0.9}>
                                            <View style={styles.gridCardTop}>
                                                <View
                                                    style={[
                                                        styles.check,
                                                        {
                                                            borderColor: isOn ? colors.primary : theme.border,
                                                            backgroundColor: isOn ? colors.primary : 'transparent',
                                                        },
                                                    ]}
                                                >
                                                    {isOn ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
                                                </View>
                                                <Text style={[styles.svcName, { color: theme.text, fontSize: 15 }]} numberOfLines={2}>
                                                    {svc.name}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                        {tiers.length === 0 ? (
                                            <Text style={[styles.tierHint, { color: theme.textLight }]}>No tiers priced</Text>
                                        ) : (
                                            <View style={styles.tierChips}>
                                                {tiers.map((t) => {
                                                    const active = sel?.tierKey === t.key;
                                                    return (
                                                        <TouchableOpacity
                                                            key={t.key}
                                                            onPress={() => selectTier(svc, t)}
                                                            style={[
                                                                styles.tierChip,
                                                                {
                                                                    borderColor: active ? t.color : theme.border,
                                                                    backgroundColor: active ? t.color + '22' : 'transparent',
                                                                },
                                                            ]}
                                                        >
                                                            <Text style={[styles.tierChipLabel, { color: theme.text }]} numberOfLines={1}>
                                                                {t.label}
                                                            </Text>
                                                            <Text style={[styles.tierChipPrice, { color: t.color }]}>
                                                                ₹{t.value.toLocaleString('en-IN')}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        )}
                                        {svc.price_unit ? (
                                            <Text style={[styles.unitSmall, { color: theme.textLight }]}>Unit: {svc.price_unit}</Text>
                                        ) : null}
                                    </View>
                                );
                            }}
                        />
                    )}
                </ScrollView>
            )}

            <View
                style={[
                    styles.bottomBar,
                    {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                        paddingBottom: Math.max(insets.bottom, 10),
                    },
                ]}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.totalLabel, { color: theme.textLight }]}>Estimated</Text>
                    <Text style={[styles.total, { color: theme.text }]}>₹{total.toLocaleString('en-IN')}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.cta, selected.size === 0 && styles.ctaDisabled]}
                    onPress={addToCart}
                    disabled={adding || selected.size === 0}
                >
                    {adding ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <LinearGradient
                            colors={selected.size > 0 ? [colors.primary, '#EA580C'] : ['#9CA3AF', '#6B7280']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGrad}
                        >
                            <Ionicons name="cart" size={22} color="#FFF" />
                            <Text style={styles.ctaText}>Add to cart</Text>
                        </LinearGradient>
                    )}
                </TouchableOpacity>
            </View>

            <BottomTabBar navigation={navigation} activeRoute="Home" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    backBtn: { marginRight: 8 },
    backCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    headerSub: { fontSize: 12, marginTop: 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    scroll: { paddingHorizontal: 16, paddingTop: 12 },
    hero: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 18,
    },
    heroTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 10 },
    heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, marginTop: 6 },
    empty: { textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
    gridCard: {
        borderRadius: 14,
        borderWidth: 1.5,
        padding: 10,
        overflow: 'hidden',
    },
    gridCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    tierChips: { marginTop: 8, gap: 6 },
    tierChip: {
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginBottom: 4,
    },
    tierChipLabel: { fontSize: 10, fontWeight: '700' },
    tierChipPrice: { fontSize: 13, fontWeight: '800', marginTop: 2 },
    tierHint: { fontSize: 11, marginTop: 6 },
    unitSmall: { fontSize: 10, marginTop: 4 },
    card: {
        flexDirection: 'row',
        borderRadius: 16,
        borderWidth: 1.5,
        padding: 14,
        marginBottom: 12,
        overflow: 'hidden',
        alignItems: 'flex-start',
    },
    check: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 2,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    svcName: { fontSize: 17, fontWeight: '800' },
    svcDesc: { fontSize: 13, lineHeight: 19, marginTop: 4 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap' },
    price: { fontSize: 18, fontWeight: '800' },
    unit: { fontSize: 12 },
    city: { fontSize: 12 },
    bottomBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 72,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        gap: 12,
    },
    totalLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
    total: { fontSize: 22, fontWeight: '800' },
    cta: { borderRadius: 14, overflow: 'hidden', minWidth: width * 0.42 },
    ctaDisabled: { opacity: 0.7 },
    ctaGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
