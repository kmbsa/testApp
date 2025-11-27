import React, { useState } from 'react';
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

  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<any>();

  const email = route.params?.email || '';

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
            <View style={Styles.fieldsContainer}>
              <Text style={Styles.text}>Verify Your Email</Text>

              <Text
                style={[
                  Styles.text,
                  { fontSize: 14, marginBottom: 20, color: '#666' },
                ]}
              >
                We sent a verification code to {email}. Please enter it below.
              </Text>

              <Text style={Styles.text}>Verification Code</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Enter 6-digit code"
                placeholderTextColor={Styles.inputFields.borderColor}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <View style={localStyles.buttonContainer}>
              <TouchableOpacity
                onPress={handleVerifyOTP}
                disabled={isLoading}
                style={[
                  Styles.button,
                  localStyles.verifyButton,
                  isLoading && { opacity: 0.7 },
                ]}
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
  buttonContainer: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButton: {},
  backLinkContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});

export default ForgotPasswordOTP;
