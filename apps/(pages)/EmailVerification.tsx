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
    safeArea: {
      flex: 1,
    },
    keyboardAvoidingView: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
    },
    scrollViewContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 20,
      width: '100%',
    },
    formBox: {
      width: 350,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    otpInputWrapper: {
      alignItems: 'center',
      marginBottom: 16,
    },
    otpInput: {
      width: 300,
      backgroundColor: '#F5F5F5',
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 8,
      padding: 12,
      fontSize: 20,
      letterSpacing: 4,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    timerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 0,
    },
    timerText: {
      fontSize: 12,
      fontWeight: '600',
    },
    buttonContainer: {
      marginTop: 20,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    resendButton: {
      backgroundColor: '#F4D03F',
    },
    backLinkContainer: {
      marginTop: 20,
      alignItems: 'center',
    },
  });

  return (
    <SafeAreaView style={[Styles.container, localStyles.safeArea]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={localStyles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={localStyles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[Styles.formBox, localStyles.formBox]}>
            <View style={[Styles.fieldsContainer, { alignItems: 'center' }]}>
              <Text style={[Styles.text, { textAlign: 'center' }]}>
                Verify Your Email
              </Text>

              <Text
                style={[
                  Styles.text,
                  {
                    fontSize: 14,
                    marginBottom: 4,
                    color: '#999',
                    textAlign: 'center',
                  },
                ]}
              >
                We sent a verification code to
              </Text>

              <Text
                style={[
                  Styles.text,
                  {
                    fontSize: 15,
                    marginBottom: 4,
                    marginTop: 4,
                    color: '#DBD76A',
                    fontWeight: '700',
                    textAlign: 'center',
                  },
                ]}
              >
                {email}
              </Text>

              <Text
                style={[
                  Styles.text,
                  {
                    fontSize: 14,
                    marginBottom: 20,
                    color: '#999',
                    textAlign: 'center',
                  },
                ]}
              >
                Please enter it below.
              </Text>

              <Text
                style={[Styles.text, { textAlign: 'center', marginBottom: 16 }]}
              >
                Verification Code
              </Text>

              <View style={localStyles.otpInputWrapper}>
                <TextInput
                  style={[localStyles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#CCC"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="numeric"
                  maxLength={6}
                  editable={!loading}
                />
              </View>

              <View style={localStyles.timerContainer}>
                <Text
                  style={[
                    localStyles.timerText,
                    { color: timeLeft < 60 ? '#D32F2F' : '#999' },
                  ]}
                >
                  OTP expires in: {formatTime(timeLeft)}
                </Text>
              </View>
            </View>

            <View style={localStyles.buttonContainer}>
              <TouchableOpacity
                onPress={handleVerifyEmail}
                disabled={loading || !otp}
                style={[Styles.button, loading && { opacity: 0.7 }]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={Styles.buttonText.color}
                  />
                ) : (
                  <Text style={Styles.buttonText}>Verify Email</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={loading || resendCooldown > 0}
                style={[
                  Styles.button,
                  localStyles.resendButton,
                  (loading || resendCooldown > 0) && { opacity: 0.6 },
                ]}
              >
                <Text style={[Styles.buttonText, { color: '#333' }]}>
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={localStyles.backLinkContainer}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={Styles.register}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

export default EmailVerification;
