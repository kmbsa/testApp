import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; // Assuming you have expo vector icons installed
import { useAuth } from '../../../context/AuthContext';
import Styles from '../../../styles/styles'; // Assuming Styles has a basic structure for text, buttons, and input fields

// Segmented control data for 'sex' is now defined for radio buttons
const SEX_OPTIONS = ['Male', 'Female'];

const AccountSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { userData, updateUserData, updateUserCredentials } = useAuth();
  const navigation = useNavigation();

  // --- State for Personal Data (Initialized from userData) ---
  const [firstName, setFirstName] = useState(userData?.first_name || '');
  const [lastName, setLastName] = useState(userData?.last_name || '');
  const [sex, setSex] = useState(userData?.sex || SEX_OPTIONS[0]);
  const [contactNumber, setContactNumber] = useState(
    userData?.contact_no || '',
  );
  const [dataLoading, setDataLoading] = useState(false);

  // --- State for Credentials (Email pre-filled, Password empty) ---
  const [email, setEmail] = useState(userData?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credentialsLoading, setCredentialsLoading] = useState(false);

  // --- Dynamic Field Initialization ---
  // Ensure state updates if userData is fetched/refreshed after component mounts
  useEffect(() => {
    if (userData) {
      setFirstName(userData.first_name || '');
      setLastName(userData.last_name || '');
      setSex(userData.sex || SEX_OPTIONS[0]);
      setContactNumber(userData.contact_no || '');
      setEmail(userData.email || '');
    }
  }, [userData]);

  // --- Handlers ---

  const validatePersonalDataChange = (): boolean => {
    if (!userData) {
      Alert.alert('Error', 'User data not loaded. Please try again.');
      return false;
    }
    if (!firstName || !lastName || !contactNumber || !email) {
      Alert.alert(
        'Missing Fields',
        'Please ensure all personal fields are filled.',
      );
      return false;
    }
    // Check if anything actually changed
    if (
      firstName === userData.first_name &&
      lastName === userData.last_name &&
      sex === userData.sex &&
      contactNumber === userData.contact_no
    ) {
      Alert.alert('No Change', 'Personal data is already up-to-date.');
      return false;
    }
    return true;
  };

  const confirmUpdateData = () => {
    if (!validatePersonalDataChange()) return;

    Alert.alert(
      'Confirm Data Change',
      'Are you sure you want to update your personal data?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Update',
          onPress: handleUpdateData,
          style: 'default',
        },
      ],
    );
  };

  const handleUpdateData = async () => {
    setDataLoading(true);
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        sex: sex,
        contact_no: contactNumber,
      };

      await updateUserData(payload); // Call the function from AuthContext

      Alert.alert('Success', 'Personal data updated successfully!');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message ||
          'Failed to update personal data. Please check your network and try again.',
      );
    } finally {
      setDataLoading(false);
    }
  };

  const validateCredentialsChange = (): boolean => {
    if (!userData) {
      Alert.alert('Error', 'User data not loaded. Please try again.');
      return false;
    }

    const emailChanged = email !== userData.email;
    const passwordEntered = newPassword.length > 0;

    if (!emailChanged && !passwordEntered) {
      Alert.alert(
        'No Change',
        'Enter a new email or password to update credentials.',
      );
      return false;
    }

    if (passwordEntered) {
      if (newPassword.length < 6) {
        // Enforce a minimum length
        Alert.alert(
          'Invalid Password',
          'Password must be at least 6 characters.',
        );
        return false;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert(
          'Password Mismatch',
          'New password and confirmation do not match.',
        );
        return false;
      }
    }
    return true;
  };

  const confirmUpdateCredentials = () => {
    if (!validateCredentialsChange()) return;

    Alert.alert(
      'Confirm Credentials Change',
      'Are you sure you want to update your credentials (Email/Password)?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Update',
          onPress: handleUpdateCredentials,
          style: 'destructive',
        },
      ],
    );
  };

  const handleUpdateCredentials = async () => {
    setCredentialsLoading(true);
    try {
      const payload = { email: email, new_password: newPassword };
      const emailChanged = email !== userData?.email;
      const passwordEntered = newPassword.length > 0;

      if (emailChanged) {
        payload.email = email;
      }
      if (passwordEntered) {
        payload.new_password = newPassword;
      }

      await updateUserCredentials(payload); // Call the function from AuthContext

      Alert.alert('Success', 'Credentials updated successfully!');
      // Clear password fields after success
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to update credentials. Please try again.',
      );
    } finally {
      setCredentialsLoading(false);
    }
  };

  // --- Render Sections ---

  const renderSectionTitle = (title: string) => (
    <View style={localStyles.sectionHeader}>
      <Text style={localStyles.sectionTitle}>{title}</Text>
    </View>
  );

  // Re-usable Radio Button component styles derived from Register.tsx logic
  const renderSexRadioButtons = () => (
    <View style={localStyles.radioButtonGroupContainer}>
      {SEX_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option}
          style={localStyles.radioButton}
          onPress={() => setSex(option)}
        >
          <View style={localStyles.radioButtonOuterCircle}>
            {sex === option && (
              <View style={localStyles.radioButtonInnerCircle} />
            )}
          </View>
          <Text style={localStyles.radioButtonLabel}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPersonalData = () => (
    <View style={localStyles.sectionContainer}>
      {renderSectionTitle('Personal Data')}

      {/* First Name */}
      <Text style={Styles.text}>First Name</Text>
      <TextInput
        style={[Styles.inputFields, localStyles.fullWidthInput]}
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First Name"
      />

      {/* Last Name */}
      <Text style={Styles.text}>Last Name</Text>
      <TextInput
        style={[Styles.inputFields, localStyles.fullWidthInput]}
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last Name"
      />

      {/* Sex (Radio Buttons) */}
      <Text style={Styles.text}>Sex</Text>
      {renderSexRadioButtons()}

      {/* Contact Number */}
      <Text style={Styles.text}>Contact Number</Text>
      <TextInput
        style={[Styles.inputFields, localStyles.fullWidthInput]}
        value={contactNumber}
        onChangeText={setContactNumber}
        placeholder="Contact Number (e.g., 09xxxxxxxxx)"
        keyboardType="phone-pad"
        maxLength={11}
      />

      <TouchableOpacity
        style={[
          Styles.button,
          localStyles.updateButton,
          localStyles.fullWidthButton,
        ]}
        onPress={confirmUpdateData}
        disabled={dataLoading}
      >
        {dataLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={Styles.buttonText}>Save Personal Data</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCredentials = () => (
    <View style={[localStyles.sectionContainer, { marginTop: 30 }]}>
      {renderSectionTitle('Credentials')}

      {/* Email */}
      <Text style={Styles.text}>Email</Text>
      <TextInput
        style={[Styles.inputFields, localStyles.fullWidthInput]}
        value={email}
        onChangeText={setEmail}
        placeholder="Email Address"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* New Password */}
      <Text style={Styles.text}>New Password</Text>
      <TextInput
        style={[Styles.inputFields, localStyles.fullWidthInput]}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="New Password (min 6 characters)"
        secureTextEntry
        autoCapitalize="none"
      />

      {/* Confirm Password */}
      <Text style={Styles.text}>Confirm New Password</Text>
      <TextInput
        style={[Styles.inputFields, localStyles.fullWidthInput]}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm New Password"
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[
          Styles.button,
          localStyles.updateButton,
          localStyles.credentialsButton,
          localStyles.fullWidthButton,
        ]}
        onPress={confirmUpdateCredentials}
        disabled={credentialsLoading}
      >
        {credentialsLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={Styles.buttonText}>Save Credentials</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[Styles.container, { paddingTop: insets.top }]}>
      {/* Custom Header with Back Button */}
      <View style={localStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={localStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
        </TouchableOpacity>
        <Text style={localStyles.screenTitle}>Account Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={localStyles.scrollContainer}
        contentContainerStyle={localStyles.contentContainer}
      >
        {userData ? (
          <>
            {renderPersonalData()}
            {renderCredentials()}
          </>
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Styles.text.color} />
            <Text style={[Styles.text, { marginTop: 10 }]}>
              Loading user data...
            </Text>
          </View>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
};

// --- Local Styles ---
const localStyles = StyleSheet.create({
  // New Header/Back Button Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    paddingRight: 15,
  },
  screenTitle: {
    fontSize: 24, // Adjusted from 28 to fit with header better
    fontWeight: 'bold',
    color: Styles.text?.color || '#000',
    flex: 1,
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionContainer: {
    backgroundColor: Styles.formBox?.backgroundColor || '#fff',
    borderRadius: 10,
    padding: 15,
    width: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  sectionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Styles.text?.color || '#000',
  },
  updateButton: {
    marginTop: 20,
    backgroundColor: '#F4D03F',
  },
  credentialsButton: {
    backgroundColor: '#F4D03F',
  },
  fullWidthInput: {
    width: '100%',
    marginBottom: 10,
  },
  fullWidthButton: {
    width: '100%',
    alignSelf: 'center',
  },
  radioButtonGroupContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    justifyContent: 'flex-start',
    width: '100%',
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 5,
  },
  radioButtonOuterCircle: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F4D03F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInnerCircle: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#F4D03F',
  },
  radioButtonLabel: {
    marginLeft: 8,
    fontSize: 16,
    color: Styles.text?.color || '#000',
  },
});

export default AccountSettingsScreen;
