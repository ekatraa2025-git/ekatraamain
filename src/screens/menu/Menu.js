import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import BottomTabBar from '../../components/BottomTabBar';

export default function Menu({ navigation }) {
    const { isDarkMode, toggleTheme, theme } = useTheme();
    const { user, isAuthenticated, signOut } = useAuth();

    // Get user display info
    const getUserName = () => {
        if (!user) return 'Guest';
        return user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    };

    const getUserPhone = () => {
        if (!user) return '';
        return user.phone || user.user_metadata?.phone || '';
    };

    const getUserEmail = () => {
        if (!user) return '';
        return user.email || '';
    };

    const getUserAvatar = () => {
        if (user?.user_metadata?.avatar_url) {
            return user.user_metadata.avatar_url;
        }
        const name = getUserName();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FF7A00&color=fff&size=120`;
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
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Home' }],
                        });
                    }
                }
            ]
        );
    };

    const containerStyle = { flex: 1, backgroundColor: theme.background };
    const textStyle = { color: theme.text };
    const subTextStyle = { color: theme.textLight };
    const borderStyle = { borderBottomColor: theme.border };

    return (
        <SafeAreaView style={containerStyle} edges={['top', 'left', 'right']}>
            <View style={[styles.header, borderStyle]}>
                <Text style={[styles.title, textStyle]}>Menu</Text>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Home')} style={styles.closeBtn}>
                    <Ionicons name="close" size={28} color={theme.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Section */}
                {isAuthenticated ? (
                    <View style={styles.profileSection}>
                        <Image
                            source={{ uri: getUserAvatar() }}
                            style={styles.profileImage}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.profileName, textStyle]}>{getUserName()}</Text>
                            {getUserPhone() ? (
                                <Text style={[styles.profilePhone, subTextStyle]}>
                                    {getUserPhone().startsWith('+') ? getUserPhone() : `+91 ${getUserPhone()}`}
                                </Text>
                            ) : null}
                            {getUserEmail() ? (
                                <Text style={[styles.profileEmail, subTextStyle]} numberOfLines={1}>
                                    {getUserEmail()}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.loginPrompt}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <View style={[styles.guestAvatar, { backgroundColor: isDarkMode ? '#2D3142' : '#F3F4F6' }]}>
                            <Ionicons name="person-outline" size={32} color={theme.textLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.profileName, textStyle]}>Welcome, Guest</Text>
                            <Text style={[styles.loginText, { color: colors.primary }]}>
                                Tap to login →
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                {/* Settings */}
                <View style={[styles.menuItem, borderStyle]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="moon-outline" size={22} color={theme.text} style={{ marginRight: 10 }} />
                        <Text style={[styles.menuText, textStyle]}>Dark Mode</Text>
                    </View>
                    <Switch
                        value={isDarkMode}
                        onValueChange={toggleTheme}
                        trackColor={{ false: "#767577", true: colors.primary }}
                        thumbColor={isDarkMode ? colors.secondary : "#f4f3f4"}
                    />
                </View>

                <TouchableOpacity style={[styles.menuItem, borderStyle]} onPress={() => navigation.navigate('MyProfile')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="person-outline" size={22} color={theme.text} style={{ marginRight: 10 }} />
                        <Text style={[styles.menuText, textStyle]}>My Profile</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, borderStyle]} onPress={() => navigation.navigate('MyOrders')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="receipt-outline" size={22} color={theme.text} style={{ marginRight: 10 }} />
                        <Text style={[styles.menuText, textStyle]}>My Orders</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, borderStyle]} onPress={() => navigation.navigate('GuestManage')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="people-outline" size={22} color={theme.text} style={{ marginRight: 10 }} />
                        <Text style={[styles.menuText, textStyle]}>Guest Manager</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, borderStyle]} onPress={() => navigation.navigate('HelpSupport')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="help-circle-outline" size={22} color={theme.text} style={{ marginRight: 10 }} />
                        <Text style={[styles.menuText, textStyle]}>Help & Support</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, borderStyle]} onPress={() => navigation.navigate('About')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="information-circle-outline" size={22} color={theme.text} style={{ marginRight: 10 }} />
                        <Text style={[styles.menuText, textStyle]}>About</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                </TouchableOpacity>
            </ScrollView>

            {/* Footer actions */}
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
                {isAuthenticated ? (
                    <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: isDarkMode ? '#2D1012' : '#FEF2F2' }]}>
                        <Ionicons name="log-out-outline" size={20} color={theme.error} style={{ marginRight: 8 }} />
                        <Text style={[styles.logoutText, { color: theme.error }]}>Logout</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={[styles.loginBtn, { backgroundColor: colors.primary }]}>
                        <Ionicons name="log-in-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.loginBtnText}>Login / Sign Up</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.version}>v1.0.0</Text>
            </View>
            <BottomTabBar navigation={navigation} activeRoute="Menu" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    profileImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 16,
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    profilePhone: {
        fontSize: 14,
    },
    profileEmail: {
        fontSize: 12,
        marginTop: 2,
    },
    loginPrompt: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    guestAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    },
    loginBtn: {
        paddingVertical: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    loginBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    },
    divider: {
        height: 1,
        marginVertical: 20,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    menuText: {
        fontSize: 16,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    logoutBtn: {
        paddingVertical: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    version: {
        textAlign: 'center',
        marginTop: 10,
        color: '#ccc',
        fontSize: 12,
    }
});
