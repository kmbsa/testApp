import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { API_URL } from '@env';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Styles from '../styles/styles';
import type { RootStackNavigationProp } from '../navigation/types';

interface RouteParams {
  user_id: number;
  email: string;
  first_name: string;
}

function EmailVerification() {
  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds
  const [canResend, setCanResend] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;

  const { user_id, email } = params;

  // Timer for OTP expiration
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyEmail = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP.');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/verify-email-register`,
        {
          user_id: user_id,
          otp: otp,
        },
      );

      if (response.status === 200) {
        const { access_token } = response.data;

        // Save token to AsyncStorage for AuthContext to pick up
        await AsyncStorage.setItem('access_token', access_token);

        // Alert and navigate back to auth stack (which will auto-login)
        Alert.alert('Success', 'Email verified! Your account is now active.', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to AuthTabs or trigger re-auth
              navigation.reset({
                index: 0,
                routes: [{ name: 'AuthTabs' }],
              });
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('Email verification error:', error);

      if (error.response) {
        const errorMsg = error.response.data?.error || 'Verification failed';
        const attemptsRemaining = error.response.data?.attempts_remaining;

        if (attemptsRemaining !== undefined) {
          Alert.alert(
            'Invalid OTP',
            `${errorMsg}\nAttempts remaining: ${attemptsRemaining}`,
          );
        } else {
          Alert.alert('Verification Failed', errorMsg);
        }
      } else if (error.request) {
        Alert.alert(
          'Network Error',
          'Could not connect to the server. Please check your internet connection.',
        );
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) {
      Alert.alert('Please Wait', `Try again in ${resendCooldown} seconds`);
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/resend-email-otp-register`,
        {
          user_id: user_id,
        },
      );

      if (response.status === 200) {
        Alert.alert('Success', 'New OTP sent to your email!');
        setOtp('');
        setTimeLeft(600);
        setCanResend(false);
        setResendCooldown(60); // 60 second cooldown after resend
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);

      if (error.response) {
        Alert.alert(
          'Error',
          error.response.data?.error || 'Failed to resend OTP',
        );
      } else if (error.request) {
        Alert.alert(
          'Network Error',
          'Could not connect to the server. Please check your internet connection.',
        );
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const localStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: '#666',
      marginBottom: 8,
      textAlign: 'center',
    },
    emailText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#3D550C',
      textAlign: 'center',
      marginBottom: 20,
    },
    otpInputContainer: {
      marginBottom: 20,
    },
    otpInput: {
      backgroundColor: '#F5F5F5',
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 8,
      padding: 14,
      fontSize: 20,
      letterSpacing: 4,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    timerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    timerText: {
      fontSize: 14,
      color: timeLeft < 60 ? '#D32F2F' : '#666',
      fontWeight: '600',
    },
    buttonContainer: {
      gap: 12,
    },
    verifyButton: {
      backgroundColor: '#3D550C',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      opacity: loading || !otp ? 0.6 : 1,
    },
    verifyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resendButton: {
      backgroundColor: '#F4D03F',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      opacity: !canResend && resendCooldown === 0 ? 0.6 : 1,
    },
    resendButtonText: {
      color: '#333',
      fontSize: 14,
      fontWeight: '600',
    },
    loginLink: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 20,
      gap: 4,
    },
    loginLinkText: {
      fontSize: 14,
      color: '#666',
    },
    loginLinkButton: {
      fontSize: 14,
      color: '#3D550C',
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={Styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={localStyles.container}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={localStyles.card}>
            <StatusBar style="auto" />

            <Text style={localStyles.title}>Verify Your Email</Text>

            <Text style={localStyles.subtitle}>
              We've sent a 6-digit verification code to:
            </Text>

            <Text style={localStyles.emailText}>{email}</Text>

            <View style={localStyles.otpInputContainer}>
              <Text style={Styles.text}>Enter Verification Code:</Text>
              <TextInput
                placeholder="000000"
                placeholderTextColor="#CCC"
                style={localStyles.otpInput}
                onChangeText={setOtp}
                value={otp}
                keyboardType="numeric"
                maxLength={6}
                editable={!loading}
              />
            </View>

            <View style={localStyles.timerContainer}>
              <Text style={localStyles.timerText}>
                OTP expires in: {formatTime(timeLeft)}
              </Text>
            </View>

            <View style={localStyles.buttonContainer}>
              <TouchableOpacity
                style={localStyles.verifyButton}
                onPress={handleVerifyEmail}
                disabled={loading || !otp}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={localStyles.verifyButtonText}>Verify Email</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={localStyles.resendButton}
                onPress={handleResendOTP}
                disabled={loading || resendCooldown > 0}
              >
                <Text style={localStyles.resendButtonText}>
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={localStyles.loginLink}>
              <Text style={localStyles.loginLinkText}>Don't have a code?</Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={localStyles.loginLinkButton}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default EmailVerification;
