import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const OTP_LENGTH = 6;

export default function Otp({ navigation, route }) {
    const { theme } = useTheme();
    const { verifyOtp, sendOtp } = useAuth();
    const { phone, redirect } = route.params;
    
    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);
    const [canResend, setCanResend] = useState(false);
    
    const inputRefs = useRef([]);

    // Countdown timer for resend
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [resendTimer]);

    const handleOtpChange = (value, index) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all digits entered
        if (newOtp.every(digit => digit) && newOtp.length === OTP_LENGTH) {
            Keyboard.dismiss();
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpCode) => {
        const code = otpCode || otp.join('');
        if (code.length !== OTP_LENGTH) {
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const result = await verifyOtp(phone, code);
            if (result.success) {
                Alert.alert('Success', 'Login successful!', [
                    {
                        text: 'OK',
                        onPress: () => {
                            if (redirect) {
                                navigation.navigate(redirect);
                            } else {
                                navigation.replace('Home');
                            }
                        }
                    }
                ]);
            } else {
                Alert.alert('Error', result.error || 'Invalid OTP. Please try again.');
                setOtp(Array(OTP_LENGTH).fill(''));
                inputRefs.current[0]?.focus();
            }
        } catch (error) {
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;

        setCanResend(false);
        setResendTimer(30);
        setOtp(Array(OTP_LENGTH).fill(''));

        try {
            const result = await sendOtp(phone);
            if (result.success) {
                Alert.alert('OTP Sent', 'A new OTP has been sent to your phone.');
            } else {
                Alert.alert('Error', result.error || 'Failed to resend OTP.');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to resend OTP. Please try again.');
        }
    };

    const formatPhone = (phoneNumber) => {
        return `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Back Button */}
            <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Verify OTP</Text>
                <Text style={[styles.subtitle, { color: theme.textLight }]}>
                    Enter the 6-digit code sent to
                </Text>
                <Text style={[styles.phone, { color: colors.primary }]}>
                    {formatPhone(phone)}
                </Text>
            </View>

            {/* OTP Input */}
            <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                    <TextInput
                        key={index}
                        ref={ref => inputRefs.current[index] = ref}
                        style={[
                            styles.otpInput,
                            { 
                                backgroundColor: theme.inputBackground,
                                borderColor: digit ? colors.primary : theme.border,
                                color: theme.text,
                            }
                        ]}
                        value={digit}
                        onChangeText={value => handleOtpChange(value.slice(-1), index)}
                        onKeyPress={e => handleKeyPress(e, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                    />
                ))}
            </View>

            {/* Resend Timer */}
            <View style={styles.resendContainer}>
                {canResend ? (
                    <TouchableOpacity onPress={handleResend}>
                        <Text style={[styles.resendText, { color: colors.primary }]}>
                            Resend OTP
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={[styles.timerText, { color: theme.textLight }]}>
                        Resend OTP in {resendTimer}s
                    </Text>
                )}
            </View>

            {/* Verify Button */}
            <View style={styles.buttonContainer}>
                <Button
                    title={loading ? "Verifying..." : "Verify & Continue"}
                    onPress={() => handleVerify()}
                    loading={loading}
                    disabled={otp.some(d => !d)}
                />
            </View>

            {/* Change Number */}
            <TouchableOpacity 
                style={styles.changeNumber}
                onPress={() => navigation.goBack()}
            >
                <Text style={[styles.changeNumberText, { color: theme.textLight }]}>
                    Wrong number?{' '}
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>Change</Text>
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    backButton: {
        padding: 8,
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    header: {
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
    },
    phone: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    otpInput: {
        width: 50,
        height: 56,
        borderRadius: 12,
        borderWidth: 2,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    resendContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    resendText: {
        fontSize: 15,
        fontWeight: '600',
    },
    timerText: {
        fontSize: 15,
    },
    buttonContainer: {
        marginBottom: 20,
    },
    changeNumber: {
        alignItems: 'center',
    },
    changeNumberText: {
        fontSize: 14,
    },
});
