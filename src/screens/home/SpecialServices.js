import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { api, useBackendApi } from '../../services/api';
import { resolveStorageUrl } from '../../services/supabase';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
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
    const { t: tr } = useLocale();
    const insets = useSafeAreaInsets();
    const { isAuthenticated, user } = useAuth();
    const { cartId: globalCartId, setCartId: setGlobalCartId, refreshCartCount } = useCart();
    const { showToast } = useToast();
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
            showToast({ variant: 'error', title: 'Could not load', message: error.message || 'Try again later.' });
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
    }, [useApi, showToast]);

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
            showToast({ variant: 'info', title: 'Select items', message: 'Choose at least one special add-on.' });
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
            showToast({
                variant: 'success',
                title: 'Added to cart',
                message: `${selected.size} item(s) added.`,
                action: { label: 'View cart', onPress: () => navigation.navigate('Cart') },
            });
        } catch (e) {
            showToast({ variant: 'error', title: 'Cart', message: e?.message || 'Could not add items.' });
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
                    <Text style={[styles.headerTitle, { color: theme.text }]}>{tr('special_catalog_title')}</Text>
                    <Text style={[styles.headerSub, { color: theme.textLight }]}>{tr('special_catalog_header_sub')}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.textLight }]}>{tr('special_catalog_loading')}</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                >
                    <LinearGradient
                        colors={isDarkMode ? ['#4c1d95', '#1e1b4b'] : ['#5B21B6', '#C2410C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.hero}
                    >
                        <View style={styles.heroIconRow}>
                            <Ionicons name="gift" size={26} color="#FFF" />
                            <View style={styles.heroBadge}>
                                <Text style={styles.heroBadgeText}>{tr('special_catalog_badge')}</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>{tr('special_catalog_hero_title')}</Text>
                        <Text style={styles.heroSub}>{tr('special_catalog_hero_sub')}</Text>
                    </LinearGradient>

                    {services.length === 0 ? (
                        <Text style={[styles.empty, { color: theme.textLight }]}>{tr('special_catalog_empty')}</Text>
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
                                            isOn && { shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
                                        ]}
                                    >
                                        <TouchableOpacity onPress={() => toggleService(svc)} activeOpacity={0.92}>
                                            <View style={styles.cardImageWrap}>
                                                {svc.image_url ? (
                                                    <Image source={{ uri: svc.image_url }} style={styles.cardImage} resizeMode="cover" />
                                                ) : (
                                                    <LinearGradient
                                                        colors={isDarkMode ? ['#334155', '#1e293b'] : ['#E2E8F0', '#F8FAFC']}
                                                        style={styles.cardImagePlaceholder}
                                                    >
                                                        <Ionicons name="sparkles" size={32} color={colors.primary} />
                                                    </LinearGradient>
                                                )}
                                                <LinearGradient
                                                    colors={['transparent', 'rgba(0,0,0,0.65)']}
                                                    style={styles.cardImageScrim}
                                                />
                                                <View style={styles.cardImageBadge}>
                                                    <Text style={styles.cardImageBadgeText}>{tr('special_catalog_badge')}</Text>
                                                </View>
                                                <View
                                                    style={[
                                                        styles.checkFloating,
                                                        {
                                                            borderColor: isOn ? '#FFF' : 'rgba(255,255,255,0.5)',
                                                            backgroundColor: isOn ? colors.primary : 'rgba(0,0,0,0.35)',
                                                        },
                                                    ]}
                                                >
                                                    {isOn ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
                                                </View>
                                            </View>
                                            <View style={styles.cardBody}>
                                                <Text style={[styles.svcName, { color: theme.text }]} numberOfLines={2}>
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
                                                                    backgroundColor: active ? t.color + '22' : theme.background,
                                                                },
                                                            ]}
                                                        >
                                                            <Text style={[styles.tierChipLabel, { color: theme.text }]} numberOfLines={1}>
                                                                {t.label}
                                                            </Text>
                                                            <Text style={[styles.tierChipPrice, { color: t.color }]}>
                                                                ₹{t.value.toLocaleString('en-IN')}
                                                            </Text>
                                                            {t.subVariety ? (
                                                                <Text style={[styles.tierSubVariety, { color: theme.textLight }]} numberOfLines={2}>
                                                                    {t.subVariety}
                                                                </Text>
                                                            ) : null}
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
    heroIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heroBadge: {
        backgroundColor: 'rgba(255,255,255,0.22)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    heroBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
    heroTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 10 },
    heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, marginTop: 6 },
    empty: { textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
    gridCard: {
        borderRadius: 16,
        borderWidth: 1.5,
        padding: 0,
        overflow: 'hidden',
    },
    cardImageWrap: {
        width: '100%',
        height: 108,
        position: 'relative',
        backgroundColor: '#E5E7EB',
    },
    cardImage: { width: '100%', height: '100%' },
    cardImagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardImageScrim: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '60%',
    },
    cardImageBadge: {
        position: 'absolute',
        left: 8,
        bottom: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    cardImageBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
    checkFloating: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBody: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 2 },
    gridCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    tierChips: { marginTop: 4, paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
    tierChip: {
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginBottom: 4,
    },
    tierChipLabel: { fontSize: 10, fontWeight: '700' },
    tierChipPrice: { fontSize: 13, fontWeight: '800', marginTop: 2 },
    tierSubVariety: { fontSize: 9, marginTop: 4, lineHeight: 12 },
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
