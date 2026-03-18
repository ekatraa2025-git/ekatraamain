import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image,
    TouchableOpacity, TextInput, Alert, ActivityIndicator,
    Dimensions, Animated, LayoutAnimation, Platform,
    Modal, Linking, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api, useBackendApi } from '../../services/api';
import { supabase, resolveStorageUrl } from '../../services/supabase';
import { useCart } from '../../context/CartContext';
import BottomTabBar from '../../components/BottomTabBar';


const { width } = Dimensions.get('window');
const TIER_KEYS = ['price_basic', 'price_classic_value', 'price_signature', 'price_prestige', 'price_royal', 'price_imperial'];
const TIER_LABELS = ['Basic', 'Classic Value', 'Signature', 'Prestige', 'Royal', 'Imperial'];
const TIER_QTY_KEYS = ['qty_label_basic', 'qty_label_classic_value', 'qty_label_signature', 'qty_label_prestige', 'qty_label_royal', 'qty_label_imperial'];
const TIER_GUESTS_DEFAULT = ['Upto 100', 'Upto 300', 'Upto 500', '500-1000', '1000+', '1500+'];
const TIER_COLORS = ['#10B981', '#3B82F6', '#FF7A00', '#8B5CF6', '#F59E0B', '#EC4899'];
const BUDGET_OPTIONS = [
    '6-10 Lakhs', '11-15 Lakhs', '16-20 Lakhs',
    '21-30 Lakhs', '30 Lakhs+', '50 Lakhs+',
];
const SECTION_COLORS = ['#FF7A00', '#1E3A8A', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#14B8A6'];

// Check if Google Maps API key is configured (prevents crash on Android production)
const hasMapsApiKey = !!(
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  Constants.expoConfig?.ios?.config?.googleMapsApiKey
);

export default function CategoryServices({ route, navigation }) {
    const { theme, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const { isAuthenticated, user } = useAuth();
    const { cartId: globalCartId, setCartId: setGlobalCartId, refreshCartCount } = useCart();

    const {
        categoryIds = [],
        categoryNames = [],
        categoryId: singleCategoryId,
        categoryName: singleCategoryName,
        occasionId, occasionName,
    } = route.params || {};

    const resolvedCategoryIds = categoryIds.length > 0
        ? categoryIds
        : singleCategoryId ? [singleCategoryId] : [];
    const resolvedCategoryNames = categoryNames.length > 0
        ? categoryNames
        : singleCategoryName ? [singleCategoryName] : [];

    const [servicesByCategory, setServicesByCategory] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedServices, setSelectedServices] = useState(new Map());
    const [cartId, setCartId] = useState(globalCartId || null);
    const [adding, setAdding] = useState(false);
    const [formVisible, setFormVisible] = useState(false);
    const [expandedServiceId, setExpandedServiceId] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showLocationMapModal, setShowLocationMapModal] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [mapRegion, setMapRegion] = useState({ latitude: 20.2961, longitude: 85.8245, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    const [mapMarkerCoord, setMapMarkerCoord] = useState(null);
    const [mapSearchQuery, setMapSearchQuery] = useState('');
    const [mapSearchLoading, setMapSearchLoading] = useState(false);
    const [mapReady, setMapReady] = useState(false);

    const [form, setForm] = useState({
        role: '',
        contact_name: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
        contact_mobile: user?.phone || '',
        contact_email: user?.email || '',
        event_date: '',
        guest_count: '',
        location_preference: '',
        venue_preference: '',
        planned_budget: '',
    });

    const formAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchAllServices();
    }, []);

    useEffect(() => {
        Animated.timing(formAnim, {
            toValue: formVisible ? 1 : 0,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [formVisible]);

    const useApi = useBackendApi();

    const fetchServicesForCategory = async (catId) => {
        if (useApi) {
            const { data } = await api.getServices({ occasion_id: occasionId, category_id: catId });
            if (Array.isArray(data) && data.length > 0) return data;
            const { data: d2 } = await api.getServices({ category_id: catId });
            if (Array.isArray(d2) && d2.length > 0) return d2;
        }
        try {
            let query = supabase
                .from('offerable_services')
                .select('id, category_id, name, description, image_url, display_order, price_min, price_max, price_unit, price_basic, price_classic_value, price_signature, price_prestige, price_royal, price_imperial, qty_label_basic, qty_label_classic_value, qty_label_signature, qty_label_prestige, qty_label_royal, qty_label_imperial, tag_new, tag_most_booked, city')
                .eq('is_active', true)
                .eq('category_id', catId)
                .order('display_order', { ascending: true });
            const { data: sbData } = await query;
            if (Array.isArray(sbData) && sbData.length > 0) return sbData;
        } catch (e) {
            console.log('[SB fallback error]', e);
        }
        return [];
    };

    const fetchAllServices = async () => {
        setLoading(true);
        const results = {};
        const fetches = resolvedCategoryIds.map(async (catId, i) => {
            const catName = resolvedCategoryNames[i] || `Category ${i + 1}`;
            const rawServices = await fetchServicesForCategory(catId);
            const services = await Promise.all(rawServices.map(async (svc) => ({
                ...svc,
                image_url: await resolveStorageUrl(svc.image_url),
            })));
            return { catId, catName, services };
        });
        const allResults = await Promise.all(fetches);
        for (const { catId, catName, services } of allResults) {
            results[catId] = { name: catName, services };
        }
        setServicesByCategory(results);
        setLoading(false);
    };

    const getServiceTierPrices = (item) => {
        const out = [];
        TIER_KEYS.forEach((key, i) => {
            const v = item[key];
            if (v != null && v !== '') {
                const qtyLabel = item[TIER_QTY_KEYS[i]] || TIER_GUESTS_DEFAULT[i];
                out.push({ label: TIER_LABELS[i], value: Number(v), key, guests: qtyLabel, color: TIER_COLORS[i] });
            }
        });
        return out;
    };

    const toggleService = (service) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedServices(prev => {
            const next = new Map(prev);
            if (next.has(service.id)) {
                next.delete(service.id);
                if (expandedServiceId === service.id) setExpandedServiceId(null);
            } else {
                const tiers = getServiceTierPrices(service);
                next.set(service.id, {
                    service,
                    selectedTier: tiers.length > 0 ? tiers[0].key : null,
                    price: tiers.length > 0 ? tiers[0].value : 0,
                });
                setExpandedServiceId(service.id);
                if (!formVisible) setFormVisible(true);
            }
            return next;
        });
    };

    const selectTier = (serviceId, tierKey, tierPrice) => {
        setSelectedServices(prev => {
            const next = new Map(prev);
            const entry = next.get(serviceId);
            if (entry) {
                next.set(serviceId, { ...entry, selectedTier: tierKey, price: tierPrice });
            }
            return next;
        });
    };

    const handleAddToCart = async () => {
        if (selectedServices.size === 0) {
            Alert.alert('Select Services', 'Please select at least one service.');
            return;
        }
        if (!form.contact_name.trim() || !form.contact_mobile.trim()) {
            if (!formVisible) {
                setFormVisible(true);
                Alert.alert('Fill Your Details', 'Please provide your name and mobile number to continue.');
                return;
            }
            Alert.alert('Required', 'Please fill in your name and mobile number.');
            return;
        }

        setAdding(true);
        let cid = cartId;
        if (!cid) {
            const { data: cartData, error: cartErr } = await api.createCart({
                session_id: 'app-' + Date.now(),
                user_id: isAuthenticated && user?.id ? user.id : null,
            });
            if (cartErr) {
                Alert.alert('Error', cartErr.message);
                setAdding(false);
                return;
            }
            cid = cartData?.id;
            if (cid) {
                setCartId(cid);
                setGlobalCartId(cid);
            }
        }
        if (!cid) { setAdding(false); return; }

        const cartPayload = {
            contact_name: form.contact_name || null,
            contact_mobile: form.contact_mobile || null,
            contact_email: form.contact_email || null,
            event_date: form.event_date || null,
            guest_count: form.guest_count ? parseInt(form.guest_count, 10) : null,
            location_preference: form.location_preference || null,
            venue_preference: form.venue_preference || null,
            planned_budget: form.planned_budget || null,
        };
        await api.updateCart(cid, cartPayload);

        for (const [, entry] of selectedServices) {
            await api.addCartItem({
                cart_id: cid,
                service_id: entry.service.id,
                quantity: 1,
                unit_price: entry.price || 0,
                options: {
                    tier: entry.selectedTier,
                    occasion: occasionName,
                    category: resolvedCategoryNames.join(', '),
                    role: form.role,
                },
            });
        }

        setAdding(false);
        refreshCartCount(cid);
        Alert.alert(
            'Added to Cart',
            `${selectedServices.size} service(s) added successfully!`,
            [
                { text: 'Continue Shopping', onPress: () => navigation.goBack() },
                { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
            ]
        );
    };

    const totalAmount = Array.from(selectedServices.values()).reduce((sum, e) => sum + (e.price || 0), 0);
    const allServices = Object.values(servicesByCategory).flatMap(cat => cat.services);
    const handleMapSearch = async () => {
        if (!mapSearchQuery.trim()) return;
        setMapSearchLoading(true);
        try {
            const [res] = await Location.geocodeAsync(mapSearchQuery.trim());
            if (res) {
                const { latitude, longitude } = res;
                setMapRegion(r => ({ ...r, latitude, longitude }));
                setMapMarkerCoord({ latitude, longitude });
                const [rev] = await Location.reverseGeocodeAsync({ latitude, longitude });
                const addr = rev ? [rev.name, rev.street, rev.city, rev.subregion, rev.region].filter(Boolean).join(', ') : mapSearchQuery.trim();
                setForm(p => ({ ...p, location_preference: addr }));
            } else {
                Alert.alert('Not found', 'Could not find that location. Try a different search.');
            }
        } catch (_) {
            Alert.alert('Error', 'Could not search location. Please try again.');
        } finally {
            setMapSearchLoading(false);
        }
    };

    const headerTitle = resolvedCategoryNames.length === 1
        ? resolvedCategoryNames[0]
        : `${resolvedCategoryNames.length} Categories`;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <View style={[styles.backBtnCircle, { backgroundColor: isDarkMode ? '#2D3142' : '#F3F4F6' }]}>
                        <Ionicons name="arrow-back" size={20} color={theme.text} />
                    </View>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                        {headerTitle || 'Services'}
                    </Text>
                    {occasionName && (
                        <View style={styles.headerTagRow}>
                            <View style={[styles.headerTag, { backgroundColor: colors.primary + '12' }]}>
                                <Text style={[styles.headerTagText, { color: colors.primary }]}>{occasionName}</Text>
                            </View>
                        </View>
                    )}
                </View>
                {selectedServices.size > 0 && (
                    <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="cart" size={14} color="#FFF" />
                        <Text style={styles.headerBadgeText}>{selectedServices.size}</Text>
                    </View>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <View style={[styles.loadingSpinner, { borderColor: colors.primary + '30' }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                    <Text style={[styles.loadingText, { color: theme.textLight }]}>Loading services...</Text>
                </View>
            ) : allServices.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <View style={[styles.emptyIcon, { backgroundColor: isDarkMode ? '#1A1D27' : '#FFF8F0' }]}>
                        <Ionicons name="search-outline" size={40} color={colors.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No services available</Text>
                    <Text style={[styles.emptyDesc, { color: theme.textLight }]}>
                        We haven't added services for this selection yet. Check back soon!
                    </Text>
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
                        <LinearGradient colors={[colors.primary, '#FFA040']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtnGradient}>
                            <Ionicons name="arrow-back" size={18} color="#FFF" />
                            <Text style={styles.emptyBtnText}>Go Back</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    >
                        {/* Your Details - Elegant collapsible */}
                        <TouchableOpacity
                            style={[
                                styles.detailsToggle,
                                { backgroundColor: isDarkMode ? theme.card : '#FFF', borderColor: formVisible ? colors.primary : theme.border },
                                formVisible && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
                            ]}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setFormVisible(!formVisible);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.detailsToggleLeft}>
                                <LinearGradient
                                    colors={[colors.primary + '20', colors.primary + '08']}
                                    style={styles.detailsIconWrap}
                                >
                                    <Ionicons name="person-outline" size={18} color={colors.primary} />
                                </LinearGradient>
                                <View>
                                    <Text style={[styles.detailsToggleTitle, { color: theme.text }]}>Your Event Details</Text>
                                    <Text style={[styles.detailsToggleHint, { color: theme.textLight }]}>
                                        {form.contact_name ? `${form.contact_name}${form.event_date ? ` · ${form.event_date}` : ''}` : 'Required before adding to cart'}
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.chevronWrap, { backgroundColor: isDarkMode ? '#2D3142' : '#F3F4F6' }]}>
                                <Ionicons name={formVisible ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textLight} />
                            </View>
                        </TouchableOpacity>

                        {formVisible && (
                            <Animated.View style={[
                                styles.formCard,
                                { backgroundColor: isDarkMode ? theme.card : '#FAFAFA', borderColor: colors.primary + '30' },
                            ]}>
                                {/* Role */}
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

                                {/* Name + Phone row */}
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

                                {/* Email + Date row */}
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
                                            style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}
                                            onPress={() => setShowDatePicker(true)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="calendar-outline" size={16} color={theme.textLight} />
                                            <Text style={[styles.input, { color: form.event_date ? theme.text : theme.textLight, paddingVertical: 10 }]}>
                                                {form.event_date || 'Select date'}
                                            </Text>
                                        </TouchableOpacity>
                                        {showDatePicker && (
                                            <DateTimePicker
                                                value={form.event_date ? new Date(form.event_date) : new Date()}
                                                mode="date"
                                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                minimumDate={new Date()}
                                                onChange={(event, selectedDate) => {
                                                    setShowDatePicker(Platform.OS === 'ios');
                                                    if (selectedDate) {
                                                        const y = selectedDate.getFullYear();
                                                        const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                                        const d = String(selectedDate.getDate()).padStart(2, '0');
                                                        setForm(p => ({ ...p, event_date: `${y}-${m}-${d}` }));
                                                    }
                                                }}
                                            />
                                        )}
                                    </View>
                                </View>

                                {/* Guests */}
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>Guests</Text>
                                    <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}>
                                        <Ionicons name="people-outline" size={16} color={theme.textLight} />
                                        <TextInput
                                            style={[styles.input, { color: theme.text }]}
                                            placeholder="Count"
                                            placeholderTextColor={theme.textLight}
                                            value={form.guest_count}
                                            onChangeText={t => setForm(p => ({ ...p, guest_count: t }))}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                </View>

                                {/* Venue Preference */}
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>Venue</Text>
                                    <View style={styles.roleRow}>
                                        {['Venue', 'Own Place'].map(opt => (
                                            <TouchableOpacity
                                                key={opt}
                                                style={[
                                                    styles.roleChip,
                                                    { backgroundColor: isDarkMode ? '#252840' : '#FFF', borderColor: theme.border },
                                                    form.venue_preference === opt && { backgroundColor: colors.primary, borderColor: colors.primary },
                                                ]}
                                                onPress={() => setForm(p => ({ ...p, venue_preference: opt }))}
                                            >
                                                <Text style={[
                                                    styles.roleText,
                                                    { color: theme.text },
                                                    form.venue_preference === opt && { color: '#FFF', fontWeight: '700' },
                                                ]}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Location - Current Location / Select on Map */}
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>Location</Text>
                                    <View style={styles.locationBtnRow}>
                                        <TouchableOpacity
                                            style={[styles.locationActionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
                                            onPress={async () => {
                                                setLocationLoading(true);
                                                try {
                                                    const { status } = await Location.requestForegroundPermissionsAsync();
                                                    if (status !== 'granted') {
                                                        Alert.alert('Permission', 'Please allow location access.');
                                                        return;
                                                    }
                                                    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                                                    const [rev] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                                                    const addr = rev ? [rev.city, rev.subregion, rev.region].filter(Boolean).join(', ') : `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
                                                    setForm(p => ({ ...p, location_preference: addr }));
                                                } catch (e) {
                                                    Alert.alert('Error', 'Could not get location. Please try again.');
                                                } finally {
                                                    setLocationLoading(false);
                                                }
                                            }}
                                            disabled={locationLoading}
                                        >
                                            {locationLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate" size={18} color={colors.primary} />}
                                            <Text style={[styles.locationActionText, { color: colors.primary }]}>Current</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.locationActionBtn, { backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5', borderColor: theme.border }]}
                                            onPress={async () => {
                                                setMapReady(false);
                                                try {
                                                    const { status } = await Location.requestForegroundPermissionsAsync();
                                                    if (status === 'granted') {
                                                        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                                                        setMapRegion(r => ({ ...r, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                                                    }
                                                } catch (_) {}
                                                setShowLocationMapModal(true);
                                            }}
                                        >
                                            <Ionicons name="map-outline" size={18} color={theme.text} />
                                            <Text style={[styles.locationActionText, { color: theme.text }]}>Select on Map</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border, marginTop: 8 }]}>
                                        <Ionicons name="location-outline" size={16} color={theme.textLight} />
                                        <TextInput
                                            style={[styles.input, { color: theme.text }]}
                                            placeholder={form.venue_preference === 'Own Place' ? 'Your venue address' : 'Preferred area or address'}
                                            placeholderTextColor={theme.textLight}
                                            value={form.location_preference}
                                            onChangeText={t => setForm(p => ({ ...p, location_preference: t }))}
                                        />
                                    </View>
                                </View>

                                {/* Location Map Modal */}
                                <Modal visible={showLocationMapModal} animationType="slide" transparent>
                                    <View style={styles.mapModalOverlay}>
                                        <View style={[styles.mapModalContent, { backgroundColor: theme.card }]}>
                                            <View style={styles.mapModalHeader}>
                                                <Text style={[styles.mapModalTitle, { color: theme.text }]}>Select Location</Text>
                                                <TouchableOpacity onPress={() => { setShowLocationMapModal(false); setMapSearchQuery(''); setMapMarkerCoord(null); setMapReady(false); }}>
                                                    <Ionicons name="close" size={24} color={theme.text} />
                                                </TouchableOpacity>
                                            </View>
                                            <View style={[styles.mapSearchWrap, { backgroundColor: isDarkMode ? '#1F2333' : '#FFF', borderColor: theme.border }]}>
                                                <Ionicons name="search-outline" size={18} color={theme.textLight} />
                                                <TextInput
                                                    style={[styles.mapSearchInput, { color: theme.text }]}
                                                    placeholder="Search location..."
                                                    placeholderTextColor={theme.textLight}
                                                    value={mapSearchQuery}
                                                    onChangeText={setMapSearchQuery}
                                                    onSubmitEditing={handleMapSearch}
                                                    returnKeyType="search"
                                                />
                                                {mapSearchLoading ? (
                                                    <ActivityIndicator size="small" color={colors.primary} />
                                                ) : (
                                                    <TouchableOpacity onPress={handleMapSearch} style={styles.mapSearchBtn}>
                                                        <Ionicons name="search" size={20} color={colors.primary} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            <View style={styles.mapContainer}>
                                            {hasMapsApiKey ? (
                                            <MapView
                                                style={styles.mapView}
                                                provider={PROVIDER_GOOGLE}
                                                initialRegion={mapRegion}
                                                region={mapRegion}
                                                onMapReady={() => setMapReady(true)}
                                                onRegionChangeComplete={setMapRegion}
                                                loadingEnabled
                                                onPress={(e) => {
                                                    const { latitude, longitude } = e.nativeEvent.coordinate;
                                                    setMapRegion(r => ({ ...r, latitude, longitude }));
                                                    setMapMarkerCoord({ latitude, longitude });
                                                    (async () => {
                                                        try {
                                                            const [rev] = await Location.reverseGeocodeAsync({ latitude, longitude });
                                                            const addr = rev ? [rev.name, rev.street, rev.city, rev.subregion, rev.region].filter(Boolean).join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                                                            setForm(p => ({ ...p, location_preference: addr }));
                                                        } catch (_) {
                                                            setForm(p => ({ ...p, location_preference: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
                                                        }
                                                    })();
                                                }}
                                            >
                                                {mapMarkerCoord && (
                                                    <Marker coordinate={mapMarkerCoord} />
                                                )}
                                            </MapView>
                                            ) : (
                                                <View style={[styles.mapView, styles.mapFallback, { backgroundColor: isDarkMode ? '#1F2333' : '#F5F5F5' }]}>
                                                    <Ionicons name="map-outline" size={48} color={theme.textLight} />
                                                    <Text style={[styles.mapFallbackText, { color: theme.text }]}>Map unavailable</Text>
                                                    <Text style={[styles.mapFallbackHint, { color: theme.textLight }]}>Enter your address in the search above or in the form</Text>
                                                </View>
                                            )}
                                            {hasMapsApiKey && !mapReady && (
                                                <View style={styles.mapLoadingOverlay}>
                                                    <ActivityIndicator size="large" color={colors.primary} />
                                                    <Text style={[styles.mapLoadingText, { color: theme.textLight }]}>Loading map...</Text>
                                                </View>
                                            )}
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.mapConfirmBtn, { backgroundColor: colors.primary }]}
                                                onPress={() => { setShowLocationMapModal(false); setMapSearchQuery(''); setMapMarkerCoord(null); setMapReady(false); }}
                                            >
                                                <Text style={styles.mapConfirmBtnText}>Confirm Location</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>

                                {/* Budget */}
                                <View style={styles.formGroup}>
                                    <Text style={[styles.formLabel, { color: theme.textLight }]}>Budget (excl. Gold & Apparels)</Text>
                                    <View style={styles.budgetRow}>
                                        {BUDGET_OPTIONS.map(opt => (
                                            <TouchableOpacity
                                                key={opt}
                                                style={[
                                                    styles.budgetChip,
                                                    { backgroundColor: isDarkMode ? '#252840' : '#FFF', borderColor: theme.border },
                                                    form.planned_budget === opt && { backgroundColor: colors.primary, borderColor: colors.primary },
                                                ]}
                                                onPress={() => setForm(p => ({ ...p, planned_budget: opt }))}
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
                            </Animated.View>
                        )}

                        {/* Services grouped by category */}
                        {Object.entries(servicesByCategory).map(([catId, catData], catIdx) => {
                            const sectionColor = SECTION_COLORS[catIdx % SECTION_COLORS.length];
                            if (catData.services.length === 0) return null;
                            return (
                                <View key={catId} style={styles.categoryGroup}>
                                    {/* Category Section Header */}
                                    <View style={styles.catSectionHeader}>
                                        <View style={[styles.catSectionDot, { backgroundColor: sectionColor }]} />
                                        <View style={styles.catSectionTitleWrap}>
                                            <Text style={[styles.catSectionTitle, { color: theme.text }]}>
                                                {catData.name}
                                            </Text>
                                            <Text style={[styles.catSectionCount, { color: theme.textLight }]}>
                                                {catData.services.length} {catData.services.length === 1 ? 'service' : 'services'}
                                            </Text>
                                        </View>
                                        <View style={[styles.catSectionLine, { backgroundColor: sectionColor + '30' }]} />
                                    </View>

                                    {/* Service Cards */}
                                    {catData.services.map(item => {
                                        const tierPrices = getServiceTierPrices(item);
                                        const isSelected = selectedServices.has(item.id);
                                        const selected = selectedServices.get(item.id);
                                        const isExpanded = expandedServiceId === item.id;

                                        return (
                                            <View
                                                key={item.id}
                                                style={[
                                                    styles.serviceCard,
                                                    { backgroundColor: theme.card, borderColor: isSelected ? colors.primary : theme.border },
                                                    isSelected && styles.serviceCardSelected,
                                                ]}
                                            >
                                                {/* Service Header */}
                                                <TouchableOpacity
                                                    style={styles.serviceCardHeader}
                                                    onPress={() => toggleService(item)}
                                                    activeOpacity={0.7}
                                                >
                                                    {/* Thumbnail */}
                                                    {item.image_url ? (
                                                        <Image source={{ uri: item.image_url }} style={styles.serviceThumb} />
                                                    ) : (
                                                        <View style={[styles.serviceThumbPlaceholder, { backgroundColor: sectionColor + '15' }]}>
                                                            <Text style={{ fontSize: 24 }}>{item.icon || '🎯'}</Text>
                                                        </View>
                                                    )}

                                                    <View style={styles.serviceTextWrap}>
                                                        <Text style={[styles.serviceName, { color: theme.text }]} numberOfLines={2}>
                                                            {item.name}
                                                        </Text>
                                                        {item.description ? (
                                                            <Text style={[styles.serviceDesc, { color: theme.textLight }]} numberOfLines={isExpanded ? 4 : 2}>
                                                                {item.description}
                                                            </Text>
                                                        ) : null}
                                                        {tierPrices.length > 0 && !isSelected && (
                                                            <Text style={[styles.serviceStartPrice, { color: colors.primary }]}>
                                                                From ₹{tierPrices[0].value.toLocaleString()}
                                                            </Text>
                                                        )}
                                                    </View>

                                                    {/* Selection indicator */}
                                                    <View style={[
                                                        styles.selectCircle,
                                                        { borderColor: isSelected ? colors.primary : (isDarkMode ? '#4B5563' : '#D1D5DB') },
                                                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                                                    ]}>
                                                        {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Tier Selection (shown when selected) */}
                                                {isSelected && tierPrices.length > 0 && (
                                                    <View style={[styles.tierSection, { borderTopColor: theme.border }]}>
                                                        <Text style={[styles.tierSectionTitle, { color: theme.textLight }]}>Choose your package</Text>
                                                        {tierPrices.map((tier, i) => {
                                                            const isTierSelected = selected?.selectedTier === tier.key;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={tier.key}
                                                                    style={[
                                                                        styles.tierOption,
                                                                        { backgroundColor: isDarkMode ? '#1A1D27' : '#FAFAFA', borderColor: isDarkMode ? '#2D3142' : '#E5E7EB' },
                                                                        isTierSelected && { backgroundColor: colors.primary + '0A', borderColor: colors.primary },
                                                                    ]}
                                                                    onPress={() => selectTier(item.id, tier.key, tier.value)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <View style={[
                                                                        styles.tierRadioOuter,
                                                                        { borderColor: isTierSelected ? colors.primary : (isDarkMode ? '#4B5563' : '#D1D5DB') },
                                                                    ]}>
                                                                        {isTierSelected && <View style={[styles.tierRadioInner, { backgroundColor: colors.primary }]} />}
                                                                    </View>
                                                                    <View style={styles.tierContent}>
                                                                        <View style={styles.tierTopRow}>
                                                                            <Text style={[
                                                                                styles.tierLabel,
                                                                                { color: theme.text },
                                                                                isTierSelected && { color: colors.primary, fontWeight: '700' },
                                                                            ]}>{tier.label}</Text>
                                                                            <View style={[styles.tierGuestBadge, { backgroundColor: tier.color + '18' }]}>
                                                                                <Ionicons name="people-outline" size={11} color={tier.color} />
                                                                                <Text style={[styles.tierGuestText, { color: tier.color }]}>{tier.guests}</Text>
                                                                            </View>
                                                                        </View>
                                                                    </View>
                                                                    <Text style={[
                                                                        styles.tierPrice,
                                                                        { color: isTierSelected ? colors.primary : theme.text },
                                                                    ]}>
                                                                        ₹{tier.value.toLocaleString()}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })}

                        <View style={{ height: 200 }} />
                    </ScrollView>

                    {/* Bottom Bar - positioned above BottomTabBar */}
                    <View
                        style={[
                            styles.bottomBar,
                            {
                                backgroundColor: theme.card,
                                borderColor: theme.border,
                                bottom: 72 + Math.max(insets.bottom, 6),
                            },
                        ]}
                    >
                        <View style={styles.bottomLeft}>
                            <Text style={[styles.bottomTotal, { color: theme.text }]}>
                                {selectedServices.size > 0 ? `₹${totalAmount.toLocaleString()}` : 'No selection'}
                            </Text>
                            <Text style={[styles.bottomCount, { color: theme.textLight }]}>
                                {selectedServices.size} service{selectedServices.size !== 1 ? 's' : ''} selected
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.addToCartBtn,
                                selectedServices.size === 0 && styles.addToCartBtnDisabled,
                            ]}
                            onPress={handleAddToCart}
                            disabled={adding || selectedServices.size === 0}
                            activeOpacity={0.85}
                        >
                            {adding ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <LinearGradient
                                    colors={selectedServices.size > 0 ? [colors.primary, '#FFA040'] : ['#9CA3AF', '#6B7280']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.addToCartGradient}
                                >
                                    <Ionicons name="cart" size={22} color="#FFF" />
                                    <Text style={styles.addToCartText}>Add to Cart</Text>
                                    <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.9)" />
                                </LinearGradient>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            )}
            <BottomTabBar navigation={navigation} activeRoute="Home" />
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
    backBtn: { marginRight: 10 },
    backBtnCircle: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    headerTagRow: { flexDirection: 'row', marginTop: 3 },
    headerTag: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 6,
    },
    headerTagText: { fontSize: 12, fontWeight: '600' },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    headerBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingSpinner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    loadingText: { fontSize: 15, fontWeight: '500' },

    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
    emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 280 },
    emptyBtn: { borderRadius: 14, overflow: 'hidden' },
    emptyBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        gap: 8,
    },
    emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },

    // Form toggle
    detailsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    detailsToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    detailsIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsToggleTitle: { fontSize: 15, fontWeight: '700' },
    detailsToggleHint: { fontSize: 12, marginTop: 2 },
    chevronWrap: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    formCard: {
        borderRadius: 16,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderWidth: 1.5,
        borderTopWidth: 0,
        padding: 16,
        marginBottom: 8,
    },
    formGroup: { marginBottom: 14 },
    formLabel: { fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    formCol: { flex: 1 },
    roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    roleChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1.5,
    },
    roleText: { fontSize: 13, fontWeight: '600' },
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
    budgetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    budgetChip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    budgetText: { fontSize: 12, fontWeight: '600' },
    locationBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    locationActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    locationActionText: { fontSize: 13, fontWeight: '600' },
    mapModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    mapModalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%' },
    mapModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    mapModalTitle: { fontSize: 18, fontWeight: '700' },
    mapSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 12,
        gap: 8,
    },
    mapSearchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
    mapSearchBtn: { padding: 4 },
    mapContainer: { position: 'relative', height: 280, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
    mapView: { height: 280, borderRadius: 12, width: '100%' },
    mapLoadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
        zIndex: 10,
    },
    mapLoadingText: { marginTop: 8, fontSize: 14 },
    mapFallback: { justifyContent: 'center', alignItems: 'center', padding: 24 },
    mapFallbackText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
    mapFallbackHint: { fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 16 },
    mapConfirmBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    mapConfirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

    // Category groups
    categoryGroup: { marginTop: 20 },
    catSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 10,
    },
    catSectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    catSectionTitleWrap: { flexShrink: 1 },
    catSectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
    catSectionCount: { fontSize: 12, marginTop: 2 },
    catSectionLine: {
        flex: 1,
        height: 2,
        borderRadius: 1,
    },

    // Service cards
    serviceCard: {
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 12,
        overflow: 'hidden',
    },
    serviceCardSelected: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    serviceCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    serviceThumb: { width: 52, height: 52, borderRadius: 14, marginRight: 12 },
    serviceThumbPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    serviceTextWrap: { flex: 1, marginRight: 10 },
    serviceName: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
    serviceDesc: { fontSize: 12, marginTop: 4, lineHeight: 17 },
    serviceStartPrice: { fontSize: 13, fontWeight: '700', marginTop: 4 },
    selectCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Tiers
    tierSection: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        paddingTop: 10,
        borderTopWidth: 1,
    },
    tierSectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    tierOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        marginBottom: 6,
    },
    tierRadioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    tierRadioInner: { width: 10, height: 10, borderRadius: 5 },
    tierContent: { flex: 1 },
    tierTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tierLabel: { fontSize: 14, fontWeight: '600' },
    tierGuestBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 4,
    },
    tierGuestText: { fontSize: 11, fontWeight: '600' },
    tierPrice: { fontSize: 16, fontWeight: '800' },

    // Bottom bar - prominent above footer
    bottomBar: {
        position: 'absolute',
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderRadius: 20,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
    },
    bottomLeft: {},
    bottomTotal: { fontSize: 22, fontWeight: '800' },
    bottomCount: { fontSize: 13, marginTop: 2 },
    addToCartBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        minWidth: 160,
    },
    addToCartBtnDisabled: { opacity: 0.5 },
    addToCartGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        gap: 10,
    },
    addToCartText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
