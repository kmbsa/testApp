import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { API_URL } from '@env';
import Styles from '../styles/styles';
import type { RootStackNavigationProp } from '../navigation/types';

function ForgotPasswordOTP() {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<any>();

  const email = route.params?.email || '';

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

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }

    if (otp.length !== 6) {
      Alert.alert('Error', 'Verification code must be 6 digits.');
      return;
    }

    setIsLoading(true);
    try {
      // Just verify the OTP - don't reset password yet
      await axios.post(`${API_URL}/auth/forgot-password-verify-otp`, {
        email,
        otp,
      });

      // Navigate to password reset screen
      navigation.navigate('ForgotPasswordNewPassword', {
        email: email,
        otp: otp,
      });
    } catch (error: any) {
      console.error('OTP verification error:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Invalid verification code. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) {
      Alert.alert('Please Wait', `Try again in ${resendCooldown} seconds`);
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password-request`, {
        email,
      });

      Alert.alert('Success', 'New OTP sent to your email!');
      setOtp('');
      setTimeLeft(600); // Reset to 10 minutes
      setResendCooldown(60); // 60 second cooldown
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to resend OTP. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
                Reset Your Password
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
                  editable={!isLoading}
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
                onPress={handleVerifyOTP}
                disabled={isLoading || !otp}
                style={[Styles.button, isLoading && { opacity: 0.7 }]}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={Styles.buttonText.color}
                  />
                ) : (
                  <Text style={Styles.buttonText}>Verify Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={isLoading || resendCooldown > 0}
                style={[
                  Styles.button,
                  localStyles.resendButton,
                  (isLoading || resendCooldown > 0) && { opacity: 0.6 },
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

export default ForgotPasswordOTP;
