import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_URL } from '@env';
import Styles from '../../../styles/styles';

import { useAuth } from '../../../context/AuthContext';
import DropdownComponent, {
  DropdownItem,
} from '../../../components/FormDropdown';
import { philippineCrops } from '../../../../assets/data/Crops';
import { getDeviceHeader } from '../../../utils/deviceDetection';

// --- Utility: Flatten Crops data for Dropdown ---
const getAllCropOptions = (): DropdownItem[] => {
  const allCropNames = [...philippineCrops];

  return allCropNames.map((crop) => ({
    label: crop,
    value: crop,
  }));
};

const CROP_OPTIONS = getAllCropOptions();

interface HarvestRecord {
  Harvest_ID: number;
  cropName: string;
  Sow_Date: string;
  Expected_Harvest_Date: string;
  status: 'Ongoing' | 'Completed' | 'Planned' | string;
}

const STATUS_OPTIONS: DropdownItem[] = [
  { label: 'Planned', value: 'Planned' },
  { label: 'Ongoing', value: 'Ongoing' },
  { label: 'Completed', value: 'Completed' },
];

export default function FarmActivityManagerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { userToken: token } = useAuth();

  const areaId = (route.params as { areaId: number })?.areaId || 1;
  const farmId = (route.params as { farmId: number })?.farmId || null;

  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HarvestRecord | null>(
    null,
  );

  // --- Form State ---
  const [newCrop, setNewCrop] = useState<string | null>(null);
  const [sowDate, setSowDate] = useState(new Date());
  const [harvestDate, setHarvestDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week later
  );
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showSowDatePicker, setShowSowDatePicker] = useState(false);
  const [showHarvestDatePicker, setShowHarvestDatePicker] = useState(false);

  // 🚨 API Fetching Function
  const fetchHarvestData = async () => {
    if (!token) {
      Alert.alert(
        'Authentication Error',
        'User not logged in. Cannot fetch data.',
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use farm_id endpoint if farmId is provided, otherwise use area_id endpoint
      const url = farmId
        ? `${API_URL}/area/farm_harvest/farm_id=${farmId}`
        : `${API_URL}/area/farm_harvest/area_id=${areaId}`;

      const response = await axios.get<{ harvests: HarvestRecord[] }>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...getDeviceHeader(),
        },
      });

      setHarvestRecords(response.data.harvests);
    } catch (error) {
      console.error('Harvest data fetch failed:', error);
      Alert.alert(
        'Error',
        'Failed to load harvest data. Check API connection, Farm ID, and token status.',
      );
      setHarvestRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Initial Data Fetch ---
  useEffect(() => {
    fetchHarvestData();
  }, [areaId, farmId, token]);

  // Helper to format date into YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // --- Date Picker Handlers (with Validation) ---
  const onSowDateChange = (event: any, selectedDate?: Date) => {
    setShowSowDatePicker(false);
    if (selectedDate) {
      // 🚨 Validation: Sow Date must be before Harvest Date
      if (selectedDate >= harvestDate) {
        Alert.alert(
          'Invalid Date',
          'Sow Date must be before the Expected Harvest Date.',
        );
        // Automatically set Harvest Date 7 days later
        setHarvestDate(
          new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        );
      }
      setSowDate(selectedDate);
    }
  };

  const onHarvestDateChange = (event: any, selectedDate?: Date) => {
    setShowHarvestDatePicker(false);
    if (selectedDate) {
      // 🚨 Validation: Harvest Date must be after Sow Date
      if (selectedDate <= sowDate) {
        Alert.alert(
          'Invalid Date',
          'Expected Harvest Date must be after the Sow Date.',
        );
        return; // Do not update state if invalid
      }
      setHarvestDate(selectedDate);
    }
  };

  // --- Form Submission Handler ---
  const handleSaveActivity = async () => {
    if (!newCrop || !sowDate || !harvestDate) {
      Alert.alert('Missing Fields', 'Please select a crop and both dates.');
      return;
    }

    // Final date validation before submission
    if (sowDate >= harvestDate) {
      Alert.alert('Invalid Dates', 'Harvest date must be after sow date.');
      return;
    }
    if (!token) {
      Alert.alert(
        'Authentication Error',
        'User not logged in. Cannot save data.',
      );
      return;
    }

    setIsSubmitting(true);

    // 🚨 Determine Status based on current date (business rule)
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const normalizedSowDate = new Date(sowDate);
    normalizedSowDate.setHours(0, 0, 0, 0);

    let statusToSubmit: 'Planned' | 'Ongoing' | 'Completed';

    if (currentDate.getTime() < normalizedSowDate.getTime()) {
      statusToSubmit = 'Planned';
    } else if (currentDate.getTime() >= normalizedSowDate.getTime()) {
      // If today is Sow Date or later, it's ongoing (assuming it's not harvest day yet)
      statusToSubmit = 'Ongoing';
    } else {
      // Fallback, though the logic above should cover most cases
      statusToSubmit = 'Planned';
    }

    try {
      const payload = {
        area_id: areaId,
        farm_id: farmId,
        crop_type: newCrop,
        sow_date: formatDate(sowDate),
        harvest_date: formatDate(harvestDate),
        status: statusToSubmit,
      };

      await axios.post(`${API_URL}/area/farm_harvest`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...getDeviceHeader(),
        },
      });

      await fetchHarvestData();

      Alert.alert(
        'Success',
        `Activity for ${newCrop} saved with status: ${statusToSubmit}.`,
      );

      setNewCrop(null);
      setSowDate(new Date());
      setHarvestDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setIsFormVisible(false);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        'Failed to save activity. Please try again.';
      console.error('Submission failed:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Edit Handler ---
  const handleEditRecord = (record: HarvestRecord) => {
    setEditingRecord(record);
    setNewCrop(record.cropName);
    setSowDate(new Date(record.Sow_Date));
    setHarvestDate(new Date(record.Expected_Harvest_Date));
    setSelectedStatus(record.status);
    setIsFormVisible(true);
  };

  // --- Update Handler ---
  const handleUpdateActivity = async () => {
    if (
      !editingRecord ||
      !newCrop ||
      !sowDate ||
      !harvestDate ||
      !selectedStatus
    ) {
      Alert.alert('Missing Fields', 'Please fill all fields.');
      return;
    }

    if (sowDate >= harvestDate) {
      Alert.alert('Invalid Dates', 'Harvest date must be after sow date.');
      return;
    }

    if (!token) {
      Alert.alert(
        'Authentication Error',
        'User not logged in. Cannot update data.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        harvest_id: editingRecord.Harvest_ID,
        sow_date: formatDate(sowDate),
        harvest_date: formatDate(harvestDate),
        status: selectedStatus,
      };

      await axios.put(
        `${API_URL}/area/farm_harvest/${editingRecord.Harvest_ID}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...getDeviceHeader(),
          },
        },
      );

      await fetchHarvestData();

      Alert.alert(
        'Success',
        `Updated ${newCrop} to status: ${selectedStatus}.`,
      );

      // Reset form
      setEditingRecord(null);
      setNewCrop(null);
      setSowDate(new Date());
      setHarvestDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setSelectedStatus(null);
      setIsFormVisible(false);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        'Failed to update activity. Please try again.';
      console.error('Update failed:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Cancel Edit Handler ---
  const handleCancelEdit = () => {
    setEditingRecord(null);
    setNewCrop(null);
    setSowDate(new Date());
    setHarvestDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setSelectedStatus(null);
    setIsFormVisible(false);
  };

  // --- Rendering Functions (Fixed) ---
  const renderHarvestRecord = (record: HarvestRecord) => (
    <View key={record.Harvest_ID} style={localStyles.recordCard}>
      <View style={localStyles.recordHeader}>
        <Text style={localStyles.recordTitle}>{record.cropName}</Text>
        <Text
          style={[
            localStyles.statusBadge,
            record.status === 'Ongoing' && localStyles.statusOngoing,
            record.status === 'Completed' && localStyles.statusCompleted,
            record.status !== 'Ongoing' &&
              record.status !== 'Completed' &&
              localStyles.statusPlanned,
          ]}
        >
          {record.status}
        </Text>
      </View>
      {/* 🚨 FIX: Ensure all dynamic text is wrapped in a Text component */}
      <Text style={localStyles.recordDetail}>
        <Text style={{ fontWeight: 'bold' }}>Sow Date:</Text>
        <Text> {record.Sow_Date}</Text>
      </Text>
      <Text style={localStyles.recordDetail}>
        <Text style={{ fontWeight: 'bold' }}>Expected Harvest:</Text>
        <Text> {record.Expected_Harvest_Date}</Text>
      </Text>
      <TouchableOpacity
        style={localStyles.editButton}
        onPress={() => handleEditRecord(record)}
      >
        <Ionicons name="create-outline" size={18} color="#FFFFFF" />
        <Text style={localStyles.editButtonText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActivityForm = () => (
    <View style={localStyles.formContainer}>
      <Text style={localStyles.formTitle}>
        {editingRecord
          ? `Edit Farm Plan - ${editingRecord.cropName}`
          : `Add New Farm Plan for Farm ID: ${farmId || areaId}`}
      </Text>

      {/* Crop Dropdown */}
      <Text style={localStyles.inputLabel}>Select Crop</Text>
      <DropdownComponent
        data={CROP_OPTIONS}
        onValueChange={(value) => setNewCrop(value)}
        value={newCrop}
        placeholder="Select a crop..."
      />

      {/* Sow Date Input (Date Picker) */}
      <Text style={localStyles.inputLabel}>Sow Date</Text>
      <TouchableOpacity
        style={localStyles.dateInput}
        onPress={() => setShowSowDatePicker(true)}
      >
        <Text style={localStyles.dateInputText}>{formatDate(sowDate)}</Text>
        <Ionicons name="calendar" size={20} color={Styles.text.color} />
      </TouchableOpacity>

      {showSowDatePicker && (
        <DateTimePicker
          value={sowDate}
          mode="date"
          display="default"
          onChange={onSowDateChange}
        />
      )}

      {/* Harvest Date Input (Date Picker) */}
      <Text style={localStyles.inputLabel}>Expected Harvest Date</Text>
      <TouchableOpacity
        style={localStyles.dateInput}
        onPress={() => setShowHarvestDatePicker(true)}
      >
        <Text style={localStyles.dateInputText}>{formatDate(harvestDate)}</Text>
        <Ionicons name="calendar" size={20} color={Styles.text.color} />
      </TouchableOpacity>

      {showHarvestDatePicker && (
        <DateTimePicker
          value={harvestDate}
          mode="date"
          display="default"
          onChange={onHarvestDateChange}
          minimumDate={sowDate}
        />
      )}

      {/* Status Dropdown - Only show when editing */}
      {editingRecord && (
        <>
          <Text style={localStyles.inputLabel}>Status</Text>
          <DropdownComponent
            data={STATUS_OPTIONS}
            onValueChange={(value) => setSelectedStatus(value)}
            value={selectedStatus}
            placeholder="Select status..."
          />
        </>
      )}

      <TouchableOpacity
        style={[Styles.button, localStyles.saveButton, localStyles.button]}
        onPress={editingRecord ? handleUpdateActivity : handleSaveActivity}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={Styles.buttonText.color} />
        ) : (
          <Text style={Styles.buttonText}>
            {editingRecord ? 'Update Plan' : 'Save Plan'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[localStyles.cancelButton, localStyles.button]}
        onPress={
          editingRecord ? handleCancelEdit : () => setIsFormVisible(false)
        }
      >
        <Text style={localStyles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[localStyles.safeArea, { paddingTop: insets.top }]}>
      {/* Back Button and Header */}
      <View style={localStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={localStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
        </TouchableOpacity>
        <Text style={localStyles.titleText}>Farm Harvest & Activity</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView style={localStyles.scrollViewContent}>
        <TouchableOpacity
          style={[
            Styles.button,
            localStyles.toggleFormButton,
            localStyles.button,
          ]}
          onPress={() => setIsFormVisible((prev) => !prev)}
        >
          <Text style={Styles.buttonText}>
            {isFormVisible ? 'Hide Form' : '➕ Plan New Crop'}
          </Text>
        </TouchableOpacity>

        {isFormVisible && renderActivityForm()}

        <Text style={localStyles.sectionTitle}>
          Harvests for Farm ID: {farmId || areaId}
        </Text>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={Styles.button.backgroundColor}
            style={{ marginTop: 50 }}
          />
        ) : harvestRecords.length === 0 ? (
          <Text style={localStyles.emptyText}>
            No harvest records found for this farm area.
          </Text>
        ) : (
          harvestRecords.map(renderHarvestRecord)
        )}
      </ScrollView>
    </View>
  );
}

// --- Local Stylesheet (Unchanged) ---
const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Styles.container.backgroundColor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Styles.text.color,
    textAlign: 'center',
    flex: 1,
  },
  scrollViewContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Styles.text.color,
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 5,
  },
  toggleFormButton: {
    marginBottom: 10,
    backgroundColor: Styles.button.backgroundColor,
  },
  // --- Form Styles ---
  formContainer: {
    padding: 15,
    backgroundColor: Styles.formBox.backgroundColor,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Styles.text.color,
    marginBottom: 15,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    color: Styles.text.color,
    fontWeight: '600',
    marginTop: 10,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginTop: 5,
    marginBottom: 10,
    backgroundColor: Styles.inputFields.backgroundColor,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Styles.inputFields.borderColor || '#ccc',
  },
  dateInputText: {
    color: '#000',
    fontSize: 16,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#F4D03F', // Success color
  },
  cancelButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  recordCard: {
    backgroundColor: Styles.formBox.backgroundColor,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
    borderLeftWidth: 5,
    borderLeftColor: Styles.button.backgroundColor,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Styles.text.color,
  },
  recordDetail: {
    fontSize: 14,
    color: Styles.text.color,
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 30,
    fontSize: 16,
  },
  // Status Badges
  statusBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    color: 'white',
  },
  statusOngoing: {
    backgroundColor: '#007bff', // Blue
  },
  statusCompleted: {
    backgroundColor: '#28a745', // Green
  },
  statusPlanned: {
    backgroundColor: '#ffc107', // Yellow/Orange
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#007bff',
    borderRadius: 6,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
});
