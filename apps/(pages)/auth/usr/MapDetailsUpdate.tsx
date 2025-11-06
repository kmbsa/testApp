import {
  KeyboardAvoidingView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import axios from 'axios';

// --- IMPORTS FROM YOUR PROJECT ---
import { API_URL } from '@env';
import { useAuth } from '../../../context/AuthContext';
import Styles from '../../../styles/styles';
import { AreaEntry, MapDetailsUpdateProps } from '../../../navigation/types';

const MapDetailsUpdate = () => {
  const navigation = useNavigation<MapDetailsUpdateProps['navigation']>();
  const route = useRoute<MapDetailsUpdateProps['route']>();

  const insets = useSafeAreaInsets();
  const { userToken, signOut } = useAuth();

  const areaId = route.params?.areaId;

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaData, setAreaData] = useState<AreaEntry | null>(null);

  const [areaName, setAreaName] = useState('');
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [organization, setOrganization] = useState('');
  const [slope, setSlope] = useState('');
  const [masl, setMasl] = useState('');
  const [hectares, setHectares] = useState('');

  const fetchAreaDetails = useCallback(async () => {
    if (!areaId) {
      setError('Area ID is missing.');
      setIsLoading(false);
      return;
    }
    if (!userToken) {
      setError('Authentication token is missing. Please log in.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/area/${areaId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        Alert.alert('Session Expired', 'Please log in again.');
        await signOut();
        return;
      }

      const data: { area: AreaEntry } = response.data;
      const fetchedArea = data.area;

      setAreaData(fetchedArea);

      setAreaName(fetchedArea.Area_Name || '');
      setRegion(fetchedArea.Region || '');
      setProvince(fetchedArea.Province || '');
      setOrganization(fetchedArea.Organization || '');

      const topographyData = fetchedArea.topography?.[0];

      setSlope(String(topographyData?.Slope || ''));
      setMasl(String(topographyData?.Mean_Average_Sea_Level || ''));

      setHectares(fetchedArea.Hectares || '');
    } catch (err: any) {
      console.error('Failed to fetch area details:', err);
      if (err.response?.status === 404) {
        setError('Area details not found.');
      } else {
        setError(
          err.response?.data?.message ||
            'Failed to load details. Check network or API.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [areaId, userToken, signOut]);

  useEffect(() => {
    fetchAreaDetails();
  }, [fetchAreaDetails]);

  // -----------------------------------------------------------
  // 2. Update Logic (FIXED: Explicit Number Conversion for Payload)
  // -----------------------------------------------------------
  const handleUpdate = async () => {
    if (isUpdating || !areaId || !userToken) return;

    setIsUpdating(true);
    setError(null);

    // Prepare ALL updated fields
    const updatedData = {
      Area_Name: areaName.trim(),
      Region: region.trim(),
      Province: province.trim(),
      Organization: organization.trim(),
      topography: [
        {
          // FIX: Convert the string state back to a Number for the API payload
          Slope: Number(slope.trim()),
          Mean_Average_Sea_Level: Number(masl.trim()),
        },
      ],
      Hectares: hectares.trim(),
    };

    try {
      const response = await axios.put(
        `${API_URL}/area/${areaId}`,
        updatedData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
        },
      );

      if (response.status === 200) {
        Alert.alert('Success', 'Area details updated successfully!');
        navigation.goBack();
      } else {
        throw new Error(response.data?.message || 'Update failed.');
      }
    } catch (err: any) {
      console.error('Update Error:', err);
      Alert.alert(
        'Update Failed',
        err.response?.data?.message ||
          err.message ||
          'There was an issue saving your changes.',
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[localStyles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Styles.button.backgroundColor} />
        <Text style={[Styles.text, { marginTop: 10, color: '#888' }]}>
          Loading area details...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[localStyles.centerContainer, { paddingTop: insets.top }]}>
        <Text style={localStyles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={fetchAreaDetails}
          style={localStyles.retryButton}
        >
          <Text style={Styles.buttonText}>Retry Load</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={localStyles.goBackButton}
        >
          <Text style={Styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[Styles.container, { alignItems: 'center' }]}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, width: '100%' }}
      >
        <View style={[localStyles.titleContainer, { width: '90%' }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={localStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
          </TouchableOpacity>
          <View style={localStyles.headerTitleContainer}>
            <Text style={localStyles.title} numberOfLines={1}>
              {areaData ? areaData.Area_Name : 'Area Details'}
            </Text>
          </View>
        </View>
        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: 50 }}
        >
          <View
            style={[
              Styles.formBox,
              Styles.responsiveFormContainer,
              localStyles.formBox,
            ]}
          >
            <Text style={localStyles.formHeaderText}>Update Area Details</Text>

            {/* --- CORE DETAILS --- */}
            <View style={localStyles.fieldGroup}>
              <Text style={Styles.text}>Area Name</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Area Name"
                placeholderTextColor="#A9A9A9"
                value={areaName}
                onChangeText={setAreaName}
              />
            </View>

            <View style={localStyles.fieldGroup}>
              <Text style={Styles.text}>Region</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Region"
                placeholderTextColor="#A9A9A9"
                value={region}
                onChangeText={setRegion}
              />
            </View>

            <View style={localStyles.fieldGroup}>
              <Text style={Styles.text}>Province</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Province"
                placeholderTextColor="#A9A9A9"
                value={province}
                onChangeText={setProvince}
              />
            </View>

            <View style={localStyles.fieldGroup}>
              <Text style={Styles.text}>Organization</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Organization"
                placeholderTextColor="#A9A9A9"
                value={organization}
                onChangeText={setOrganization}
              />
            </View>

            {/* --- TOPOGRAPHY FIELDS --- */}

            <View style={localStyles.fieldGroup}>
              <Text style={Styles.text}>Slope</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Slope"
                placeholderTextColor="#A9A9A9"
                value={slope}
                onChangeText={setSlope}
                keyboardType="numeric"
              />
            </View>

            <View style={localStyles.fieldGroup}>
              <Text style={Styles.text}>Masl (Meters Above Sea Level)</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Masl"
                placeholderTextColor="#A9A9A9"
                value={masl}
                onChangeText={setMasl}
                keyboardType="numeric"
              />
            </View>

            {/* --- REMAINING FIELD --- */}

            <View style={localStyles.fieldGroup}>
              <Text style={Styles.text}>Hectares</Text>
              <TextInput
                style={Styles.inputFields}
                placeholder="Hectares"
                placeholderTextColor="#A9A9A9"
                value={hectares}
                onChangeText={setHectares}
                keyboardType="numeric"
              />
            </View>

            {/* Update Button */}
            <TouchableOpacity
              style={isUpdating ? Styles.disabledButton : Styles.button}
              onPress={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator
                  size="small"
                  color={Styles.buttonText.color}
                />
              ) : (
                <Text style={Styles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
            {error && <Text style={localStyles.updateErrorText}>{error}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Styles.background.backgroundColor,
  },
  formBox: {
    width: '95%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  formHeaderText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Styles.headerText.color,
    marginBottom: 20,
  },
  fieldGroup: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
    width: '100%',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Styles.text.color,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#d9534f',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  updateErrorText: {
    color: '#d9534f',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  retryButton: {
    ...Styles.button,
    backgroundColor: '#3D550C',
    width: 150,
    marginTop: 20,
  },
  goBackButton: {
    ...Styles.button,
    backgroundColor: '#3D550C',
    width: 150,
    marginTop: 10,
  },
});

export default MapDetailsUpdate;
