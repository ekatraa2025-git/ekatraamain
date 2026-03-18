import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, FlatList, Image,
    TouchableOpacity, Dimensions, Modal, Linking,
    ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { EVENT_TYPES as MOCK_EVENT_TYPES, CITIES } from '../../data/mockData';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ChatModal from '../../components/ChatModal';
import { AnimatedBackground } from '../../components/AnimatedBackground';
import { dbService, resolveStorageUrl } from '../../services/supabase';
import { api, useBackendApi } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAppData } from '../../context/AppDataContext';
import BottomTabBar from '../../components/BottomTabBar';
import Logo from '../../components/Logo';

const { width } = Dimensions.get('window');
const OCCASION_CARD_GAP = 12;
const OCCASION_CARD_WIDTH = (width - 20 * 2 - OCCASION_CARD_GAP) / 2;
const CATEGORY_BOX_WIDTH = 110;

export default function Home({ navigation }) {
    const { theme, isDarkMode } = useTheme();
    const { isAuthenticated, user } = useAuth();

    const [locationName, setLocationName] = useState('Bhubaneswar, Odisha');
    const [selectedType, setSelectedType] = useState(null);
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [currentCity, setCurrentCity] = useState('Bhubaneswar');
    const { cartId, cartItemCount, refreshCartCount: refreshGlobalCartCount } = useCart();
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
    const useApi = useBackendApi();

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
        if (!selectedType) {
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
    }, [useApi, selectedType]);

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

    const handleEventTypePress = (typeObj) => {
        const id = typeof typeObj === 'object' ? typeObj.id : typeObj;
        setSelectedType(id === selectedType ? null : id);
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
    const primaryOccasionIds = new Set(
        eventTypes
            .filter((t) => {
                const id = String(t.id || '').toLowerCase();
                const name = String(t.name || '').toLowerCase();
                return id === 'wedding' || name.includes('wedding') || name.includes('janeyu') || name.includes('janayu') || name.includes('thread');
            })
            .map((t) => t.id)
    );
    const primaryOccasions = eventTypes.filter((t) => primaryOccasionIds.has(t.id)).slice(0, 2);
    const otherOccasions = eventTypes.filter((t) => !primaryOccasionIds.has(t.id));
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

                    {/* Banner Ads — above Plan Your Occasion */}
                    {banners.length > 0 && (
                        <View style={styles.bannerSection}>
                            <FlatList
                                data={banners}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.bannerCard} activeOpacity={0.9}>
                                        <Image
                                            source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800' }}
                                            style={styles.bannerImage}
                                            resizeMode="cover"
                                        />
                                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.bannerOverlay}>
                                            <Text style={styles.bannerTitle}>{item.title}</Text>
                                            {item.subtitle && <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                                keyExtractor={item => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                pagingEnabled
                                snapToInterval={width - 40}
                                decelerationRate="fast"
                                contentContainerStyle={styles.bannerList}
                            />
                        </View>
                    )}

                    {/* Plan Your Occasion */}
                    <View style={styles.section}>
                        <View style={styles.sectionTitleRow}>
                            <View>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Plan Your Occasion</Text>
                                <Text style={[styles.sectionSubtitle, { color: theme.textLight }]}>Choose an event to get started</Text>
                            </View>
                        </View>
                        {loading ? (
                            <View style={styles.occasionGrid}>
                                {[1, 2, 3].map(i => (
                                    <View key={i} style={[styles.occasionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <View style={[styles.occasionIconWrap, { backgroundColor: isDarkMode ? '#252840' : '#F3F4F6' }]}>
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        </View>
                                        <View style={{ width: 60, height: 12, borderRadius: 6, backgroundColor: isDarkMode ? '#2D3142' : '#E5E7EB' }} />
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View>
                                <View style={styles.occasionGrid}>
                                    {primaryOccasions.map((type) => {
                                        const typeColor = type.color || colors.primary;
                                        const isSelected = selectedType === type.id;
                                        return (
                                            <TouchableOpacity
                                                key={type.id}
                                                style={[
                                                    styles.occasionCard,
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
                                    {otherOccasions.length > 0 && (
                                        <TouchableOpacity
                                            style={[
                                                styles.occasionCard,
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
                                    )}
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
                                                        styles.occasionCardCompact,
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

                    {/* Category Multi-Select Section */}
                    {selectedType && categoriesLoading && (
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
                    {selectedType && !categoriesLoading && categories.length > 0 && (
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

                    {/* Thank You from eKatRaa */}
                    <View style={[styles.thankYouSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <LinearGradient
                            colors={[colors.primary + '12', colors.secondary + '08']}
                            style={styles.thankYouGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={{ marginBottom: 10 }}>
                                <Logo width={40} height={40} />
                            </View>
                            <Text style={[styles.thankYouTitle, { color: theme.text }]}>Thank you from eKatRaa</Text>
                            <Text style={[styles.thankYouText, { color: theme.textLight }]}>
                                We're honoured to be part of your special occasion. Your trust means the world to us—here's to creating memories that last a lifetime.
                            </Text>
                        </LinearGradient>
                    </View>

                    <View style={{ height: 80 }} />
                </ScrollView>
            </AnimatedBackground>

            <ChatModal visible={chatModalVisible} onClose={() => setChatModalVisible(false)} />

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
    bannerImage: { width: '100%', height: '100%' },
    bannerOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 18,
        paddingTop: 50,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
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
    thankYouSection: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    thankYouGradient: {
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
    },
    thankYouTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 8,
    },
    thankYouText: {
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
    },
});
