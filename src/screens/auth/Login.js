import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Logo from '../../components/Logo';

export default function Login({ navigation, route }) {
    const { theme } = useTheme();
    const { sendOtp, signInWithGoogle } = useAuth();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // Get redirect info if passed from booking flow
    const redirectAfterLogin = route?.params?.redirect;

    const handleSendOtp = async () => {
        // Validate phone
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        try {
            const result = await sendOtp(cleanPhone);
            if (result.success) {
                navigation.navigate('Otp', { 
                    phone: cleanPhone,
                    redirect: redirectAfterLogin,
                });
            } else {
                Alert.alert('Error', result.error || 'Failed to send OTP. Please try again.');
            }
        } catch (error) {
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            const result = await signInWithGoogle();
            if (result.success) {
                // Will be handled by auth state change
                if (redirectAfterLogin) {
                    navigation.navigate(redirectAfterLogin);
                } else {
                    navigation.replace('Home');
                }
            } else {
                Alert.alert('Error', result.error || 'Google sign-in failed. Please try again.');
            }
        } catch (error) {
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleSkip = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace('Home');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    {/* Header with close button */}
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Logo and Title */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Logo width={80} height={80} />
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>Welcome to eKatRaa</Text>
                        <Text style={[styles.subtitle, { color: theme.textLight }]}>
                            Sign in to book services and manage your events
                        </Text>
                    </View>

                    {/* Login Form */}
                    <View style={styles.form}>
                        <Input
                            label="Phone Number"
                            placeholder="Enter 10-digit mobile number"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            maxLength={10}
                            leftIcon={
                                <Text style={[styles.countryCode, { color: theme.text }]}>+91</Text>
                            }
                        />

                        <Button
                            title={loading ? "Sending OTP..." : "Continue with OTP"}
                            onPress={handleSendOtp}
                            loading={loading}
                            style={styles.otpButton}
                        />

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.dividerText, { color: theme.textLight }]}>OR</Text>
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        </View>

                        {/* Google Sign In */}
                        <TouchableOpacity
                            style={[styles.googleButton, { borderColor: theme.border }]}
                            onPress={handleGoogleSignIn}
                            disabled={googleLoading}
                        >
                            {googleLoading ? (
                                <ActivityIndicator color={theme.text} />
                            ) : (
                                <>
                                    <Ionicons name="logo-google" size={22} color="#DB4437" />
                                    <Text style={[styles.googleText, { color: theme.text }]}>
                                        Continue with Google
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textLight }]}>
                            By continuing, you agree to our{' '}
                            <Text style={[styles.link, { color: colors.primary }]}>Terms of Service</Text>
                            {' '}and{' '}
                            <Text style={[styles.link, { color: colors.primary }]}>Privacy Policy</Text>
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 10,
    },
    closeButton: {
        padding: 8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 22,
    },
    form: {
        flex: 1,
    },
    countryCode: {
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    otpButton: {
        marginTop: 20,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 30,
    },
    divider: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 16,
        fontSize: 14,
        fontWeight: '500',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 12,
    },
    googleText: {
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        marginBottom: 20,
    },
    footerText: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    link: {
        fontWeight: '600',
    },
});
