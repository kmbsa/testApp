import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { API_URL } from '@env';
import { SafeAreaView } from 'react-native-safe-area-context';
import Styles from '../styles/styles';
import type { RootStackNavigationProp } from '../navigation/types';

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phoneNumber: string): boolean => {
  const phoneRegex = /^\+?[0-9]+$/;
  return phoneRegex.test(phoneNumber);
};

function Register() {
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [sex, setSex] = useState<string | null>(null);
  const [contactNumber, setContactNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');

  const navigation = useNavigation<RootStackNavigationProp>();

  const handleRegistration = async () => {
    if (
      !firstName ||
      !lastName ||
      !password ||
      !confirmPassword ||
      !email ||
      !sex ||
      !contactNumber
    ) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Password Mismatch',
        'Please ensure the password and confirm password fields match.',
      );
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert(
        'Invalid Email Format',
        'Please enter a valid email address.',
      );
      return;
    }

    if (!validatePhoneNumber(contactNumber)) {
      Alert.alert(
        'Invalid Contact Number',
        'Please enter a valid contact number (digits only, optional leading +).',
      );
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/user`, {
        email: email.toLowerCase(),
        password: password,
        first_name: firstName,
        last_name: lastName,
        sex: sex,
        contact_no: contactNumber,
      });

      if (response.status === 201) {
        setFirstName('');
        setLastName('');
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setContactNumber('');
        setSex(null);

        Alert.alert('Success', 'You have successfully registered.', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]);
      } else {
        Alert.alert(
          'Registration Status',
          `Registration request completed with status: ${response.status}`,
        );
      }
    } catch (error: any) {
      console.error('Registration API error:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);

        if (error.response.status === 409) {
          Alert.alert(
            'Registration Failed',
            'Email Address is already registered.',
          );
        } else if (error.response.status === 400) {
          Alert.alert(
            'Registration Failed',
            'Invalid data provided. Please check your input.',
          );
          if (error.response.data && error.response.data.error) {
            Alert.alert('Invalid Input', error.response.data.error);
          }
        } else {
          Alert.alert(
            'Registration Failed',
            `Server responded with status ${error.response.status}.`,
          );
        }
      } else if (error.request) {
        console.error('Request error:', error.request);
        Alert.alert(
          'Network Error',
          'Could not connect to the server. Please check your internet connection and ensure the server is running.',
        );
      } else {
        console.error('Error message:', error.message);
        Alert.alert(
          'Unknown Error',
          `An unexpected error occurred: ${error.message}`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const localStyles = StyleSheet.create({
    registerButtonContainer: {
      marginTop: 20,
      width: '100%',
      alignItems: 'center',
      alignContent: 'center',
      justifyContent: 'center',
    },
    registerButton: {
      width: 300,
    },
  });

  return (
    <SafeAreaView style={Styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, width: '100%', alignItems: 'center' }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            paddingHorizontal: 20,
            paddingVertical: 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[Styles.formBox, Styles.responsiveFormContainer]}>
            <View style={Styles.fieldsContainer}>
              <Text style={Styles.text}>Registration Form</Text>
              <StatusBar style="auto" />

              <Text style={Styles.text}>First Name:</Text>
              <TextInput
                placeholder="First Name"
                placeholderTextColor={Styles.inputFields.borderColor}
                style={Styles.inputFields}
                onChangeText={setFirstName}
                value={firstName}
              />

              <Text style={Styles.text}>Last Name:</Text>
              <TextInput
                placeholder="Last Name"
                placeholderTextColor={Styles.inputFields.borderColor}
                style={Styles.inputFields}
                onChangeText={setLastName}
                value={lastName}
              />

              <Text style={Styles.text}>Password:</Text>
              <TextInput
                placeholder="Password"
                placeholderTextColor={Styles.inputFields.borderColor}
                style={Styles.inputFields}
                onChangeText={setPassword}
                value={password}
                secureTextEntry
              />

              <Text style={Styles.text}>Confirm Password:</Text>
              <TextInput
                placeholder="Confirm Password"
                placeholderTextColor={Styles.inputFields.borderColor}
                style={Styles.inputFields}
                onChangeText={setConfirmPassword}
                value={confirmPassword}
                secureTextEntry
              />

              <Text style={Styles.text}>Email Address:</Text>
              <TextInput
                placeholder="Email Address"
                placeholderTextColor={Styles.inputFields.borderColor}
                style={Styles.inputFields}
                onChangeText={setEmail}
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={Styles.text}>Contact Number:</Text>
              <TextInput
                placeholder="Contact Number"
                placeholderTextColor={Styles.inputFields.borderColor}
                style={Styles.inputFields}
                onChangeText={setContactNumber}
                value={contactNumber}
                keyboardType="phone-pad"
                maxLength={16}
              />

              <Text style={Styles.text}>Sex:</Text>
              <View style={Styles.radioButtonContainer}>
                <TouchableOpacity
                  style={Styles.radioButton}
                  onPress={() => setSex('Male')}
                >
                  <View style={Styles.radioButtonOuterCircle}>
                    {sex === 'Male' && (
                      <View style={Styles.radioButtonInnerCircle} />
                    )}
                  </View>
                  <Text style={Styles.radioButtonLabel}>Male</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={Styles.radioButton}
                  onPress={() => setSex('Female')}
                >
                  <View style={Styles.radioButtonOuterCircle}>
                    {sex === 'Female' && (
                      <View style={Styles.radioButtonInnerCircle} />
                    )}
                  </View>
                  <Text style={Styles.radioButtonLabel}>Female</Text>
                </TouchableOpacity>
              </View>

              <View style={localStyles.registerButtonContainer}>
                <TouchableOpacity
                  onPress={handleRegistration}
                  disabled={loading}
                  style={[
                    Styles.button,
                    localStyles.registerButton,
                    loading && { opacity: 0.7 },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator
                      size="small"
                      color={Styles.buttonText.color}
                    />
                  ) : (
                    <Text style={Styles.buttonText}>Register</Text>
                  )}
                </TouchableOpacity>
              </View>

              {loading && (
                <View
                  style={{
                    marginTop: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 300,
                  }}
                >
                  <ActivityIndicator size="large" color={Styles.text.color} />
                </View>
              )}

              <View
                style={{
                  width: 300,
                  marginTop: 20,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={Styles.registerText}>
                  Already have an account?
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={Styles.register}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default Register;
