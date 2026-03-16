import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { colors } from '../theme/colors';

const TABS = [
    { key: 'Home', icon: 'home', iconOutline: 'home-outline', label: 'Home' },
    { key: 'MyOrders', icon: 'receipt', iconOutline: 'receipt-outline', label: 'Orders' },
    { key: 'Cart', icon: 'cart', iconOutline: 'cart-outline', label: 'Cart' },
    { key: 'About', icon: 'information-circle', iconOutline: 'information-circle-outline', label: 'About' },
    { key: 'Menu', icon: 'menu', iconOutline: 'menu-outline', label: 'More' },
];

export default function BottomTabBar({ navigation, activeRoute, cartItemCount: propCount }) {
    const { theme } = useTheme();
    const { cartItemCount: contextCount } = useCart();
    const cartItemCount = propCount ?? contextCount ?? 0;
    const insets = useSafeAreaInsets();

    const handlePress = (tab) => {
        if (tab.key === activeRoute) return;
        if (tab.key === 'Home') {
            navigation.navigate('Home');
        } else {
            navigation.navigate(tab.key);
        }
    };

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.card,
                borderTopColor: theme.border,
                paddingBottom: Math.max(insets.bottom, 6),
            },
        ]}>
            {TABS.map((tab) => {
                const isActive = tab.key === activeRoute || (tab.key === 'Home' && activeRoute === 'Home');
                const iconName = isActive ? tab.icon : tab.iconOutline;
                const iconColor = isActive ? colors.primary : theme.textLight;
                const showBadge = tab.key === 'Cart' && cartItemCount > 0;

                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.tab}
                        onPress={() => handlePress(tab)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.iconWrap}>
                            <Ionicons name={iconName} size={24} color={iconColor} />
                            {showBadge && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{cartItemCount > 99 ? '99+' : cartItemCount}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.label, { color: iconColor }, isActive && styles.labelActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingTop: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    iconWrap: {
        position: 'relative',
        marginBottom: 2,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -10,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#E11D48',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
    },
    label: {
        fontSize: 11,
        fontWeight: '500',
    },
    labelActive: {
        fontWeight: '700',
    },
});
