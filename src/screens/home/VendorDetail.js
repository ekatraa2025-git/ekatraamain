import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Modal, TextInput, Platform, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { dbService, getVendorImageUrl, getServiceImageUrl, resolveStorageUrl } from '../../services/supabase';
import { EKATRAA_SUPPORT_TEL, EKATRAA_SUPPORT_WHATSAPP_URL } from '../../constants/support';
import { Button } from '../../components/Button';
import BottomTabBar from '../../components/BottomTabBar';
import { useToast } from '../../context/ToastContext';

function normalizeGalleryUrls(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p.filter(Boolean) : [];
        } catch {
            return [];
        }
    }
    return [];
}

/** Logo first (if not already present), then gallery — de-duplicated so every image appears once. */
function mergeLogoIntoGalleryUrls(logoUrl, galleryArr) {
    const g = [...galleryArr];
    if (logoUrl && !g.some((u) => u === logoUrl)) g.unshift(logoUrl);
    const seen = new Set();
    return g.filter((u) => {
        if (!u || seen.has(u)) return false;
        seen.add(u);
        return true;
    });
}

/** Prefer legacy `image_url`; vendor app often stores `image_urls` (array). */
function getServicePrimaryImagePath(svc) {
    if (!svc) return null;
    if (svc.image_url) return svc.image_url;
    const raw = svc.image_urls;
    if (raw == null) return null;
    let arr = raw;
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            arr = Array.isArray(p) ? p : [];
        } catch {
            return raw.trim() || null;
        }
    }
    if (Array.isArray(arr)) {
        const first = arr.find(Boolean);
        return first || null;
    }
    return null;
}

function isServiceVisibleInCatalog(svc) {
    if (!svc) return false;
    if (svc.archived === true) return false;
    if (svc.is_active === false) return false;
    return true;
}

/** Must clear bottom tab bar so fixed “Send Enquiry” sits above it (see bottomBar style). */
const BOTTOM_TAB_BAR_CONTENT_H = 56;

export default function VendorDetail({ route, navigation }) {
    const { vendor: vendorParam, city, openEnquiry, contactLocked: contactLockedParam } = route.params || {};
    const insets = useSafeAreaInsets();
    const tabBarOffset = BOTTOM_TAB_BAR_CONTENT_H + Math.max(insets.bottom, 6);
    const { theme, isDarkMode } = useTheme();
    const { t: tr } = useLocale();
    const { showToast, showConfirm } = useToast();
    const { user, isAuthenticated } = useAuth();
    const contactLocked = contactLockedParam === true;

    // Full vendor data (fetched by id); fallback to params
    const [vendorData, setVendorData] = useState(vendorParam || null);
    const [fetchLoading, setFetchLoading] = useState(!!vendorParam?.id);

    useEffect(() => {
        if (!vendorParam?.id) {
            setFetchLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data, error } = await dbService.getVendorById(vendorParam.id);
            if (cancelled) return;
            setFetchLoading(false);
            if (!error && data) setVendorData(data);
            else if (vendorParam) setVendorData(vendorParam);
        })();
        return () => { cancelled = true; };
    }, [vendorParam?.id]);

    const vendor = vendorData;

    const galleryListRaw = useMemo(() => normalizeGalleryUrls(vendor?.gallery_urls), [vendor?.gallery_urls]);
    const galleryListMerged = useMemo(
        () => mergeLogoIntoGalleryUrls(vendor?.logo_url, galleryListRaw),
        [vendor?.logo_url, galleryListRaw]
    );

    const visibleServices = useMemo(() => {
        const list = vendor?.services || [];
        return list.filter(isServiceVisibleInCatalog);
    }, [vendor?.services]);

    const [resolvedLogoUri, setResolvedLogoUri] = useState(null);
    const [resolvedGalleryUris, setResolvedGalleryUris] = useState([]);
    const [resolvedServiceImages, setResolvedServiceImages] = useState({});

    useEffect(() => {
        if (!vendor) return;
        let cancelled = false;
        const name = vendor.business_name || 'Vendor';
        (async () => {
            const galleryResolved = await Promise.all(
                galleryListMerged.map(async (path) => {
                    const r = await resolveStorageUrl(path);
                    return r || getVendorImageUrl(path, name);
                })
            );
            const logoResolved = vendor.logo_url
                ? (await resolveStorageUrl(vendor.logo_url)) || getVendorImageUrl(vendor.logo_url, name)
                : galleryResolved[0] || getVendorImageUrl(null, name);

            const svcMap = {};
            await Promise.all(
                visibleServices.map(async (svc) => {
                    const primaryPath = getServicePrimaryImagePath(svc);
                    if (!primaryPath) return;
                    const r = await resolveStorageUrl(primaryPath);
                    const uri = r || getServiceImageUrl(primaryPath);
                    const idKey = svc.id != null ? String(svc.id) : null;
                    if (idKey) svcMap[idKey] = uri;
                    if (primaryPath) svcMap[primaryPath] = uri;
                })
            );

            if (cancelled) return;
            setResolvedLogoUri(logoResolved);
            setResolvedGalleryUris(galleryResolved.filter(Boolean));
            setResolvedServiceImages(svcMap);
        })();
        return () => {
            cancelled = true;
        };
    }, [vendor, galleryListMerged, visibleServices]);

    const displayGalleryUris = useMemo(() => {
        if (!vendor) return [];
        const name = vendor.business_name || 'Vendor';
        if (resolvedGalleryUris.length > 0) return resolvedGalleryUris;
        return galleryListMerged.map((p) => getVendorImageUrl(p, name));
    }, [vendor, resolvedGalleryUris, galleryListMerged]);

    const heroLogoUri = resolvedLogoUri
        || (vendor ? getVendorImageUrl(vendor.logo_url, vendor.business_name || 'Vendor') : null);

    // Enquiry Modal State
    const [enquiryVisible, setEnquiryVisible] = useState(openEnquiry || false);
    const [loading, setLoading] = useState(false);
    const [enquiryData, setEnquiryData] = useState({
        name: '',
        phone: '',
        eventDate: new Date(),
        eventType: '',
        message: '',
    });
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Handle null vendor
    if (!vendor) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={theme.textLight} />
                    <Text style={[styles.errorText, { color: theme.text }]}>Vendor not found</Text>
                    <Button title="Go Back" onPress={() => navigation.goBack()} />
                </View>
            </SafeAreaView>
        );
    }

    // Unauthenticated: show vendor card but gate full details — ask to register
    if (!isAuthenticated) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Vendor Details</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={[styles.authGateContainer, { backgroundColor: theme.card }]}>
                    <Image
                        source={{ uri: heroLogoUri || getVendorImageUrl(vendor.logo_url, vendor.business_name) }}
                        style={styles.authGateLogo}
                    />
                    <Text style={[styles.authGateName, { color: theme.text }]}>{vendor.business_name || 'Vendor'}</Text>
                    <Text style={[styles.authGateCategory, { color: theme.textLight }]}>{vendor.category || 'Service Provider'}</Text>
                    <Text style={[styles.authGateMessage, { color: theme.textLight }]}>
                        Register or login to view full details, services, pricing and contact info.
                    </Text>
                    <Button
                        title="Register / Login"
                        onPress={() => navigation.navigate('Login')}
                    />
                </View>
            </SafeAreaView>
        );
    }

    const handleCall = () => {
        if (contactLocked) {
            Linking.openURL(EKATRAA_SUPPORT_TEL);
            return;
        }
        if (vendor.phone) {
            Linking.openURL(`tel:${vendor.phone}`);
        } else {
            showToast({ variant: 'info', title: 'No phone number', message: 'Phone number not available for this vendor.' });
        }
    };

    const handleEmail = () => {
        if (contactLocked) {
            Linking.openURL(EKATRAA_SUPPORT_WHATSAPP_URL);
            return;
        }
        if (vendor.email) {
            Linking.openURL(`mailto:${vendor.email}`);
        }
    };

    const handleSubmitEnquiry = async () => {
        // Validation
        if (!enquiryData.name.trim()) {
            showToast({ variant: 'info', title: 'Required', message: 'Please enter your name.' });
            return;
        }
        if (!enquiryData.phone.trim() || enquiryData.phone.replace(/\D/g, '').length < 10) {
            showToast({ variant: 'info', title: 'Required', message: 'Please enter a valid phone number.' });
            return;
        }

        // Check login
        if (!isAuthenticated) {
            showConfirm({
                title: 'Login required',
                message: 'Please login to submit your enquiry.',
                cancelLabel: 'Cancel',
                confirmLabel: 'Login',
                onConfirm: () => {
                    setEnquiryVisible(false);
                    navigation.navigate('Login');
                },
            });
            return;
        }

        setLoading(true);
        try {
            // Note: vendor_id is stored in preferred_venue field as reference
            const enquiry = {
                user_id: user?.id,
                event_type: enquiryData.eventType || 'General Enquiry',
                event_date: enquiryData.eventDate.toISOString(),
                contact_name: enquiryData.name,
                contact_phone: enquiryData.phone.replace(/\D/g, ''),
                additional_notes: `Vendor: ${vendor.business_name} (ID: ${vendor.id})\n${enquiryData.message || ''}`,
                preferred_venue: vendor.business_name,
                city: city || vendor.city,
                status: 'pending',
            };

            const { data, error } = await dbService.submitEnquiry(enquiry);

            if (error) throw error;

            showToast({
                variant: 'success',
                title: 'Enquiry sent',
                message: `Your enquiry has been sent to ${vendor.business_name}. They will contact you soon.`,
                action: { label: 'OK', onPress: () => setEnquiryVisible(false) },
            });

            // Reset form
            setEnquiryData({
                name: '',
                phone: '',
                eventDate: new Date(),
                eventType: '',
                message: '',
            });
        } catch (error) {
            console.error('[ENQUIRY ERROR]', error);
            showToast({ variant: 'error', title: 'Error', message: 'Failed to send enquiry. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setEnquiryData({ ...enquiryData, eventDate: selectedDate });
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Vendor Details</Text>
                {fetchLoading ? <ActivityIndicator size="small" color={colors.primary} style={{ width: 40 }} /> : <View style={{ width: 40 }} />}
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: tabBarOffset + 96 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Vendor Header Card */}
                <LinearGradient
                    colors={['#FF7A00', '#FF9A33', '#FFA040']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.vendorHeader}
                >
                    <View style={styles.vendorLogoContainer}>
                        <Image
                            source={{ uri: heroLogoUri || getVendorImageUrl(vendor.logo_url, vendor.business_name) }}
                            style={styles.vendorLogo}
                            resizeMode="cover"
                        />
                        {vendor.is_verified && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.vendorName}>{vendor.business_name || 'Vendor'}</Text>
                    <Text style={styles.vendorCategory}>{vendor.category || 'Service Provider'}</Text>
                </LinearGradient>

                {/* Quick Actions */}
                <View style={[styles.actionsRow, { backgroundColor: theme.card }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                        <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                            <Ionicons name="call" size={22} color="#4CAF50" />
                        </View>
                        <Text style={[styles.actionText, { color: theme.text }]}>
                            {contactLocked ? tr('vendor_call_ekatraa') : 'Call'}
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionBtn} onPress={handleEmail}>
                        <View style={[styles.actionIcon, { backgroundColor: contactLocked ? '#E8F5E9' : '#E3F2FD' }]}>
                            <Ionicons
                                name={contactLocked ? 'logo-whatsapp' : 'mail'}
                                size={22}
                                color={contactLocked ? '#25D366' : '#2196F3'}
                            />
                        </View>
                        <Text style={[styles.actionText, { color: theme.text }]}>
                            {contactLocked ? tr('vendor_whatsapp_ekatraa') : 'Email'}
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setEnquiryVisible(true)}>
                        <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
                            <Ionicons name="chatbubbles" size={22} color={colors.primary} />
                        </View>
                        <Text style={[styles.actionText, { color: theme.text }]}>Enquire</Text>
                    </TouchableOpacity>
                </View>

                {/* Description */}
                {vendor.description && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
                        <Text style={[styles.descriptionText, { color: theme.textLight }]}>
                            {vendor.description}
                        </Text>
                    </View>
                )}

                {/* Gallery — merged logo + gallery_urls, URLs resolved (signed/public) */}
                {displayGalleryUris.length > 0 && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Gallery</Text>
                        <FlatList
                            horizontal
                            data={displayGalleryUris}
                            keyExtractor={(item, idx) => `${item}-${idx}`}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.galleryListContent}
                            renderItem={({ item }) => (
                                <Image
                                    source={{ uri: item }}
                                    style={styles.galleryThumb}
                                    resizeMode="cover"
                                />
                            )}
                        />
                    </View>
                )}

                {/* Contact Details */}
                <View style={[styles.section, { backgroundColor: theme.card }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Details</Text>
                    {contactLocked ? (
                        <Text style={[styles.descriptionText, { color: theme.textLight, marginBottom: 12 }]}>
                            {tr('vendor_contact_locked_note')}
                        </Text>
                    ) : null}
                    {contactLocked ? (
                        <>
                            <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
                                <Ionicons name="call-outline" size={20} color={colors.primary} />
                                <Text style={[styles.contactText, { color: theme.text }]}>Ekatraa support (call)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
                                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                                <Text style={[styles.contactText, { color: theme.text }]}>Ekatraa support (WhatsApp)</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {vendor.phone && (
                                <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
                                    <Ionicons name="call-outline" size={20} color={colors.primary} />
                                    <Text style={[styles.contactText, { color: theme.text }]}>{vendor.phone}</Text>
                                </TouchableOpacity>
                            )}
                            {vendor.email && (
                                <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
                                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                                    <Text style={[styles.contactText, { color: theme.text }]}>{vendor.email}</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>

                {/* Services — larger cards with prominent images */}
                {visibleServices.length > 0 && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</Text>
                        {visibleServices.map((svc, idx) => {
                            const primaryPath = getServicePrimaryImagePath(svc);
                            const idKey = svc.id != null ? String(svc.id) : null;
                            const serviceImageUri =
                                (idKey && resolvedServiceImages[idKey]) ||
                                (primaryPath && resolvedServiceImages[primaryPath]) ||
                                getServiceImageUrl(primaryPath);
                            return (
                                <View
                                    key={svc.id || idx}
                                    style={[styles.serviceCard, { borderColor: theme.border, backgroundColor: isDarkMode ? theme.background : '#FAFAFA' }]}
                                >
                                    {serviceImageUri ? (
                                        <Image
                                            source={{ uri: serviceImageUri }}
                                            style={styles.serviceImageHero}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={[styles.serviceImagePlaceholderLarge, { backgroundColor: theme.border }]}>
                                            <Ionicons name="briefcase-outline" size={36} color={theme.textLight} />
                                        </View>
                                    )}
                                    <View style={styles.serviceCardBody}>
                                        <Text style={[styles.serviceNameLarge, { color: theme.text }]}>{svc.name}</Text>
                                        {svc.description ? (
                                            <Text style={[styles.serviceDescLarge, { color: theme.textLight }]} numberOfLines={4}>
                                                {svc.description}
                                            </Text>
                                        ) : null}
                                        {(svc.price_amount != null || svc.base_price != null) && (
                                            <Text style={[styles.servicePriceLarge, { color: colors.primary }]}>
                                                ₹{Number(svc.price_amount ?? svc.base_price).toLocaleString('en-IN')}
                                                {svc.price_unit ? ` / ${svc.price_unit}` : ''}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <BottomTabBar navigation={navigation} activeRoute="Home" />

            {/* Above tab bar in z-order; bottom offset clears tab strip */}
            <View
                style={[
                    styles.bottomBar,
                    {
                        backgroundColor: theme.card,
                        borderTopColor: theme.border,
                        bottom: tabBarOffset,
                        zIndex: 50,
                    },
                ]}
            >
                <TouchableOpacity style={styles.enquireBtn} onPress={() => setEnquiryVisible(true)}>
                    <LinearGradient
                        colors={['#FF7A00', '#FFA040']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.enquireBtnGradient}
                    >
                        <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
                        <Text style={styles.enquireBtnText}>Send Enquiry</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Enquiry Modal */}
            <Modal visible={enquiryVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>
                                Enquiry for {vendor.business_name}
                            </Text>
                            <TouchableOpacity onPress={() => setEnquiryVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Name */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.text }]}>Your Name *</Text>
                                <TextInput
                                    style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                                    placeholder="Enter your name"
                                    placeholderTextColor={theme.textLight}
                                    value={enquiryData.name}
                                    onChangeText={(text) => setEnquiryData({ ...enquiryData, name: text })}
                                />
                            </View>

                            {/* Phone */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number *</Text>
                                <TextInput
                                    style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                                    placeholder="10-digit mobile number"
                                    placeholderTextColor={theme.textLight}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    value={enquiryData.phone}
                                    onChangeText={(text) => setEnquiryData({ ...enquiryData, phone: text })}
                                />
                            </View>

                            {/* Event Date */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.text }]}>Event Date</Text>
                                <TouchableOpacity
                                    style={[styles.dateBtn, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                                    <Text style={[styles.dateText, { color: theme.text }]}>
                                        {enquiryData.eventDate.toDateString()}
                                    </Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={enquiryData.eventDate}
                                        mode="date"
                                        display="default"
                                        minimumDate={new Date()}
                                        onChange={onDateChange}
                                    />
                                )}
                            </View>

                            {/* Event Type */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.text }]}>Event Type</Text>
                                <TextInput
                                    style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                                    placeholder="e.g., Wedding, Birthday, Corporate"
                                    placeholderTextColor={theme.textLight}
                                    value={enquiryData.eventType}
                                    onChangeText={(text) => setEnquiryData({ ...enquiryData, eventType: text })}
                                />
                            </View>

                            {/* Message */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.text }]}>Your Message</Text>
                                <TextInput
                                    style={[styles.textArea, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                                    placeholder="Tell us about your requirements..."
                                    placeholderTextColor={theme.textLight}
                                    multiline
                                    numberOfLines={4}
                                    value={enquiryData.message}
                                    onChangeText={(text) => setEnquiryData({ ...enquiryData, message: text })}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Button
                                title={loading ? "Sending..." : "Send Enquiry"}
                                onPress={handleSubmitEnquiry}
                                loading={loading}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingBottom: 8,
    },
    vendorHeader: {
        padding: 24,
        alignItems: 'center',
    },
    vendorLogoContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    vendorLogo: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFF',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 2,
    },
    vendorName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        textAlign: 'center',
    },
    vendorCategory: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    locationText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        marginHorizontal: 16,
        marginTop: -20,
        borderRadius: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    actionBtn: {
        alignItems: 'center',
    },
    actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '500',
    },
    section: {
        margin: 16,
        marginTop: 0,
        padding: 16,
        borderRadius: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    descriptionText: {
        fontSize: 14,
        lineHeight: 22,
    },
    galleryListContent: {
        paddingVertical: 4,
        gap: 10,
    },
    galleryThumb: {
        width: 160,
        height: 120,
        borderRadius: 12,
        marginRight: 10,
        backgroundColor: '#E5E7EB',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
    },
    contactText: {
        fontSize: 14,
        flex: 1,
    },
    serviceCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
    },
    serviceImageHero: {
        width: '100%',
        height: 168,
        backgroundColor: '#E8E8E8',
    },
    serviceImagePlaceholderLarge: {
        width: '100%',
        height: 168,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceCardBody: {
        padding: 16,
    },
    serviceNameLarge: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    serviceDescLarge: {
        fontSize: 14,
        marginTop: 8,
        lineHeight: 21,
    },
    servicePriceLarge: {
        fontSize: 17,
        fontWeight: '700',
        marginTop: 12,
    },
    bottomBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.12,
                shadowRadius: 8,
            },
            android: { elevation: 12 },
        }),
    },
    enquireBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    enquireBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    enquireBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        fontSize: 18,
        marginVertical: 16,
    },
    authGateContainer: {
        flex: 1,
        margin: 16,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    authGateLogo: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f0f0f0',
        marginBottom: 16,
    },
    authGateName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'center',
    },
    authGateCategory: {
        fontSize: 14,
        marginBottom: 16,
    },
    authGateMessage: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    modalBody: {
        padding: 20,
        maxHeight: 400,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    textInput: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 15,
    },
    textArea: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    dateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
    },
    dateText: {
        fontSize: 15,
    },
    modalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
});
