import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Image, TouchableOpacity, Dimensions, Alert, TextInput, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients } from '../../theme/colors';
import { EVENT_TYPES, SERVICES, VENUES as MOCK_VENUES, CITIES } from '../../data/mockData';
import BookingModal from '../../components/BookingModal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ChatModal from '../../components/ChatModal';
import { AnimatedBackground } from '../../components/AnimatedBackground';
import { dbService, getVendorImageUrl } from '../../services/supabase';
import Logo from '../../components/Logo';

const { width } = Dimensions.get('window');

export default function Home({ navigation }) {
    const { theme, isDarkMode } = useTheme();
    const { isAuthenticated, user, signOut } = useAuth();

    // State
    const [locationName, setLocationName] = useState('Bhubaneswar, Odisha');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [bookingModalVisible, setBookingModalVisible] = useState(false);
    const [selectedEventTypeForBooking, setSelectedEventTypeForBooking] = useState(null);
    const [currentCity, setCurrentCity] = useState('Bhubaneswar');

    // Data from Supabase
    const [vendors, setVendors] = useState([]);
    const [venues, setVenues] = useState([]);
    const [cities, setCities] = useState(CITIES);
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch data on mount and when location/type changes
    useEffect(() => {
        fetchData();
    }, [currentCity, selectedType]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch vendors
            const { data: vendorData, error: vendorError } = await dbService.getVendors({
                city: currentCity,
                serviceCategory: selectedType !== 'all' ? selectedType : null,
            });
            
            if (vendorData && !vendorError) {
                setVendors(vendorData);
            }

            // Fetch venues
            const { data: venueData, error: venueError } = await dbService.getVenues({
                city: currentCity,
                eventType: selectedType,
            });
            
            if (venueData && !venueError) {
                setVenues(venueData);
            } else {
                // Fall back to mock data if Supabase is not configured
                setVenues(MOCK_VENUES.filter(v => v.city === currentCity));
            }

            // Fetch cities
            const { data: cityData } = await dbService.getCities();
            if (cityData && cityData.length > 0) {
                setCities(cityData.map(c => `${c.name}, ${c.state}`));
            }

            // Fetch banners
            const { data: bannerData } = await dbService.getBanners();
            if (bannerData && bannerData.length > 0) {
                setBanners(bannerData);
            }
        } catch (error) {
            console.log('[FETCH ERROR]', error);
            // Fall back to mock data
            setVenues(MOCK_VENUES.filter(v => v.city === currentCity));
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [currentCity, selectedType]);

    // Derived State
    const filteredServices = SERVICES.filter(service => {
        const matchesType = selectedType === 'all' || service.type.includes(selectedType);
        const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesSearch;
    });

    const filteredVenues = venues.length > 0 
        ? venues.filter(venue => {
            const matchesSearch = venue.name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        })
        : MOCK_VENUES.filter(venue => {
            const matchesCity = venue.city === currentCity;
        const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = selectedType === 'all' || venue.type.includes(selectedType);
        return matchesCity && matchesSearch && matchesType;
    });

    // Sub-components
    const renderServiceItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.serviceItem} 
            onPress={() => navigation.navigate('VendorsList', { 
                service: item,
                city: currentCity,
            })}
        >
            <LinearGradient
                colors={isDarkMode ? ['#2a2a2a', '#1f1f1f'] : ['#ffffff', '#f8f9fa']}
                style={[styles.serviceIcon, { borderColor: theme.border }]}
            >
                <Text style={{ fontSize: 28 }}>{item.icon || '🎯'}</Text>
            </LinearGradient>
            <Text style={[styles.serviceName, { color: theme.text }]}>{item.name}</Text>
        </TouchableOpacity>
    );

    const renderVenue = ({ item }) => (
        <TouchableOpacity
            style={[styles.venueCard, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('VenueDetail', { venue: item })}
        >
            <Image 
                source={{ uri: item.image || item.image_url }} 
                style={styles.venueImage} 
            />
            <View style={styles.venueInfo}>
                <Text style={[styles.venueName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.venueLocation, { color: theme.textLight }]}>
                    {item.location || item.address}
                </Text>
                <View style={styles.venueFooter}>
                    <Text style={[styles.venuePrice, { color: colors.primary }]}>
                        {item.price || `₹${item.price_per_day || 'Contact'}`}
                    </Text>
                    <View style={styles.ratingContainer}>
                        <Text style={styles.venueRating}>★ {item.rating || '4.5'}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderVendor = ({ item }) => (
        <TouchableOpacity
            style={[styles.vendorCardHome, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('VendorDetail', { 
                vendor: item,
                city: currentCity,
            })}
        >
            <Image 
                source={{ uri: getVendorImageUrl(item.logo_url, item.business_name) }} 
                style={styles.vendorImageHome} 
            />
            <View style={styles.vendorInfoHome}>
                <Text style={[styles.vendorNameHome, { color: theme.text }]} numberOfLines={1}>
                    {item.business_name || 'Vendor'}
                </Text>
                <Text style={[styles.vendorCategoryHome, { color: colors.primary }]} numberOfLines={1}>
                    {item.category || 'Service'}
                </Text>
                {item.city && (
                    <View style={styles.vendorLocationHome}>
                        <Ionicons name="location-outline" size={11} color={theme.textLight} />
                        <Text style={[styles.vendorLocationText, { color: theme.textLight }]} numberOfLines={1}>
                            {item.city}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    // Handlers
    const handleProfilePress = () => {
        if (isAuthenticated) {
            navigation.navigate('Menu');
        } else {
            navigation.navigate('Login');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Logout", 
                    style: 'destructive', 
                    onPress: async () => {
                        await signOut();
                    }
                }
            ]
        );
    };

    const handleCityChange = (city) => {
        const cityNameOnly = city.split(',')[0].trim();
        setCurrentCity(cityNameOnly);
        setLocationName(city);
        setLocationPickerVisible(false);
    };

    const handleEventTypePress = (typeId) => {
        const typeObj = EVENT_TYPES.find(t => t.id === typeId);
        setSelectedEventTypeForBooking(typeObj);
        setSelectedType(typeId);
        setBookingModalVisible(true);
    };

    // Get location on mount
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            try {
            let location = await Location.getCurrentPositionAsync({});
            let address = await Location.reverseGeocodeAsync(location.coords);

            if (address && address.length > 0) {
                const { city, region } = address[0];
                if (city) {
                    setLocationName(`${city}, ${region}`);
                    setCurrentCity(city);
                }
                }
            } catch (error) {
                console.log('[LOCATION ERROR]', error);
            }
        })();
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <AnimatedBackground>
                <ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => navigation.navigate('Menu')} style={{ marginRight: 12 }}>
                                <Ionicons name="menu" size={28} color={theme.text} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setLocationPickerVisible(true)}>
                                <Text style={[styles.locationLabel, { color: theme.textLight }]}>
                                    Your Location ▾
                                </Text>
                                <Text style={[styles.locationValue, { color: theme.text }]}>
                                    {locationName} 📍
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Login / Profile Icon */}
                        <TouchableOpacity 
                            style={[styles.profileBtn, { backgroundColor: isDarkMode ? '#333' : '#FFF5F2' }]} 
                            onPress={handleProfilePress}
                        >
                            {isAuthenticated ? (
                                <Ionicons name="person" size={22} color={colors.primary} />
                            ) : (
                                <Ionicons name="log-in-outline" size={22} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Location Picker Modal */}
                    <Modal visible={locationPickerVisible} animationType="fade" transparent>
                        <TouchableOpacity 
                            style={styles.modalOverlay} 
                            onPress={() => setLocationPickerVisible(false)}
                            activeOpacity={1}
                        >
                            <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
                                <Text style={[styles.pickerTitle, { color: theme.text }]}>Select City</Text>
                                {cities.map((city, index) => (
                                    <TouchableOpacity 
                                        key={index} 
                                        style={[styles.pickerItem, { borderBottomColor: theme.border }]} 
                                        onPress={() => handleCityChange(city)}
                                    >
                                        <Text style={[styles.pickerItemText, { color: theme.text }]}>{city}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableOpacity>
                    </Modal>

                    {/* Search Bar */}
                    <View style={[styles.searchBar, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                        <Ionicons name="search" size={20} color={theme.textLight} style={{ marginRight: 10 }} />
                        <TextInput
                            style={[styles.searchInput, { color: theme.text }]}
                            placeholder="Search venues, services, vendors..."
                            placeholderTextColor={theme.textLight}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color={theme.textLight} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Banner Ads Section */}
                    {banners.length > 0 && (
                        <View style={styles.bannerSection}>
                            <FlatList
                                data={banners}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.bannerCard} activeOpacity={0.9}>
                                        <Image 
                                            source={{ uri: item.image_url }} 
                                            style={styles.bannerImage}
                                            resizeMode="cover"
                                        />
                                        <LinearGradient
                                            colors={['transparent', 'rgba(0,0,0,0.7)']}
                                            style={styles.bannerOverlay}
                                        >
                                            <Text style={styles.bannerTitle}>{item.title}</Text>
                                            {item.subtitle && (
                                                <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                                            )}
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

                    {/* Event Type / Get Together Planning */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>
                            Plan Your Get Together
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeList}>
                            {EVENT_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.typeChip,
                                        { backgroundColor: theme.inputBackground, borderColor: theme.border },
                                        selectedType === type.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                                    ]}
                                    onPress={() => handleEventTypePress(type.id)}
                                >
                                    <Text style={[
                                        styles.typeText,
                                        { color: theme.text },
                                        selectedType === type.id && styles.typeTextActive
                                    ]}>{type.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Event Services */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>
                            {selectedType === 'all' ? 'Event Services' : `Services for ${EVENT_TYPES.find(t => t.id === selectedType)?.name}`}
                        </Text>
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : (
                        <View style={styles.servicesGrid}>
                            {filteredServices.map((item) => (
                                <View key={item.id} style={styles.gridItemWrapper}>
                                    {renderServiceItem({ item })}
                                </View>
                            ))}
                        </View>
                        )}
                        {!loading && filteredServices.length === 0 && (
                            <Text style={[styles.noDataText, { color: theme.textLight }]}>
                                No services found for this category.
                            </Text>
                        )}
                    </View>

                    {/* Vendors Section */}
                    {vendors.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                Top Vendors in {currentCity}
                            </Text>
                            <FlatList
                                data={vendors.slice(0, 10)}
                                renderItem={renderVendor}
                                keyExtractor={item => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.vendorsList}
                            />
                        </View>
                    )}

                    {/* Venues Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                {selectedType === 'all' ? `Popular Venues in ${currentCity}` : `Venues for ${EVENT_TYPES.find(t => t.id === selectedType)?.name}`}
                            </Text>
                        </View>
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : filteredVenues.length > 0 ? (
                            <FlatList
                                data={filteredVenues}
                                renderItem={renderVenue}
                                keyExtractor={item => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.venuesList}
                            />
                        ) : (
                            <Text style={[styles.noDataText, { color: theme.textLight }]}>
                                No venues found in {currentCity}.
                            </Text>
                        )}
                    </View>

                    {/* About Us Card */}
                    <View style={[styles.section, { marginBottom: 100 }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>About eKatRaa</Text>
                        <TouchableOpacity style={styles.promoContainer}>
                            <LinearGradient
                                colors={['#FF4117', '#FF6B35', '#FF8C42']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.gradientCard}
                            >
                                <View style={styles.promoLogoContainer}>
                                    <View style={styles.promoLogoCircle}>
                                        <Logo width={50} height={50} />
                                    </View>
                                </View>
                                <Text style={styles.promoTitle}>eKatRaa</Text>
                                <Text style={styles.promoSubtitle}>"Coming together is a beginning."</Text>
                                <Text style={styles.promoDescription}>
                                    We simplify your get-together planning. From weddings to casual meetups, find everything in one place.
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </AnimatedBackground>

            {/* AI Floating Action Button */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => setChatModalVisible(true)}
            >
                <Ionicons name="chatbubbles" size={26} color="#FFF" />
            </TouchableOpacity>

            {/* Booking Modal */}
            <BookingModal
                visible={bookingModalVisible}
                onClose={() => setBookingModalVisible(false)}
                eventType={selectedEventTypeForBooking}
                navigation={navigation}
            />

            {/* AI Chat Modal */}
            <ChatModal
                visible={chatModalVisible}
                onClose={() => setChatModalVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 20,
    },
    locationLabel: {
        fontSize: 12,
    },
    locationValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBar: {
        marginHorizontal: 20,
        paddingHorizontal: 14,
        height: 50,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        height: '100%',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 20,
        marginBottom: 16,
    },
    typeList: {
        paddingHorizontal: 20,
    },
    typeChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1.5,
    },
    typeText: {
        fontSize: 14,
        fontWeight: '500',
    },
    typeTextActive: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 10,
    },
    gridItemWrapper: {
        width: '25%',
        alignItems: 'center',
        marginBottom: 20,
    },
    serviceItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
    },
    serviceName: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    vendorsList: {
        paddingHorizontal: 16,
    },
    vendorCardHome: {
        width: 150,
        borderRadius: 16,
        marginHorizontal: 8,
        padding: 14,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,65,23,0.1)',
    },
    vendorImageHome: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginBottom: 12,
        backgroundColor: '#FFF5F2',
        borderWidth: 2,
        borderColor: 'rgba(255,65,23,0.2)',
    },
    vendorInfoHome: {
        alignItems: 'center',
        width: '100%',
    },
    vendorNameHome: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4,
    },
    vendorCategoryHome: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
    vendorLocationHome: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 3,
    },
    vendorLocationText: {
        fontSize: 10,
    },
    venuesList: {
        paddingHorizontal: 16,
    },
    venueCard: {
        width: 260,
        borderRadius: 16,
        marginHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        marginBottom: 10,
        overflow: 'hidden',
    },
    venueImage: {
        width: '100%',
        height: 150,
        backgroundColor: '#EEE',
    },
    venueInfo: {
        padding: 12,
    },
    venueName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    venueLocation: {
        fontSize: 13,
        marginBottom: 8,
    },
    venueFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    venuePrice: {
        fontSize: 15,
        fontWeight: '700',
    },
    ratingContainer: {
        backgroundColor: '#10B981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    venueRating: {
        fontSize: 12,
        color: '#FFF',
        fontWeight: 'bold',
    },
    promoContainer: {
        marginHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    gradientCard: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    promoLogoContainer: {
        marginBottom: 12,
    },
    promoLogoCircle: {
        backgroundColor: '#FFFFFF',
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    promoTitle: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    promoSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 15,
        fontStyle: 'italic',
        marginBottom: 12,
    },
    promoDescription: {
        color: 'rgba(255,255,255,0.95)',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        textAlign: 'center',
    },
    noDataText: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 10,
        marginHorizontal: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContent: {
        borderRadius: 16,
        padding: 20,
        width: '80%',
        maxHeight: '60%',
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    pickerItem: {
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    pickerItemText: {
        fontSize: 16,
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        zIndex: 100,
    },
    bannerSection: {
        marginBottom: 24,
    },
    bannerList: {
        paddingHorizontal: 20,
    },
    bannerCard: {
        width: width - 40,
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: 12,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingTop: 40,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    bannerSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
    },
});
