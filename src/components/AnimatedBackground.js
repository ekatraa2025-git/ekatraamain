import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

// Elements to animate strings
const ELEMENTS = ['🔔', '🪔', '✨', '🐘', '🌺'];

const FloatingElement = ({ delay, duration, startX }) => {
    const translateY = useRef(new Animated.Value(height + 50)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const rotate = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            // Reset position
            translateY.setValue(height + 50);
            opacity.setValue(0);
            rotate.setValue(0);

            Animated.parallel([
                // Move Up
                Animated.timing(translateY, {
                    toValue: -100,
                    duration: duration,
                    useNativeDriver: true,
                    easing: Easing.linear,
                }),
                // Fade In/Out
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                    Animated.delay(duration - 2000),
                    Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
                ]),
                // Rotate
                Animated.loop(
                    Animated.timing(rotate, {
                        toValue: 1,
                        duration: 3000,
                        easing: Easing.linear,
                        useNativeDriver: true
                    })
                )
            ]).start(() => animate()); // Loop
        };

        const timeout = setTimeout(animate, delay);
        return () => clearTimeout(timeout);
    }, []);

    const spin = rotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    // Randomize element
    const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];

    return (
        <Animated.Text
            style={[
                styles.element,
                {
                    left: startX,
                    transform: [{ translateY }, { rotate: spin }],
                    opacity
                }
            ]}
        >
            {element}
        </Animated.Text>
    );
};

export const AnimatedBackground = ({ children }) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Background Animations */}
            <View style={styles.backgroundLayer} pointerEvents="none">
                {/* Generate varied floating elements */}
                <FloatingElement delay={0} duration={15000} startX={width * 0.1} />
                <FloatingElement delay={2000} duration={18000} startX={width * 0.3} />
                <FloatingElement delay={5000} duration={20000} startX={width * 0.5} />
                <FloatingElement delay={1000} duration={17000} startX={width * 0.7} />
                <FloatingElement delay={3000} duration={16000} startX={width * 0.9} />
                <FloatingElement delay={7000} duration={19000} startX={width * 0.2} />
                <FloatingElement delay={4000} duration={21000} startX={width * 0.8} />
            </View>

            {/* Main Content */}
            <View style={{ flex: 1, zIndex: 1 }}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backgroundLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },
    element: {
        position: 'absolute',
        fontSize: 24,
    }
});
