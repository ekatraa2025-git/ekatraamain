import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import BottomTabBar from '../../components/BottomTabBar';

export default function About({ navigation }) {
    const { theme, isDarkMode } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>About Ekatraa</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <LinearGradient
                    colors={[colors.primary + '15', colors.primary + '05']}
                    style={styles.heroCard}
                >
                    <View style={[styles.logoWrap, { backgroundColor: colors.primary }]}>
                        <Text style={styles.logoText}>eK</Text>
                    </View>
                    <Text style={[styles.appName, { color: theme.text }]}>Ekatraa</Text>
                    <Text style={[styles.tagline, { color: theme.textLight }]}>
                        Your one-stop platform for planning weddings, pujas, celebrations & all life events.
                    </Text>
                    <Text style={[styles.version, { color: theme.textLight }]}>Version 1.0.0</Text>
                </LinearGradient>

                <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>What We Do</Text>
                    <Text style={[styles.body, { color: theme.textLight }]}>
                        Ekatraa connects you with verified vendors for every occasion — from venue booking and catering to décor, photography, priests, and more. We make event planning effortless, so you can focus on making memories.
                    </Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Our Mission</Text>
                    <Text style={[styles.body, { color: theme.textLight }]}>
                        To simplify event planning across India by providing a curated marketplace of trusted service providers with transparent pricing.
                    </Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact</Text>
                    <TouchableOpacity
                        style={styles.contactRow}
                        onPress={() => Linking.openURL('mailto:support@ekatraa.com')}
                    >
                        <Ionicons name="mail-outline" size={18} color={colors.primary} />
                        <Text style={[styles.contactText, { color: colors.primary }]}>support@ekatraa.com</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.contactRow}
                        onPress={() => Linking.openURL('tel:+919876543210')}
                    >
                        <Ionicons name="call-outline" size={18} color={colors.primary} />
                        <Text style={[styles.contactText, { color: colors.primary }]}>+91 98765 43210</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.copyright, { color: theme.textLight }]}>
                    © 2025 Ekatraa. All rights reserved.
                </Text>
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
    scroll: { padding: 20 },
    heroCard: {
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        marginBottom: 20,
    },
    logoWrap: {
        width: 64,
        height: 64,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    logoText: { color: '#FFF', fontSize: 24, fontWeight: '900' },
    appName: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
    tagline: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 10 },
    version: { fontSize: 12 },
    infoCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 18,
        marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 22 },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
    },
    contactText: { fontSize: 14, fontWeight: '600' },
    copyright: { textAlign: 'center', fontSize: 12, marginTop: 20 },
});
