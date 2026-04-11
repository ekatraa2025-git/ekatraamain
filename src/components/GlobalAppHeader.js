import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeaderActions from './AppHeaderActions';
import Logo from './Logo';
import { useTheme } from '../context/ThemeContext';

/** Floating language + cart — parent sets visibility by route. */
export default function GlobalAppHeader({ visible }) {
    const insets = useSafeAreaInsets();
    const { isDarkMode } = useTheme();
    if (!visible) return null;
    return (
        <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
            <View style={styles.inner} pointerEvents="box-none">
                <View
                    style={[
                        styles.logoChip,
                        { backgroundColor: isDarkMode ? '#1F2333' : '#FFFFFF' },
                    ]}
                    pointerEvents="none"
                >
                    <Logo width={26} height={26} />
                </View>
                <AppHeaderActions />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 2000,
        elevation: 2000,
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'box-none',
    },
    logoChip: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
});
