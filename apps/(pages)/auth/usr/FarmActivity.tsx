import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
// Assuming Styles.ts contains basic styles like inputFields, text, and button
import Styles from '../../../styles/styles';

// For the date picker (you'll need to install a library like '@react-native-community/datetimepicker'
// or use a modal/Text input for a simple text-based date)
// For this example, we'll use simple TextInputs for dates.

const FarmActivityScreen = () => {
  const [crop, setCrop] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [sowHarvestDate, setSowHarvestDate] = useState('');

  const handleSaveActivity = () => {
    if (!crop || !plantingDate || !sowHarvestDate) {
      Alert.alert('Missing Fields', 'Please fill in all activity details.');
      return;
    }

    // 1. **Data Processing/API Call:** Here you would send the data to your backend or save it locally.
    console.log({ crop, plantingDate, sowHarvestDate });

    Alert.alert('Activity Saved', `Activity for ${crop} saved successfully!`);

    // Clear the form
    setCrop('');
    setPlantingDate('');
    setSowHarvestDate('');
  };

  const renderCropDropdown = () => (
    <View style={localStyles.dropdownContainer}>
      <Text style={Styles.text}>Select Crop (Simple Input for now)</Text>
      <TextInput
        style={Styles.inputFields}
        placeholder="e.g., Corn (Use a Picker/Dropdown in a real app)"
        placeholderTextColor="#aaa"
        value={crop}
        onChangeText={setCrop}
      />
    </View>
  );

  return (
    <ScrollView style={localStyles.container}>
      <Text style={localStyles.title}>Farm Activity Input</Text>

      {/* Crop Input (Needs a proper Picker/Dropdown in a full app) */}
      {renderCropDropdown()}

      {/* Planting Date Input */}
      <Text style={Styles.text}>Planting Date (YYYY-MM-DD)</Text>
      <TextInput
        style={Styles.inputFields}
        placeholder="e.g., 2024-05-15"
        placeholderTextColor="#aaa"
        value={plantingDate}
        onChangeText={setPlantingDate}
        keyboardType="numeric" // Use a date picker library for production
        maxLength={10}
      />

      {/* Sow/Harvest Date Input */}
      <Text style={Styles.text}>Sow/Harvest Date (YYYY-MM-DD)</Text>
      <TextInput
        style={Styles.inputFields}
        placeholder="e.g., 2024-10-01"
        placeholderTextColor="#aaa"
        value={sowHarvestDate}
        onChangeText={setSowHarvestDate}
        keyboardType="numeric" // Use a date picker library for production
        maxLength={10}
      />

      <TouchableOpacity style={Styles.button} onPress={handleSaveActivity}>
        <Text style={Styles.buttonText}>Save Activity</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Styles.container.backgroundColor, // Use your main background color
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Styles.text.color,
    marginBottom: 30,
    textAlign: 'center',
  },
  dropdownContainer: {
    marginBottom: 20,
  },
});

export default FarmActivityScreen;
