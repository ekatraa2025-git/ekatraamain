import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Alert, Modal, TextInput, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { dbService, getVendorImageUrl } from '../../services/supabase';
import { Button } from '../../components/Button';

export default function VendorDetail({ route, navigation }) {
    const { vendor, city, openEnquiry } = route.params || {};
    const { theme, isDarkMode } = useTheme();
    const { user, isAuthenticated } = useAuth();

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

    const handleCall = () => {
        if (vendor.phone) {
            Linking.openURL(`tel:${vendor.phone}`);
        } else {
            Alert.alert('No phone number', 'Phone number not available for this vendor.');
        }
    };

    const handleEmail = () => {
        if (vendor.email) {
            Linking.openURL(`mailto:${vendor.email}`);
        }
    };

    const handleSubmitEnquiry = async () => {
        // Validation
        if (!enquiryData.name.trim()) {
            Alert.alert('Required', 'Please enter your name.');
            return;
        }
        if (!enquiryData.phone.trim() || enquiryData.phone.replace(/\D/g, '').length < 10) {
            Alert.alert('Required', 'Please enter a valid phone number.');
            return;
        }

        // Check login
        if (!isAuthenticated) {
            Alert.alert(
                'Login Required',
                'Please login to submit your enquiry.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Login', onPress: () => { setEnquiryVisible(false); navigation.navigate('Login'); } }
                ]
            );
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

            Alert.alert(
                'Enquiry Sent! 🎉',
                `Your enquiry has been sent to ${vendor.business_name}. They will contact you soon.`,
                [{ text: 'OK', onPress: () => setEnquiryVisible(false) }]
            );

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
            Alert.alert('Error', 'Failed to send enquiry. Please try again.');
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
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Vendor Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Vendor Header Card */}
                <LinearGradient
                    colors={['#FF4117', '#FF6B35', '#FF8C42']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.vendorHeader}
                >
                    <View style={styles.vendorLogoContainer}>
                        <Image
                            source={{ uri: getVendorImageUrl(vendor.logo_url, vendor.business_name) }}
                            style={styles.vendorLogo}
                        />
                        {vendor.is_verified && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.vendorName}>{vendor.business_name || 'Vendor'}</Text>
                    <Text style={styles.vendorCategory}>{vendor.category || 'Service Provider'}</Text>
                    {vendor.city && (
                        <View style={styles.locationRow}>
                            <Ionicons name="location" size={14} color="rgba(255,255,255,0.9)" />
                            <Text style={styles.locationText}>{vendor.city}</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* Quick Actions */}
                <View style={[styles.actionsRow, { backgroundColor: theme.card }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                        <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                            <Ionicons name="call" size={22} color="#4CAF50" />
                        </View>
                        <Text style={[styles.actionText, { color: theme.text }]}>Call</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionBtn} onPress={handleEmail}>
                        <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                            <Ionicons name="mail" size={22} color="#2196F3" />
                        </View>
                        <Text style={[styles.actionText, { color: theme.text }]}>Email</Text>
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

                {/* Contact Details */}
                <View style={[styles.section, { backgroundColor: theme.card }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Details</Text>
                    
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
                    
                    {vendor.address && (
                        <View style={styles.contactRow}>
                            <Ionicons name="location-outline" size={20} color={colors.primary} />
                            <Text style={[styles.contactText, { color: theme.text }]}>{vendor.address}</Text>
                        </View>
                    )}
                </View>

                {/* Services */}
                {vendor.services && vendor.services.length > 0 && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Services Offered</Text>
                        {vendor.services.map((svc, idx) => (
                            <View key={idx} style={[styles.serviceItem, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.serviceName, { color: theme.text }]}>{svc.name}</Text>
                                {svc.price_amount && (
                                    <Text style={[styles.servicePrice, { color: colors.primary }]}>
                                        ₹{svc.price_amount.toLocaleString('en-IN')}
                                        {svc.price_unit && ` / ${svc.price_unit}`}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Bottom Spacer */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Fixed Bottom Button */}
            <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                <TouchableOpacity style={styles.enquireBtn} onPress={() => setEnquiryVisible(true)}>
                    <LinearGradient
                        colors={['#FF4117', '#FF6B35']}
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
        paddingBottom: 20,
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
    serviceItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    serviceName: {
        fontSize: 14,
        flex: 1,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: '600',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        borderTopWidth: 1,
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
