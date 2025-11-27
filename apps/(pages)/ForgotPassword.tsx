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
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { API_URL } from '@env';
import Styles from '../styles/styles';
import type { RootStackNavigationProp } from '../navigation/types';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigation = useNavigation<RootStackNavigationProp>();

  const handleRequestReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/auth/forgot-password-request`,
        {
          email: email.toLowerCase(),
        },
      );

      // Navigate to OTP verification screen
      Alert.alert('Success', response.data.message, [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('ForgotPasswordOTP', {
              email: email.toLowerCase(),
            });
          },
        },
      ]);
    } catch (error: any) {
      console.error('Forgot password request error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'An error occurred. Please try again.',
      );
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
              <Text style={Styles.text}>Reset Password</Text>

              <Text
                style={[
                  Styles.text,
                  { fontSize: 14, marginBottom: 20, color: '#666' },
                ]}
              >
                Enter your email address and we'll send you a code to reset your
                password.
              </Text>

              <Text style={Styles.text}>Email Address</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Enter your email"
                placeholderTextColor={Styles.inputFields.borderColor}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={localStyles.buttonContainer}>
              <TouchableOpacity
                onPress={handleRequestReset}
                disabled={isLoading}
                style={[
                  Styles.button,
                  localStyles.resetButton,
                  isLoading && { opacity: 0.7 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={Styles.buttonText.color}
                  />
                ) : (
                  <Text style={Styles.buttonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={localStyles.backLinkContainer}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={Styles.register}>Back to Login</Text>
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
  resetButton: {},
  backLinkContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});

export default ForgotPassword;
