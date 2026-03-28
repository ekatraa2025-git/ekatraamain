import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, FlatList, Image,
    TouchableOpacity, Dimensions, Modal, Linking,
    ActivityIndicator, RefreshControl, Animated, TextInput,
    KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { EVENT_TYPES as MOCK_EVENT_TYPES, CITIES } from '../../data/mockData';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useEventForm } from '../../context/EventFormContext';
import ChatModal from '../../components/ChatModal';
import { AnimatedBackground } from '../../components/AnimatedBackground';
import { dbService, resolveStorageUrl } from '../../services/supabase';
import { api, useBackendApi } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAppData } from '../../context/AppDataContext';
import BottomTabBar from '../../components/BottomTabBar';
import Logo from '../../components/Logo';
import RecommendationBudgetModal from '../../components/RecommendationBudgetModal';
import LocationMapPickerModal from '../../components/LocationMapPickerModal';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');
const OCCASION_CARD_GAP = 12;
const OCCASION_CARD_WIDTH_SINGLE_ROW = (width - 20 * 2 - OCCASION_CARD_GAP * 2) / 3;
const OCCASION_CARD_WIDTH = (width - 20 * 2 - OCCASION_CARD_GAP) / 2;
const OCCASION_CARD_WIDTH_3COL = (width - 20 * 2 - OCCASION_CARD_GAP * 2) / 3;
const CATEGORY_BOX_WIDTH = 110;
const BUDGET_OPTIONS = [
    '6-10 Lakhs', '11-15 Lakhs', '16-20 Lakhs',
    '21-30 Lakhs', '30 Lakhs+', '50 Lakhs+',
];

const MIN_PLANNED_BUDGET_INR = 100000;
const MAX_PLANNED_BUDGET_INR = 20000000;
const BUDGET_CHIP_TO_INR = {
    '6-10 Lakhs': 800000,
    '11-15 Lakhs': 1300000,
    '16-20 Lakhs': 1800000,
    '21-30 Lakhs': 2550000,
    '30 Lakhs+': 3500000,
    '50 Lakhs+': 6000000,
};

function formatBudgetInrLabel(inr) {
    if (!Number.isFinite(inr) || inr <= 0) return '';
    const lakhs = inr / 100000;
    if (lakhs >= 100) {
        const cr = lakhs / 100;
        const s = cr >= 10 ? cr.toFixed(1) : cr.toFixed(2);
        return `₹${s.replace(/\.?0+$/, '')} Cr`;
    }
    const s = lakhs >= 10 ? lakhs.toFixed(1) : lakhs.toFixed(2);
    return `₹${s.replace(/\.?0+$/, '')} Lakhs`;
}

const BANNER_EDGE_PAD = 20;
const BANNER_TILE_GAP = 10;
/** At this count or higher, banners use the horizontal slider instead of the bento grid. */
const BANNER_SLIDER_MIN_COUNT = 5;

function bannerDiscountLabel(item) {
    if (!item || typeof item !== 'object') return null;
    if (item.discount_percent != null && item.discount_percent !== '') {
        const n = Number(item.discount_percent);
        if (Number.isFinite(n)) return `${Math.round(n)}% OFF`;
    }
    if (typeof item.discount_text === 'string' && item.discount_text.trim()) return item.discount_text.trim();
    if (typeof item.promo_text === 'string' && item.promo_text.trim()) return item.promo_text.trim();
    return null;
}

function bannerBentoTileSize(count, index, screenW) {
    const fullW = screenW - BANNER_EDGE_PAD * 2;
    const colW = (fullW - BANNER_TILE_GAP) / 2;
    if (count === 1) return { w: fullW, h: 188 };
    if (count === 2) return { w: colW, h: 160 };
    if (count === 3) return index === 2 ? { w: fullW, h: 152 } : { w: colW, h: 152 };
    return { w: colW, h: 144 };
}

export default function Home({ navigation }) {
    const { theme, isDarkMode } = useTheme();
    const { isAuthenticated, user } = useAuth();
    const { setEventForm } = useEventForm();

    const [locationName, setLocationName] = useState('Bhubaneswar, Odisha');
    const [selectedType, setSelectedType] = useState(null);
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [currentCity, setCurrentCity] = useState('Bhubaneswar');
    const { cartId, setCartId, cartItemCount, refreshCartCount: refreshGlobalCartCount } = useCart();
    const { getOccasions, getBanners, getCategories: getCachedCategories, invalidateCache } = useAppData();
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState(new Set());

    const [cities, setCities] = useState(CITIES);
    const [banners, setBanners] = useState([]);
    const [eventTypes, setEventTypes] = useState(MOCK_EVENT_TYPES);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [othersExpanded, setOthersExpanded] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [skipForm, setSkipForm] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [recommendationsModalVisible, setRecommendationsModalVisible] = useState(false);
    const [recommendationsData, setRecommendationsData] = useState(null);
    const [plannedBudgetInr, setPlannedBudgetInr] = useState(800000);
    const [recommendationFormSnapshot, setRecommendationFormSnapshot] = useState(null);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [mapPickerVisible, setMapPickerVisible] = useState(false);
    const [eventLocLoading, setEventLocLoading] = useState(false);
    const [testimonials, setTestimonials] = useState([]);
    const useApi = useBackendApi();

    const [form, setForm] = useState({
        role: '',
        contact_name: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
        contact_mobile: user?.phone || '',
        contact_email: user?.email || '',
        event_date: '',
        guest_count: '',
        location_preference: '',
        venue_preference: '',
        location_kind: '',
        venue_detail: '',
        planned_budget: '',
    });

    const categoryAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (cancelled || status !== 'granted') return;
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (cancelled) return;
                const [rev] = await Location.reverseGeocodeAsync({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                });
                if (cancelled || !rev) return;
                const cityName = rev.city || rev.subregion || rev.region || 'Unknown';
                const stateName = rev.region || '';
                const displayLocation = stateName ? `${cityName}, ${stateName}` : cityName;
                setLocationName(displayLocation);
                setCurrentCity(cityName);
            } catch (e) { }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        fetchData();
    }, [currentCity]);

    useEffect(() => {
        if (!useApi) return;
        let cancelled = false;
        (async () => {
            const { data } = await api.getTestimonials();
            if (!cancelled && Array.isArray(data)) setTestimonials(data);
        })();
        return () => {
            cancelled = true;
        };
    }, [useApi]);

    useEffect(() => {
        const mapped = BUDGET_CHIP_TO_INR[form.planned_budget];
        if (mapped) setPlannedBudgetInr(mapped);
    }, [form.planned_budget]);

    const showCategoriesStep = selectedType && (formSubmitted || skipForm);

    useEffect(() => {
        if (!showCategoriesStep) {
            setCategories([]);
            setSelectedCategories(new Set());
            setCategoriesLoading(false);
            Animated.timing(categoryAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
            return;
        }
        const loadCategories = async () => {
            setCategoriesLoading(true);
            try {
                const cats = await getCachedCategories(selectedType);
                const resolved = await Promise.all((cats || []).map(async (cat) => ({
                    ...cat,
                    icon_url: await resolveStorageUrl(cat.icon_url),
                })));
                setCategories(resolved);
                setSelectedCategories(new Set());
                if (resolved.length > 0) {
                    Animated.spring(categoryAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: false }).start();
                }
            } catch (e) {
                console.log('[CATEGORY LOAD ERROR]', e);
            } finally {
                setCategoriesLoading(false);
            }
        };
        loadCategories();
    }, [useApi, selectedType, showCategoriesStep]);

    useFocusEffect(
        useCallback(() => {
            refreshGlobalCartCount();
        }, [refreshGlobalCartCount])
    );

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            const [cachedOccasions, cachedBanners] = await Promise.all([
                getOccasions(forceRefresh),
                getBanners(forceRefresh),
            ]);
            if (cachedOccasions?.length) {
                setEventTypes(cachedOccasions);
            } else {
                setEventTypes(MOCK_EVENT_TYPES);
            }
            if (cachedBanners?.length) {
                setBanners(cachedBanners);
            }

            const { data: cityData } = await dbService.getCities();
            if (cityData?.length) {
                const uniqueCityStrings = [...new Set(cityData.map(c => `${c.name}, ${c.state}`))];
                setCities(uniqueCityStrings);
            }
        } catch (error) {
            console.log('[FETCH ERROR]', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        invalidateCache();
        await fetchData(true);
        setRefreshing(false);
    }, [currentCity, selectedType]);

    const handleCityChange = (city) => {
        const cityNameOnly = city.split(',')[0].trim();
        setCurrentCity(cityNameOnly);
        setLocationName(city);
        setLocationPickerVisible(false);
    };

    const handleEventCurrentLocationPress = useCallback(async () => {
        setEventLocLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Allow location to pin your event area.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const [rev] = await Location.reverseGeocodeAsync({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
            });
            const parts = [
                rev?.name,
                rev?.street,
                rev?.district,
                rev?.city,
                rev?.subregion,
                rev?.region,
                rev?.postalCode,
            ].filter(Boolean);
            const line = parts.length ? [...new Set(parts)].join(', ') : '';
            setForm((p) => ({
                ...p,
                location_preference: line || [rev?.city, rev?.region].filter(Boolean).join(', ') || 'Current location',
            }));
        } catch (e) {
            Alert.alert('Location', e?.message || 'Could not get your position.');
        } finally {
            setEventLocLoading(false);
        }
    }, []);

    const handleEventTypePress = (typeObj) => {
        const id = typeof typeObj === 'object' ? typeObj.id : typeObj;
        const newId = id === selectedType ? null : id;
        setSelectedType(newId);
        if (newId) {
            setFormSubmitted(false);
            setSkipForm(false);
        }
    };

    const handleFormSubmit = async () => {
        if (!form.contact_name.trim() || !form.contact_mobile.trim()) {
            Alert.alert('Required', 'Please fill in your name and mobile number.');
            return;
        }
        if (!form.planned_budget?.trim()) {
            Alert.alert('Budget required', 'Please pick a budget range or set your budget with the slider before continuing.');
            return;
        }
        setFormSubmitting(true);
        const budgetLabel = form.planned_budget?.trim() || null;
        const budgetInrClamped = Math.min(
            MAX_PLANNED_BUDGET_INR,
            Math.max(MIN_PLANNED_BUDGET_INR, Math.round(plannedBudgetInr))
        );
        const venuePref =
            form.location_kind === 'venue'
                ? form.venue_detail?.trim() || null
                : form.location_kind === 'own_place'
                    ? 'Own place'
                    : form.venue_preference || null;
        const payload = {
            role: form.role || null,
            contact_name: form.contact_name.trim(),
            contact_mobile: form.contact_mobile.trim(),
            contact_email: form.contact_email?.trim() || null,
            event_date: form.event_date || null,
            guest_count: form.guest_count ? parseInt(form.guest_count, 10) : null,
            location_preference: form.location_preference?.trim() || null,
            venue_preference: venuePref,
            planned_budget: budgetLabel,
        };
        setEventForm(payload);
        setRecommendationFormSnapshot(
            budgetLabel ? { ...payload, planned_budget_inr: budgetInrClamped } : { ...payload, planned_budget_inr: null }
        );

        try {
            if (useApi) {
                let cid = cartId;
                const occasionDisplayName =
                    selectedType && Array.isArray(eventTypes)
                        ? eventTypes.find((t) => t.id === selectedType)?.name ?? null
                        : null;
                const cartPayload = {
                    event_name: occasionDisplayName,
                    event_role: form.role?.trim() || null,
                    contact_name: payload.contact_name,
                    contact_mobile: payload.contact_mobile,
                    contact_email: payload.contact_email,
                    event_date: payload.event_date,
                    guest_count: payload.guest_count,
                    location_preference: payload.location_preference,
                    venue_preference: payload.venue_preference,
                    planned_budget: payload.planned_budget,
                    planned_budget_inr: budgetLabel ? budgetInrClamped : null,
                };
                if (!cid) {
                    const { data: created, error } = await api.createCart({
                        session_id: 'app-' + Date.now(),
                        user_id: isAuthenticated ? user?.id : null,
                        ...cartPayload,
                    });
                    if (error) throw new Error(error.message);
                    if (created?.id) {
                        cid = created.id;
                        await setCartId(cid);
                    }
                } else {
                    const { error } = await api.updateCart(cid, cartPayload);
                    if (error) throw new Error(error.message);
                }
                if (cid) refreshGlobalCartCount(cid);
            }

            if (useApi && budgetLabel) {
                const { data: recData, error: recErr } = await api.getRecommendations(selectedType, {
                    budget_inr: budgetInrClamped,
                    budget: budgetLabel,
                });
                if (!recErr && recData?.categories?.length) {
                    setRecommendationsData(recData);
                    setRecommendationsModalVisible(true);
                    setFormSubmitting(false);
                    return;
                }
            }
        } catch (e) {
            console.warn('[Form submit]', e);
        }
        setFormSubmitted(true);
        setFormSubmitting(false);
    };

    const handleSkipForm = () => {
        setEventForm(null);
        setSkipForm(true);
    };

    const toggleCategory = (cat) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            const id = typeof cat === 'object' ? cat.id : cat;
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleExploreServices = () => {
        const selCats = categories.filter(c => selectedCategories.has(c.id));
        const catIds = selCats.map(c => c.id);
        const catNames = selCats.map(c => c.name);
        navigation.navigate('CategoryServices', {
            categoryIds: catIds,
            categoryNames: catNames,
            occasionId: selectedType,
            occasionName: eventTypes.find(t => t.id === selectedType)?.name,
            cartId,
        });
    };

    const selectedOccasionObj = eventTypes.find(t => t.id === selectedType);
    const weddingOccasion = eventTypes.find((t) => {
        const id = String(t.id || '').toLowerCase();
        const name = String(t.name || '').toLowerCase();
        return id === 'wedding' || name.includes('wedding');
    });
    const janeyuOccasion = eventTypes.find((t) => {
        if (t.id === weddingOccasion?.id) return false;
        const id = String(t.id || '').toLowerCase();
        const name = String(t.name || '').toLowerCase();
        return name.includes('janeyu') || name.includes('janayu') || name.includes('thread') || id === 'janayu' || id === 'janeyu';
    });
    const otherOccasions = eventTypes.filter((t) => t.id !== weddingOccasion?.id && t.id !== janeyuOccasion?.id);
    const selectedInOthers = !!selectedType && otherOccasions.some((t) => t.id === selectedType);
    const catColors = ['#FF7A00', '#1E3A8A', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444', '#14B8A6', '#6366F1'];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <AnimatedBackground>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.logoWrap}>
                                <Logo width={32} height={32} />
                            </View>
                            <TouchableOpacity onPress={() => setLocationPickerVisible(true)} style={styles.locationBtn}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.locationLabel, { color: theme.textLight }]}>Your Location</Text>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location" size={14} color={colors.primary} />
                                        <Text style={[styles.locationValue, { color: theme.text }]}>{locationName}</Text>
                                        <Ionicons name="chevron-down" size={14} color={theme.textLight} style={{ marginLeft: 2 }} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? '#1F2333' : '#F3F4F6' }]}
                                onPress={() => navigation.navigate('Cart')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="cart-outline" size={22} color={theme.text} />
                                {cartItemCount > 0 && (
                                    <View style={[styles.cartBadge, { backgroundColor: colors.primary }]}>
                                        <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? '99+' : cartItemCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Location Picker Modal */}
                    <Modal visible={locationPickerVisible} animationType="fade" transparent>
                        <TouchableOpacity style={styles.modalOverlay} onPress={() => setLocationPickerVisible(false)} activeOpacity={1}>
                            <View style={[styles.pickerContent, { backgroundColor: theme.card }]} onStartShouldSetResponder={() => true}>
                                <View style={styles.pickerHandle} />
                                <Text style={[styles.pickerTitle, { color: theme.text }]}>Select City</Text>
                                <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.pickerScrollContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
                                    {[...new Set(cities)].map((city, index) => {
                                        const isCurrentCity = locationName === city;
                                        return (
                                            <TouchableOpacity
                                                key={`${city}-${index}`}
                                                style={[
                                                    styles.pickerItem,
                                                    { borderBottomColor: theme.border },
                                                    isCurrentCity && { backgroundColor: colors.primary + '10' },
                                                ]}
                                                onPress={() => handleCityChange(city)}
                                            >
                                                <Ionicons name="location-outline" size={18} color={isCurrentCity ? colors.primary : theme.textLight} />
                                                <Text style={[
                                                    styles.pickerItemText,
                                                    { color: theme.text },
                                                    isCurrentCity && { color: colors.primary, fontWeight: '700' },
                                                ]}>{city}</Text>
                                                {isCurrentCity && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </TouchableOpacity>
                    </Modal>

                    {/* AI Chat Input */}
                    <TouchableOpacity
                        style={[styles.aiChatBar, { backgroundColor: theme.inputBackground, borderColor: colors.primary + '40' }]}
                        onPress={() => setChatModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.aiIconWrap, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="sparkles" size={18} color={colors.primary} />
                        </View>
                        <Text style={[styles.aiPlaceholder, { color: theme.textLight }]}>
                            Tell us about your event and we'll find the best services...
                        </Text>
                        <Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />
                    </TouchableOpacity>

                    {/* Banner Ads — bento grid (1–4 items) or slider (5+ items) */}
                    {banners.length > 0 && (
                        <View style={styles.bannerSection}>
                            {banners.length >= BANNER_SLIDER_MIN_COUNT ? (
                                <FlatList
                                    data={banners}
                                    renderItem={({ item }) => {
                                        const discount = bannerDiscountLabel(item);
                                        return (
                                            <TouchableOpacity style={styles.bannerCard} activeOpacity={0.9}>
                                                <Image
                                                    source={{
                                                        uri:
                                                            item.image_url ||
                                                            'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
                                                    }}
                                                    style={styles.bannerImage}
                                                    resizeMode="cover"
                                                />
                                                <LinearGradient
                                                    colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.78)']}
                                                    style={styles.bannerOverlayFill}
                                                >
                                                    {discount ? (
                                                        <View style={[styles.bannerDiscountPill, { backgroundColor: colors.primary }]}>
                                                            <Text style={styles.bannerDiscountPillText}>{discount}</Text>
                                                        </View>
                                                    ) : null}
                                                    <View style={styles.bannerTextBlock}>
                                                        <Text style={styles.bannerTitle}>{item.title}</Text>
                                                        {item.subtitle ? (
                                                            <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                                                        ) : null}
                                                    </View>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    keyExtractor={(item) => item.id}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    pagingEnabled
                                    snapToInterval={width - 40}
                                    decelerationRate="fast"
                                    contentContainerStyle={styles.bannerList}
                                />
                            ) : (
                                <View style={styles.bannerBentoWrap}>
                                    {banners.map((item, index) => {
                                        const { w, h } = bannerBentoTileSize(banners.length, index, width);
                                        const discount = bannerDiscountLabel(item);
                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={[styles.bannerBentoTile, { width: w, height: h }]}
                                                activeOpacity={0.92}
                                            >
                                                <Image
                                                    source={{
                                                        uri:
                                                            item.image_url ||
                                                            'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
                                                    }}
                                                    style={styles.bannerImage}
                                                    resizeMode="cover"
                                                />
                                                <LinearGradient
                                                    colors={['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.82)']}
                                                    style={styles.bannerOverlayFill}
                                                >
                                                    {discount ? (
                                                        <View style={[styles.bannerDiscountPill, { backgroundColor: colors.primary }]}>
                                                            <Text style={styles.bannerDiscountPillText}>{discount}</Text>
                                                        </View>
                                                    ) : null}
                                                    <View style={styles.bannerTextBlock}>
                                                        <Text style={styles.bannerBentoTitle} numberOfLines={2}>
                                                            {item.title}
                                                        </Text>
                                                        {item.subtitle ? (
                                                            <Text style={styles.bannerBentoSubtitle} numberOfLines={2}>
                                                                {item.subtitle}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Plan Your Occasion - Wedding, Janeyu, Others in single row */}
                    <View style={styles.section}>
                        <View style={styles.sectionTitleRow}>
                            <View>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Plan Your Occasion</Text>
                                <Text style={[styles.sectionSubtitle, { color: theme.textLight }]}>Choose an event to get started</Text>
                            </View>
                        </View>
                        {loading ? (
                            <View style={styles.occasionRowSingle}>
                                {[1, 2, 3].map(i => (
                                    <View key={i} style={[styles.occasionCardSingle, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <View style={[styles.occasionIconWrap, { backgroundColor: isDarkMode ? '#252840' : '#F3F4F6' }]}>
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        </View>
                                        <View style={{ width: 50, height: 10, borderRadius: 5, backgroundColor: isDarkMode ? '#2D3142' : '#E5E7EB' }} />
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View>
                                <View style={styles.occasionRowSingle}>
                                    {weddingOccasion && (
                                        <TouchableOpacity
                                            style={[
                                                styles.occasionCardSingle,
                                                { backgroundColor: theme.card, borderColor: theme.border },
                                                selectedType === weddingOccasion.id && { borderColor: (weddingOccasion.color || colors.primary), borderWidth: 2 },
                                            ]}
                                            onPress={() => handleEventTypePress(weddingOccasion)}
                                            activeOpacity={0.8}
                                        >
                                            {selectedType === weddingOccasion.id && (
                                                <LinearGradient
                                                    colors={[(weddingOccasion.color || colors.primary) + '15', (weddingOccasion.color || colors.primary) + '08']}
                                                    style={StyleSheet.absoluteFill}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                />
                                            )}
                                            <View style={[
                                                styles.occasionIconWrap,
                                                { backgroundColor: selectedType === weddingOccasion.id ? (weddingOccasion.color || colors.primary) + '25' : (isDarkMode ? '#252840' : '#F3F4F6') },
                                            ]}>
                                                {weddingOccasion.image_url ? (
                                                    <Image source={{ uri: weddingOccasion.image_url }} style={styles.occasionIconImg} resizeMode="cover" />
                                                ) : (
                                                    <Text style={styles.occasionEmoji}>{weddingOccasion.icon || '💒'}</Text>
                                                )}
                                            </View>
                                            <Text style={[
                                                styles.occasionLabel,
                                                { color: theme.text },
                                                selectedType === weddingOccasion.id && { color: weddingOccasion.color || colors.primary, fontWeight: '700' },
                                            ]} numberOfLines={2}>Wedding</Text>
                                            {selectedType === weddingOccasion.id && (
                                                <View style={[styles.occasionCheck, { backgroundColor: weddingOccasion.color || colors.primary }]}>
                                                    <Ionicons name="checkmark" size={12} color="#FFF" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    {janeyuOccasion && (
                                        <TouchableOpacity
                                            style={[
                                                styles.occasionCardSingle,
                                                { backgroundColor: theme.card, borderColor: theme.border },
                                                selectedType === janeyuOccasion.id && { borderColor: (janeyuOccasion.color || colors.primary), borderWidth: 2 },
                                            ]}
                                            onPress={() => handleEventTypePress(janeyuOccasion)}
                                            activeOpacity={0.8}
                                        >
                                            {selectedType === janeyuOccasion.id && (
                                                <LinearGradient
                                                    colors={[(janeyuOccasion.color || colors.primary) + '15', (janeyuOccasion.color || colors.primary) + '08']}
                                                    style={StyleSheet.absoluteFill}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                />
                                            )}
                                            <View style={[
                                                styles.occasionIconWrap,
                                                { backgroundColor: selectedType === janeyuOccasion.id ? (janeyuOccasion.color || colors.primary) + '25' : (isDarkMode ? '#252840' : '#F3F4F6') },
                                            ]}>
                                                {janeyuOccasion.image_url ? (
                                                    <Image source={{ uri: janeyuOccasion.image_url }} style={styles.occasionIconImg} resizeMode="cover" />
                                                ) : (
                                                    <Text style={styles.occasionEmoji}>{janeyuOccasion.icon || '🕉️'}</Text>
                                                )}
                                            </View>
                                            <Text style={[
                                                styles.occasionLabel,
                                                { color: theme.text },
                                                selectedType === janeyuOccasion.id && { color: janeyuOccasion.color || colors.primary, fontWeight: '700' },
                                            ]} numberOfLines={2}>Janeyu</Text>
                                            {selectedType === janeyuOccasion.id && (
                                                <View style={[styles.occasionCheck, { backgroundColor: janeyuOccasion.color || colors.primary }]}>
                                                    <Ionicons name="checkmark" size={12} color="#FFF" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={[
                                            styles.occasionCardSingle,
                                            styles.othersCard,
                                            { backgroundColor: theme.card, borderColor: theme.border },
                                            (othersExpanded || selectedInOthers) && { borderColor: colors.primary, borderWidth: 2 },
                                        ]}
                                        onPress={() => setOthersExpanded((prev) => !prev)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[
                                            styles.occasionIconWrap,
                                            { backgroundColor: colors.primary + '15' },
                                        ]}>
                                            <Ionicons name={othersExpanded ? 'chevron-up' : 'grid-outline'} size={24} color={colors.primary} />
                                        </View>
                                        <Text style={[
                                            styles.occasionLabel,
                                            { color: theme.text },
                                            (othersExpanded || selectedInOthers) && { color: colors.primary, fontWeight: '700' },
                                        ]} numberOfLines={2}>
                                            Others
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                {othersExpanded && otherOccasions.length > 0 && (
                                    <View style={styles.occasionGridExpanded}>
                                        {otherOccasions.map((type) => {
                                            const typeColor = type.color || colors.primary;
                                            const isSelected = selectedType === type.id;
                                            return (
                                                <TouchableOpacity
                                                    key={type.id}
                                                    style={[
                                                        styles.occasionCard,
                                                        styles.occasionCardCompact3Col,
                                                        { backgroundColor: theme.card, borderColor: theme.border },
                                                        isSelected && { borderColor: typeColor, borderWidth: 2 },
                                                    ]}
                                                    onPress={() => handleEventTypePress(type)}
                                                    activeOpacity={0.8}
                                                >
                                                    {isSelected && (
                                                        <LinearGradient
                                                            colors={[typeColor + '15', typeColor + '08']}
                                                            style={StyleSheet.absoluteFill}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                        />
                                                    )}
                                                    <View style={[
                                                        styles.occasionIconWrap,
                                                        { backgroundColor: isSelected ? typeColor + '25' : (isDarkMode ? '#252840' : '#F3F4F6') },
                                                    ]}>
                                                        {type.image_url ? (
                                                            <Image source={{ uri: type.image_url }} style={styles.occasionIconImg} resizeMode="cover" />
                                                        ) : (
                                                            <Text style={styles.occasionEmoji}>{type.icon || '🎉'}</Text>
                                                        )}
                                                    </View>
                                                    <Text style={[
                                                        styles.occasionLabel,
                                                        { color: theme.text },
                                                        isSelected && { color: typeColor, fontWeight: '700' },
                                                    ]} numberOfLines={2}>{type.name}</Text>
                                                    {isSelected && (
                                                        <View style={[styles.occasionCheck, { backgroundColor: typeColor }]}>
                                                            <Ionicons name="checkmark" size={12} color="#FFF" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* User Info Form - shown when occasion selected, before categories */}
                    {selectedType && !formSubmitted && !skipForm && (
                        <View style={[styles.formSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.formSectionTitle, { color: theme.text }]}>Tell us about your event</Text>
                            <Text style={[styles.formSectionSubtitle, { color: theme.textLight }]}>
                                Help us show you the best categories for {selectedOccasionObj?.name || 'your occasion'}
                            </Text>
                            <TouchableOpacity
                                style={styles.specialSkipWrap}
                                onPress={() =>
                                    navigation.navigate('SpecialServices', {
                                        occasionId: selectedType,
                                        occasionName: selectedOccasionObj?.name,
                                        city: currentCity,
                                    })
                                }
                                activeOpacity={0.92}
                            >
                                <LinearGradient
                                    colors={['#4F46E5', '#7C3AED', '#A855F7']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.specialSkipGradient}
                                >
                                    <View style={styles.specialSkipIconCircle}>
                                        <Ionicons name="sparkles" size={22} color="#4F46E5" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.specialSkipTitle}>Skip form · Special add-ons</Text>
                                        <Text style={styles.specialSkipSub}>
                                            Odiya Bhara, Puja Samagri, party poppers, beverages & more — all occasions
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={22} color="#FFF" />
                                </LinearGradient>
                            </TouchableOpacity>
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>I am the</Text>
                                    <View style={styles.roleRow}>
                                        {['Groom', 'Bride', 'Host', 'Other'].map(role => (
                                            <TouchableOpacity
                                                key={role}
                                                style={[
                                                    styles.roleChip,
                                                    { backgroundColor: isDarkMode ? '#252840' : '#FFF', borderColor: theme.border },
                                                    form.role === role && { backgroundColor: colors.primary, borderColor: colors.primary },
                                                ]}
                                                onPress={() => setForm(p => ({ ...p, role }))}
                                            >
                                                <Text style={[
                                                    styles.roleText,
                                                    { color: theme.text },
                                                    form.role === role && { color: '#FFF', fontWeight: '700' },
                                                ]}>{role}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.formRow}>
                                    <View style={styles.formCol}>
                                        <Text style={[styles.formLabel, { color: theme.textLight }]}>Name *</Text>
                                        <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}>
                                            <Ionicons name="person-outline" size={16} color={theme.textLight} />
                                            <TextInput
                                                style={[styles.input, { color: theme.text }]}
                                                placeholder="Your name"
                                                placeholderTextColor={theme.textLight}
                                                value={form.contact_name}
                                                onChangeText={t => setForm(p => ({ ...p, contact_name: t }))}
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.formCol}>
                                        <Text style={[styles.formLabel, { color: theme.textLight }]}>Phone *</Text>
                                        <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}>
                                            <Ionicons name="call-outline" size={16} color={theme.textLight} />
                                            <TextInput
                                                style={[styles.input, { color: theme.text }]}
                                                placeholder="Mobile number"
                                                placeholderTextColor={theme.textLight}
                                                value={form.contact_mobile}
                                                onChangeText={t => setForm(p => ({ ...p, contact_mobile: t }))}
                                                keyboardType="phone-pad"
                                            />
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.formRow}>
                                    <View style={styles.formCol}>
                                        <Text style={[styles.formLabel, { color: theme.textLight }]}>Email</Text>
                                        <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}>
                                            <Ionicons name="mail-outline" size={16} color={theme.textLight} />
                                            <TextInput
                                                style={[styles.input, { color: theme.text }]}
                                                placeholder="Email address"
                                                placeholderTextColor={theme.textLight}
                                                value={form.contact_email}
                                                onChangeText={t => setForm(p => ({ ...p, contact_email: t }))}
                                                keyboardType="email-address"
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.formCol}>
                                        <Text style={[styles.formLabel, { color: theme.textLight }]}>Event Date</Text>
                                        <TouchableOpacity
                                            style={[styles.inputWrap, styles.dateBtn, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}
                                            onPress={() => setShowDatePicker(true)}
                                        >
                                            <Ionicons name="calendar-outline" size={16} color={theme.textLight} />
                                            <Text style={[styles.dateText, { color: form.event_date ? theme.text : theme.textLight }]}>
                                                {form.event_date ? new Date(form.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date'}
                                            </Text>
                                        </TouchableOpacity>
                                        {showDatePicker && (
                                            <DateTimePicker
                                                value={form.event_date ? new Date(form.event_date) : new Date()}
                                                mode="date"
                                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                minimumDate={new Date()}
                                                onChange={(e, d) => {
                                                    setShowDatePicker(false);
                                                    if (d) setForm(p => ({ ...p, event_date: d.toISOString() }));
                                                }}
                                            />
                                        )}
                                    </View>
                                </View>
                                <View style={styles.formRow}>
                                    <View style={styles.formCol}>
                                        <Text style={[styles.formLabel, { color: theme.textLight }]}>Guest Count</Text>
                                        <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}>
                                            <Ionicons name="people-outline" size={16} color={theme.textLight} />
                                            <TextInput
                                                style={[styles.input, { color: theme.text }]}
                                                placeholder="Number of guests"
                                                placeholderTextColor={theme.textLight}
                                                value={form.guest_count}
                                                onChangeText={t => setForm(p => ({ ...p, guest_count: t }))}
                                                keyboardType="number-pad"
                                            />
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>Event location</Text>
                                    <Text style={[styles.formHint, { color: theme.textLight }]}>
                                        Will the gathering be at your own place or a venue?
                                    </Text>
                                    <View style={styles.roleRow}>
                                        {[
                                            { key: 'own_place', label: 'Own place' },
                                            { key: 'venue', label: 'Venue' },
                                        ].map((opt) => (
                                            <TouchableOpacity
                                                key={opt.key}
                                                style={[
                                                    styles.roleChip,
                                                    {
                                                        backgroundColor: isDarkMode ? '#252840' : '#FFF',
                                                        borderColor: theme.border,
                                                    },
                                                    form.location_kind === opt.key && {
                                                        backgroundColor: colors.primary,
                                                        borderColor: colors.primary,
                                                    },
                                                ]}
                                                onPress={() =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        location_kind: opt.key,
                                                    }))
                                                }
                                            >
                                                <Text
                                                    style={[
                                                        styles.roleText,
                                                        { color: theme.text },
                                                        form.location_kind === opt.key && { color: '#FFF', fontWeight: '700' },
                                                    ]}
                                                >
                                                    {opt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {form.location_kind ? (
                                        <>
                                            <View style={styles.locActionRow}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.locActionBtn,
                                                        { borderColor: theme.border, backgroundColor: isDarkMode ? '#1F2333' : '#FFF' },
                                                    ]}
                                                    onPress={handleEventCurrentLocationPress}
                                                    disabled={eventLocLoading}
                                                >
                                                    {eventLocLoading ? (
                                                        <ActivityIndicator size="small" color={colors.primary} />
                                                    ) : (
                                                        <Ionicons name="navigate" size={18} color={colors.primary} />
                                                    )}
                                                    <Text style={[styles.locActionText, { color: theme.text }]}>
                                                        Use current location
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.locActionBtn,
                                                        { borderColor: theme.border, backgroundColor: isDarkMode ? '#1F2333' : '#FFF' },
                                                    ]}
                                                    onPress={() => setMapPickerVisible(true)}
                                                >
                                                    <Ionicons name="map" size={18} color={colors.primary} />
                                                    <Text style={[styles.locActionText, { color: theme.text }]}>
                                                        Select on map
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                            {form.location_preference ? (
                                                <View style={[styles.locPreview, { borderColor: theme.border, backgroundColor: isDarkMode ? '#1A1D27' : '#F9FAFB' }]}>
                                                    <Ionicons name="location" size={16} color={colors.primary} />
                                                    <Text style={[styles.locPreviewText, { color: theme.text }]} numberOfLines={3}>
                                                        {form.location_preference}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <Text style={[styles.formHint, { color: theme.textLight, marginTop: 6 }]}>
                                                    Pick current GPS or search on the map to set your event address.
                                                </Text>
                                            )}
                                            {form.location_kind === 'venue' && (
                                                <View style={{ marginTop: 10 }}>
                                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>Venue name (optional)</Text>
                                                    <View
                                                        style={[
                                                            styles.inputWrap,
                                                            { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border },
                                                        ]}
                                                    >
                                                        <Ionicons name="business-outline" size={16} color={theme.textLight} />
                                                        <TextInput
                                                            style={[styles.input, { color: theme.text }]}
                                                            placeholder="e.g. Hotel / banquet name"
                                                            placeholderTextColor={theme.textLight}
                                                            value={form.venue_detail}
                                                            onChangeText={(t) => setForm((p) => ({ ...p, venue_detail: t }))}
                                                        />
                                                    </View>
                                                </View>
                                            )}
                                        </>
                                    ) : null}
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>Budget (excl. Gold & Apparels)</Text>
                                    <Text style={[styles.budgetSliderHint, { color: theme.textLight }]}>
                                        Slide between ₹1 Lac and ₹2 Cr, or pick a quick range below.
                                    </Text>
                                    <Text style={[styles.budgetSliderValue, { color: colors.primary }]}>
                                        {formatBudgetInrLabel(plannedBudgetInr)} (₹{Math.round(plannedBudgetInr).toLocaleString('en-IN')})
                                    </Text>
                                    <Slider
                                        style={styles.budgetSlider}
                                        minimumValue={MIN_PLANNED_BUDGET_INR}
                                        maximumValue={MAX_PLANNED_BUDGET_INR}
                                        value={plannedBudgetInr}
                                        onValueChange={(v) => setPlannedBudgetInr(Math.round(v))}
                                        onSlidingComplete={(v) => {
                                            const x = Math.round(v);
                                            setPlannedBudgetInr(x);
                                            setForm(p => ({ ...p, planned_budget: formatBudgetInrLabel(x) }));
                                        }}
                                        minimumTrackTintColor={colors.primary}
                                        maximumTrackTintColor={theme.border}
                                        thumbTintColor={colors.primary}
                                    />
                                    <View style={styles.budgetRow}>
                                        {BUDGET_OPTIONS.map(opt => (
                                            <TouchableOpacity
                                                key={opt}
                                                style={[
                                                    styles.budgetChip,
                                                    { backgroundColor: isDarkMode ? '#252840' : '#FFF', borderColor: theme.border },
                                                    form.planned_budget === opt && { backgroundColor: colors.primary, borderColor: colors.primary },
                                                ]}
                                                onPress={() => {
                                                    const inr = BUDGET_CHIP_TO_INR[opt];
                                                    if (inr) setPlannedBudgetInr(inr);
                                                    setForm(p => ({ ...p, planned_budget: opt }));
                                                }}
                                            >
                                                <Text style={[
                                                    styles.budgetText,
                                                    { color: theme.text },
                                                    form.planned_budget === opt && { color: '#FFF', fontWeight: '700' },
                                                ]}>₹{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.formActions}>
                                    <TouchableOpacity
                                        style={[styles.skipBtn, { borderColor: theme.border }]}
                                        onPress={handleSkipForm}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.skipBtnText, { color: theme.text }]}>Skip & Browse All</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.submitBtn}
                                        onPress={handleFormSubmit}
                                        activeOpacity={0.85}
                                        disabled={formSubmitting}
                                    >
                                        <LinearGradient
                                            colors={[colors.primary, colors.secondary]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.submitBtnGradient}
                                        >
                                            {formSubmitting && <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />}
                                            <Text style={styles.submitBtnText}>Continue</Text>
                                            <Ionicons name="arrow-forward" size={18} color="#FFF" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    )}

                    {/* Category Multi-Select Section - only when form submitted or skipped */}
                    {showCategoriesStep && categoriesLoading && (
                        <View style={[styles.categorySection, { marginHorizontal: 16, marginBottom: 28 }]}>
                            <LinearGradient
                                colors={isDarkMode ? ['#181B25', '#1A1D27'] : ['#FFF8F0', '#FFF3E6']}
                                style={styles.categorySectionBg}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={[styles.categoryTitle, { color: theme.text }]}>What do you need?</Text>
                                <Text style={[styles.categorySubtitle, { color: theme.textLight, marginBottom: 20 }]}>Loading categories...</Text>
                                <View style={styles.categoryLoaderRow}>
                                    {[1, 2, 3, 4].map(i => (
                                        <View key={i} style={[styles.categoryBox, { backgroundColor: isDarkMode ? '#1A1D27' : '#FFFFFF', borderColor: isDarkMode ? '#2D3142' : '#E5E7EB', width: 100 }]}>
                                            <View style={[styles.categoryIconBox, { backgroundColor: isDarkMode ? '#252840' : '#F3F4F6' }]}>
                                                <ActivityIndicator size="small" color={colors.primary} />
                                            </View>
                                            <View style={{ width: 50, height: 10, borderRadius: 5, backgroundColor: isDarkMode ? '#2D3142' : '#E5E7EB' }} />
                                        </View>
                                    ))}
                                </View>
                            </LinearGradient>
                        </View>
                    )}
                    {showCategoriesStep && !categoriesLoading && categories.length > 0 && (
                        <Animated.View style={[
                            styles.categorySection,
                            {
                                opacity: categoryAnim,
                                transform: [{ translateY: categoryAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                            },
                        ]}>
                            <LinearGradient
                                colors={isDarkMode ? ['#181B25', '#1A1D27'] : ['#FFF8F0', '#FFF3E6']}
                                style={styles.categorySectionBg}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.categoryHeaderRow}>
                                    <View>
                                        <Text style={[styles.categoryTitle, { color: theme.text }]}>
                                            What do you need?
                                        </Text>
                                        <Text style={[styles.categorySubtitle, { color: theme.textLight }]}>
                                            Select one or more categories for {selectedOccasionObj?.name || 'your event'}
                                        </Text>
                                    </View>
                                    {selectedCategories.size > 0 && (
                                        <View style={[styles.selectedCountBadge, { backgroundColor: colors.primary }]}>
                                            <Text style={styles.selectedCountText}>{selectedCategories.size}</Text>
                                        </View>
                                    )}
                                </View>

                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.categoryScrollContent}
                                >
                                    {categories.map((cat, idx) => {
                                        const catColor = catColors[idx % catColors.length];
                                        const isSelected = selectedCategories.has(cat.id);
                                        return (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[
                                                    styles.categoryBox,
                                                    { backgroundColor: isDarkMode ? '#1A1D27' : '#FFFFFF', borderColor: isDarkMode ? '#2D3142' : '#E5E7EB' },
                                                    isSelected && { borderColor: catColor, borderWidth: 2, backgroundColor: catColor + '08' },
                                                ]}
                                                onPress={() => toggleCategory(cat)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[styles.categoryIconBox, { backgroundColor: catColor + '18' }]}>
                                                    {(cat.icon_url || cat.image_url) ? (
                                                        <Image source={{ uri: cat.icon_url || cat.image_url }} style={styles.categoryBoxImg} resizeMode="cover" />
                                                    ) : (
                                                        <Text style={styles.categoryBoxEmoji}>{cat.icon || '📂'}</Text>
                                                    )}
                                                </View>
                                                <Text style={[
                                                    styles.categoryBoxLabel,
                                                    { color: theme.text },
                                                    isSelected && { color: catColor, fontWeight: '700' },
                                                ]} numberOfLines={2}>{cat.name}</Text>
                                                <View style={[
                                                    styles.categoryCheckbox,
                                                    { borderColor: isSelected ? catColor : (isDarkMode ? '#4B5563' : '#D1D5DB') },
                                                    isSelected && { backgroundColor: catColor, borderColor: catColor },
                                                ]}>
                                                    {isSelected && <Ionicons name="checkmark" size={12} color="#FFF" />}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                {selectedCategories.size > 0 && (
                                    <TouchableOpacity
                                        style={styles.exploreBtn}
                                        onPress={handleExploreServices}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={[colors.primary, colors.secondary]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.exploreBtnGradient}
                                        >
                                            <Text style={styles.exploreBtnText}>
                                                Explore {selectedCategories.size} {selectedCategories.size === 1 ? 'Category' : 'Categories'}
                                            </Text>
                                            <Ionicons name="arrow-forward" size={20} color="#FFF" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </LinearGradient>
                        </Animated.View>
                    )}

                    {/* Help & Contact Us */}
                    <View style={[styles.helpSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.helpTitle, { color: theme.text }]}>Need Help?</Text>
                        <Text style={[styles.helpSubtitle, { color: theme.textLight }]}>We're here to assist you with your event planning</Text>
                        <View style={styles.helpButtons}>
                            <TouchableOpacity
                                style={[styles.helpBtn, { backgroundColor: colors.primary + '10' }]}
                                onPress={() => navigation.navigate('HelpSupport')}
                            >
                                <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
                                <Text style={[styles.helpBtnText, { color: colors.primary }]}>Help & FAQ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.helpBtn, { backgroundColor: '#25D366' + '15' }]}
                                onPress={() => Linking.openURL('https://wa.me/919876543210')}
                            >
                                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                                <Text style={[styles.helpBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.helpBtn, { backgroundColor: '#3B82F6' + '12' }]}
                                onPress={() => Linking.openURL('tel:+919876543210')}
                            >
                                <Ionicons name="call-outline" size={22} color="#3B82F6" />
                                <Text style={[styles.helpBtnText, { color: '#3B82F6' }]}>Call Us</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Guest Manager */}
                    <TouchableOpacity
                        style={[styles.guestManagerCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => navigation.navigate('GuestManage')}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={isDarkMode ? ['#181B25', '#1A1D27'] : ['#EEF2FF', '#E8EDFF']}
                            style={styles.guestManagerGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.guestManagerContent}>
                                <View style={[styles.guestManagerIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
                                    <Ionicons name="people" size={26} color="#8B5CF6" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.guestManagerTitle, { color: theme.text }]}>Guest Manager</Text>
                                    <Text style={[styles.guestManagerDesc, { color: theme.textLight }]}>
                                        Manage guest lists, track gifts & send digital invitations
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={22} color={theme.textLight} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {testimonials.length > 0 ? (
                        <View style={[styles.testimonialsSection, { borderColor: theme.border, backgroundColor: theme.card }]}>
                            <View style={styles.testimonialsHeader}>
                                <Text style={[styles.testimonialsKicker, { color: colors.primary }]}>Real celebrations</Text>
                                <Text style={[styles.testimonialsTitle, { color: theme.text }]}>Stories that inspire us</Text>
                                <Text style={[styles.testimonialsSubtitle, { color: theme.textLight }]}>
                                    Families who planned with Ekatraa
                                </Text>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.testimonialsScroll}
                                decelerationRate="fast"
                                snapToInterval={width * 0.86}
                            >
                                {testimonials.map((t) => (
                                    <LinearGradient
                                        key={t.id}
                                        colors={isDarkMode ? ['#1e293b', '#0f172a'] : ['#FFFFFF', '#FFF8F0']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={[
                                            styles.testimonialCard,
                                            { borderColor: isDarkMode ? '#334155' : colors.primary + '35' },
                                        ]}
                                    >
                                        <View style={styles.testimonialTop}>
                                            {t.image_url ? (
                                                <Image source={{ uri: t.image_url }} style={styles.testimonialImg} />
                                            ) : (
                                                <LinearGradient
                                                    colors={[colors.primary, colors.secondary]}
                                                    style={styles.testimonialAvatar}
                                                >
                                                    <Text style={styles.testimonialAvatarText}>
                                                        {(t.display_name || '?').charAt(0).toUpperCase()}
                                                    </Text>
                                                </LinearGradient>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.testimonialName, { color: theme.text }]} numberOfLines={1}>
                                                    {t.display_name}
                                                </Text>
                                                <View style={styles.testimonialActions}>
                                                    {t.video_url ? (
                                                        <TouchableOpacity
                                                            style={styles.tMiniBtn}
                                                            onPress={() => Linking.openURL(t.video_url)}
                                                        >
                                                            <Ionicons name="logo-youtube" size={16} color="#EF4444" />
                                                            <Text
                                                                style={[
                                                                    styles.tMiniBtnText,
                                                                    { color: isDarkMode ? '#FECACA' : '#5B21B6' },
                                                                ]}
                                                            >
                                                                Video
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ) : null}
                                                    {t.voice_recording_url ? (
                                                        <TouchableOpacity
                                                            style={styles.tMiniBtn}
                                                            onPress={() => Linking.openURL(t.voice_recording_url)}
                                                        >
                                                            <Ionicons name="mic" size={16} color={colors.primary} />
                                                            <Text
                                                                style={[
                                                                    styles.tMiniBtnText,
                                                                    { color: isDarkMode ? '#C4B5FD' : '#5B21B6' },
                                                                ]}
                                                            >
                                                                Voice
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ) : null}
                                                </View>
                                            </View>
                                        </View>
                                        {t.testimonial_text ? (
                                            <Text style={[styles.testimonialQuote, { color: theme.text }]}>"{t.testimonial_text}"</Text>
                                        ) : null}
                                    </LinearGradient>
                                ))}
                            </ScrollView>
                        </View>
                    ) : null}

                    <View style={{ height: 80 }} />
                </ScrollView>
            </AnimatedBackground>

            <ChatModal
                visible={chatModalVisible}
                onClose={() => setChatModalVisible(false)}
                city={currentCity}
                occasionId={selectedType}
                occasionName={selectedOccasionObj?.name}
                plannedBudgetInr={plannedBudgetInr}
            />

            <LocationMapPickerModal
                visible={mapPickerVisible}
                onClose={() => setMapPickerVisible(false)}
                onConfirm={({ address }) => {
                    setForm((p) => ({ ...p, location_preference: address || p.location_preference }));
                }}
            />

            <RecommendationBudgetModal
                visible={recommendationsModalVisible}
                onClose={(result) => {
                    setRecommendationsModalVisible(false);
                    setFormSubmitted(true);
                    if (result === 'explore') {
                        const cats = recommendationsData?.categories || [];
                        navigation.navigate('CategoryServices', {
                            categoryIds: cats.map((c) => c.id),
                            categoryNames: cats.map((c) => c.name),
                            occasionId: selectedType,
                            occasionName: selectedOccasionObj?.name,
                            cartId,
                        });
                    } else if (result === 'cart') {
                        navigation.navigate('Cart');
                    }
                }}
                theme={theme}
                colors={colors}
                city={currentCity}
                occasionId={selectedType}
                occasionName={selectedOccasionObj?.name}
                data={recommendationsData}
                setData={setRecommendationsData}
                fetchRecommendationPage={(inr, weights) =>
                    api.getRecommendations(selectedType, {
                        budget_inr: inr,
                        budget: formatBudgetInrLabel(inr),
                        category_weights: weights,
                    })
                }
                cartId={cartId}
                setCartId={setCartId}
                isAuthenticated={isAuthenticated}
                user={user}
                navigation={navigation}
                refreshCartCount={refreshGlobalCartCount}
                formSnapshot={recommendationFormSnapshot}
            />

            <BottomTabBar
                navigation={navigation}
                activeRoute="Home"
                cartItemCount={cartItemCount}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    logoWrap: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    locationLabel: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '600' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    locationValue: { fontSize: 15, fontWeight: '700' },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIconBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    cartBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    cartBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
    },
    section: { marginBottom: 28 },
    sectionTitleRow: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    sectionSubtitle: {
        fontSize: 13,
        marginTop: 3,
    },
    occasionRowSingle: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: OCCASION_CARD_GAP,
    },
    occasionCardSingle: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 18,
        borderWidth: 1.5,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    occasionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: OCCASION_CARD_GAP,
    },
    occasionGridExpanded: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: OCCASION_CARD_GAP,
        marginTop: 12,
    },
    occasionCard: {
        width: OCCASION_CARD_WIDTH,
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 10,
        borderRadius: 18,
        borderWidth: 1.5,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    othersCard: {
        borderStyle: 'dashed',
    },
    occasionCardCompact: {
        width: OCCASION_CARD_WIDTH,
    },
    occasionCardCompact3Col: {
        width: OCCASION_CARD_WIDTH_3COL,
    },
    occasionIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    occasionIconImg: { width: 38, height: 38, borderRadius: 12 },
    occasionEmoji: { fontSize: 28 },
    occasionLabel: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
    occasionCheck: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Category multi-select section
    categorySection: {
        marginHorizontal: 16,
        marginBottom: 28,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
    },
    categorySectionBg: {
        padding: 20,
        borderRadius: 20,
    },
    categoryHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
    },
    categoryTitle: {
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    categorySubtitle: {
        fontSize: 13,
        marginTop: 4,
    },
    selectedCountBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedCountText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
    },
    categoryScrollContent: {
        paddingRight: 8,
        gap: 10,
    },
    categoryBox: {
        width: 110,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 16,
        borderWidth: 1.5,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    categoryIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    categoryBoxImg: { width: 28, height: 28, borderRadius: 8 },
    categoryBoxEmoji: { fontSize: 22 },
    categoryBoxLabel: {
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 15,
        textAlign: 'center',
        marginBottom: 8,
    },
    categoryCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exploreBtn: {
        marginTop: 20,
        borderRadius: 14,
        overflow: 'hidden',
    },
    exploreBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        paddingHorizontal: 24,
        gap: 8,
    },
    exploreBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingTop: 12,
        maxHeight: '70%',
    },
    pickerHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CCC',
        alignSelf: 'center',
        marginBottom: 16,
    },
    pickerTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 16,
    },
    pickerScroll: { maxHeight: 400 },
    pickerScrollContent: { paddingBottom: 20 },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        gap: 12,
    },
    pickerItemText: { flex: 1, fontSize: 16, fontWeight: '500' },
    bannerSection: { marginBottom: 24 },
    bannerList: { paddingHorizontal: 20 },
    bannerCard: {
        width: width - 40,
        height: 170,
        borderRadius: 20,
        overflow: 'hidden',
        marginRight: 12,
    },
    bannerBentoWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: BANNER_EDGE_PAD,
        gap: BANNER_TILE_GAP,
        justifyContent: 'flex-start',
    },
    bannerBentoTile: {
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#111',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
    },
    bannerImage: { width: '100%', height: '100%' },
    bannerOverlayFill: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        padding: 14,
    },
    bannerDiscountPill: {
        position: 'absolute',
        top: 12,
        right: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        maxWidth: '70%',
    },
    bannerDiscountPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    bannerTextBlock: { justifyContent: 'flex-end' },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    bannerBentoTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 3,
        lineHeight: 20,
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    bannerBentoSubtitle: { color: 'rgba(255,255,255,0.92)', fontSize: 12, lineHeight: 16 },
    bannerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },

    aiChatBar: {
        marginHorizontal: 20,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiPlaceholder: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    categoryLoaderRow: {
        flexDirection: 'row',
        gap: 10,
    },
    formSection: {
        marginHorizontal: 16,
        marginBottom: 24,
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
    },
    formSectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    formSectionSubtitle: {
        fontSize: 13,
        marginBottom: 18,
    },
    formGroup: { marginBottom: 14 },
    formLabel: { fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
    formHint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
    locActionRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 8 },
    locActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    locActionText: { fontSize: 13, fontWeight: '700' },
    locPreview: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 4,
    },
    locPreviewText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    formCol: { flex: 1 },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        gap: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 14,
    },
    dateBtn: { justifyContent: 'center' },
    dateText: { flex: 1, paddingVertical: 10, fontSize: 14 },
    recModalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingTop: 12,
        justifyContent: 'flex-start',
    },
    recModalScroll: { flex: 1 },
    recModalScrollContent: { paddingBottom: 24 },
    recModalActions: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 16,
        marginTop: 12,
        borderTopWidth: 1,
    },
    recCatBlock: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    recCatName: { fontSize: 16, fontWeight: '700' },
    recCatBudget: { fontSize: 12, fontWeight: '600' },
    recNearestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
    },
    recNearestLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    recNearestName: { fontSize: 14, fontWeight: '600' },
    recNearestPrice: { fontSize: 13, fontWeight: '700', marginTop: 4 },
    recRestServices: { marginTop: 4, marginLeft: 8 },
    recSvcRow: { paddingVertical: 6 },
    recSvcName: { fontSize: 13 },
    roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    roleChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1.5,
    },
    roleText: { fontSize: 13, fontWeight: '600' },
    budgetSliderHint: { fontSize: 12, marginBottom: 6, lineHeight: 17 },
    budgetSliderValue: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
    budgetSlider: { width: '100%', height: 40, marginBottom: 12 },
    budgetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    budgetChip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    budgetText: { fontSize: 12, fontWeight: '600' },
    formActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    skipBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipBtnText: { fontSize: 15, fontWeight: '700' },
    submitBtn: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
    },
    submitBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 8,
    },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    helpSection: {
        marginHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 16,
    },
    helpTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    helpSubtitle: {
        fontSize: 13,
        marginBottom: 16,
    },
    helpButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    helpBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 6,
    },
    helpBtnText: {
        fontSize: 11,
        fontWeight: '700',
    },
    guestManagerCard: {
        marginHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
    },
    guestManagerGradient: {
        borderRadius: 20,
    },
    guestManagerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        gap: 14,
    },
    guestManagerIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    guestManagerTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 3,
    },
    guestManagerDesc: {
        fontSize: 12,
        lineHeight: 17,
    },
    specialSkipWrap: {
        marginHorizontal: 16,
        marginBottom: 14,
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
    },
    specialSkipGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 12,
    },
    specialSkipIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    specialSkipTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    specialSkipSub: {
        color: 'rgba(255,255,255,0.88)',
        fontSize: 11,
        lineHeight: 15,
        marginTop: 3,
    },
    testimonialsSection: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 22,
        borderWidth: 1,
        paddingBottom: 18,
        overflow: 'hidden',
    },
    testimonialsHeader: {
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 12,
    },
    testimonialsKicker: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    testimonialsTitle: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    testimonialsSubtitle: {
        fontSize: 13,
        marginTop: 4,
    },
    testimonialsScroll: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 12,
    },
    testimonialCard: {
        width: width * 0.82,
        borderRadius: 20,
        borderWidth: 1,
        padding: 18,
        marginRight: 12,
    },
    testimonialTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },
    testimonialImg: {
        width: 56,
        height: 56,
        borderRadius: 16,
    },
    testimonialAvatar: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    testimonialAvatarText: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '800',
    },
    testimonialName: {
        fontSize: 16,
        fontWeight: '700',
    },
    testimonialActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 6,
    },
    tMiniBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(124,58,237,0.12)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    tMiniBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#5B21B6',
    },
    testimonialQuote: {
        fontSize: 14,
        lineHeight: 22,
        fontStyle: 'italic',
        opacity: 0.95,
    },
});
