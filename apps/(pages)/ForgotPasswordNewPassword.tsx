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
import { CommonActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { API_URL } from '@env';
import Styles from '../styles/styles';
import type { RootStackNavigationProp } from '../navigation/types';

function ForgotPasswordNewPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<any>();

  const email = route.params?.email || '';
  const otp = route.params?.otp || '';

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password-reset`, {
        email,
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      Alert.alert('Success', 'Your password has been reset successfully.', [
        {
          text: 'OK',
          onPress: () => {
            // Reset navigation stack to AuthTabs (root of unauthenticated stack)
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'AuthTabs' } as any],
              }),
            );
          },
        },
      ]);
    } catch (error: any) {
      console.error('Password reset error:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to reset password. Please try again.';
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
              <Text style={Styles.text}>Create New Password</Text>

              <Text
                style={[
                  Styles.text,
                  { fontSize: 14, marginBottom: 20, color: '#666' },
                ]}
              >
                Enter your new password below. Make sure it's at least 6
                characters long.
              </Text>

              <Text style={Styles.text}>New Password</Text>
              <View style={localStyles.passwordContainer}>
                <TextInput
                  style={[Styles.inputFields, localStyles.passwordInput]}
                  placeholder="Enter new password"
                  placeholderTextColor={Styles.inputFields.borderColor}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  style={localStyles.toggleButton}
                >
                  <Text style={localStyles.toggleText}>
                    {showNewPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[Styles.text, { marginTop: 15 }]}>
                Confirm Password
              </Text>
              <View style={localStyles.passwordContainer}>
                <TextInput
                  style={[Styles.inputFields, localStyles.passwordInput]}
                  placeholder="Confirm new password"
                  placeholderTextColor={Styles.inputFields.borderColor}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={localStyles.toggleButton}
                >
                  <Text style={localStyles.toggleText}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={localStyles.buttonContainer}>
              <TouchableOpacity
                onPress={handleResetPassword}
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
                  <Text style={Styles.buttonText}>Reset Password</Text>
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInput: {
    flex: 1,
    marginRight: 0,
  },
  toggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
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

export default ForgotPasswordNewPassword;
