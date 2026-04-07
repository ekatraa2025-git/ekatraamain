import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeaderActions from './AppHeaderActions';

/** Floating language + cart — parent sets visibility by route. */
export default function GlobalAppHeader({ visible }) {
    if (!visible) return null;
    return (
        <View style={styles.wrap} pointerEvents="box-none">
            <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
                <View style={styles.inner} pointerEvents="box-none">
                    <View style={styles.spacer} />
                    <AppHeaderActions />
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2000,
        elevation: 2000,
    },
    safe: {
        pointerEvents: 'box-none',
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        pointerEvents: 'box-none',
    },
    spacer: {
        flex: 1,
    },
});
