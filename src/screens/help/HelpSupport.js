import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import BottomTabBar from '../../components/BottomTabBar';

const FAQ = [
    { q: 'How do I place an order?', a: 'Select an occasion, choose categories, pick services with pricing tiers, fill your event details, and add to cart. Then proceed to checkout.' },
    { q: 'Can I cancel an order?', a: 'Yes, you can request cancellation from the My Orders section. Our team will review and process it.' },
    { q: 'How are vendors selected?', a: 'All vendors on eKatRaa are verified and curated based on quality, reliability, and customer feedback.' },
    { q: 'What payment methods are accepted?', a: 'Pay 20% advance online (UPI, cards, net banking) or choose Cash on Order Finalization—pay after vendors confirm pricing and details.' },
    { q: 'How do I track my order?', a: 'Go to My Orders to view real-time status updates on all your orders.' },
];

export default function HelpSupport({ navigation }) {
    const { theme, isDarkMode } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Help & Support</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Contact Us</Text>

                    <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: colors.primary + '10' }]}
                        onPress={() => Linking.openURL('tel:+919876543210')}
                    >
                        <Ionicons name="call-outline" size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.contactLabel, { color: theme.text }]}>Call Us</Text>
                            <Text style={[styles.contactValue, { color: theme.textLight }]}>+91 98765 43210</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: colors.primary + '10' }]}
                        onPress={() => Linking.openURL('mailto:support@ekatraa.com')}
                    >
                        <Ionicons name="mail-outline" size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.contactLabel, { color: theme.text }]}>Email Us</Text>
                            <Text style={[styles.contactValue, { color: theme.textLight }]}>support@ekatraa.com</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: '#25D366' + '15' }]}
                        onPress={() => Linking.openURL('https://wa.me/919876543210')}
                    >
                        <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.contactLabel, { color: theme.text }]}>WhatsApp</Text>
                            <Text style={[styles.contactValue, { color: theme.textLight }]}>Chat with us</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Frequently Asked Questions</Text>
                    {FAQ.map((item, idx) => (
                        <View key={idx} style={[styles.faqItem, idx < FAQ.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                            <Text style={[styles.faqQ, { color: theme.text }]}>{item.q}</Text>
                            <Text style={[styles.faqA, { color: theme.textLight }]}>{item.a}</Text>
                        </View>
                    ))}
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
            <BottomTabBar navigation={navigation} activeRoute="About" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    scroll: { padding: 16, paddingBottom: 40 },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
    },
    contactLabel: { fontSize: 15, fontWeight: '600' },
    contactValue: { fontSize: 13, marginTop: 2 },
    faqItem: { paddingVertical: 14 },
    faqQ: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
    faqA: { fontSize: 13, lineHeight: 20 },
});
