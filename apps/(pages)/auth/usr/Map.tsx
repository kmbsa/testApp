import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native'; // Import Alert for error messages

// Helper: Collect all data to save as draft
export type Marker = {
  latitude: number;
  longitude: number;
  [key: string]: any;
};
export type Polyline = Marker[];
export type Area = Marker[];
export type FormData = { [key: string]: any };

// This is the in-memory/context type
export type PhotoData = {
  base64: string; // Used in-memory/context
  uri: string; // Used in-memory/context
};

// This is the main in-memory DraftData structure
export type DraftData = {
  markers: Marker[];
  polylines: Polyline[];
  area: Area;
  form: FormData;
  photos: PhotoData[]; // In-memory uses the object array
};

// Type for the data as it appears when LOADED from AsyncStorage (photos will be string[])
export type StoredDraftData = Omit<DraftData, 'photos'> & {
  photos: string[]; // Stored data only contains string URIs
};

const getDraftData = (
  markers: Marker[],
  polylines: Polyline[],
  area: Area,
  form: FormData,
  photos: PhotoData[],
): DraftData => ({
  markers,
  polylines,
  area,
  form,
  photos,
});

// Base path for all drafts (using the correct persistent directory)
const DRAFT_DIR_BASE = `${FileSystem.documentDirectory}drafts/`;

// Helper function to construct the unique directory path for a draft
const getDraftDirectory = (draftId: string): string => {
  return `${DRAFT_DIR_BASE}${draftId}/`;
};

// Save draft to AsyncStorage - CORRECTED FUNCTION
const saveDraft = async (draftData: DraftData) => {
  try {
    let userId = null;
    try {
      userId = draftData.form?.user_id || null;
    } catch {}

    const userDraftName =
      draftData.form?.draftName?.replace(/[^a-z0-9]/gi, '_').toLowerCase() ||
      'untitled';

    const draftKey = userId
      ? `draft_${userId}_${userDraftName}_${Date.now()}` // Key for authenticated user
      : `draft_anon_${userDraftName}_${Date.now()}`; // Key for unauthenticated/offline user

    const draftImageDir = getDraftDirectory(draftKey);

    // 1. Create the unique directory for this draft's images
    await FileSystem.makeDirectoryAsync(draftImageDir, { intermediates: true });

    const newPhotoData: PhotoData[] = [];

    // 2. Iterate and copy ALL photos
    for (const photo of draftData.photos) {
      // Use const for variables that won't change
      const originalUri: string = photo.uri;

      // A. Check if the file is already persistent (a loaded draft being re-saved)
      if (originalUri.startsWith(DRAFT_DIR_BASE)) {
        newPhotoData.push(photo);
        continue;
      }

      // B. This is a NEW photo. Copy it.

      // Get the filename using pure JavaScript string manipulation
      const parts = originalUri.split('/');
      const filename =
        parts[parts.length - 1] || `photo_${Date.now()}_${Math.random()}.jpg`;

      const newPhotoUri = `${draftImageDir}${filename}`;

      // CRITICAL FIX: Pass simple string URIs to copyAsync
      await FileSystem.copyAsync({
        from: originalUri, // The temporary URI string
        to: newPhotoUri, // The new, permanent URI string
      });

      // 3. Update Base64 (Optional: Re-read base64 from the new persistent file if needed)
      // Use 'let' because we might reassign it
      let base64 = photo.base64;
      if (!base64 && newPhotoUri) {
        try {
          base64 = await FileSystem.readAsStringAsync(newPhotoUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e) {
          console.warn('Could not read base64 after copy:', e);
          base64 = '';
        }
      }

      // Store the final persistent data object (with base64, even if empty, for context)
      newPhotoData.push({ uri: newPhotoUri, base64: base64 });
    }

    // 4. CRITICAL FIX: Prepare data for AsyncStorage by converting PhotoData[] to string[]
    const photoUrisForStorage: string[] = newPhotoData.map((p) => p.uri);

    const finalDraftDataForStorage: StoredDraftData = {
      markers: draftData.markers,
      polylines: draftData.polylines,
      area: draftData.area,
      form: { ...draftData.form, draftKey: draftKey },
      photos: photoUrisForStorage, // <-- Store only the string URIs
    };

    // 5. Save the final draft data
    await AsyncStorage.setItem(
      draftKey,
      JSON.stringify(finalDraftDataForStorage),
    );

    // Optionally, keep a list of draft keys
    let keysRaw = await AsyncStorage.getItem('draft_keys');
    let keys: string[] = [];
    if (keysRaw) {
      try {
        keys = JSON.parse(keysRaw);
        if (!Array.isArray(keys)) keys = [];
      } catch {
        keys = [];
      }
    }
    if (!keys.includes(draftKey)) {
      keys.push(draftKey);
    }

    await AsyncStorage.setItem('draft_keys', JSON.stringify(keys));
    Alert.alert('Draft Saved', 'Your draft has been saved locally.');
  } catch (e) {
    console.error('Failed to save draft and images:', e);
    Alert.alert('Error', `Failed to save draft.\n${e}`);
  }
};

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  Platform,
  View,
  TextInput,
  Modal,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Entypo, EvilIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@env';
import axios, { AxiosError } from 'axios';
import * as turf from '@turf/turf';
import FormDropdown from '../../../components/FormDropdown';
import FormButton from '../../../components/FormButton';

import type {
  RootStackNavigationProp,
  Coordinate,
} from '../../../navigation/types';

import {
  usePointsContext,
  isCoordinateInArray,
  findClosestSegmentForInsertion,
} from '../../../context/PointsContext';
import { usePhotosContext } from '../../../context/PhotosContext';

import { useAuth } from '../../../context/AuthContext';

import Styles from '../../../styles/styles';

import { SoilTypeData } from '../../../data/SoilType';
import { SoilSuitabilityData } from '../../../data/SoilSuitability';
import { provincesByRegion } from '../../../data/Regions';

export default function Map() {
  // Get draft from navigation params
  const route = useRoute();
  const draftParam = (route.params as any)?.draft || null;
  // Restore state from draft if present
  useEffect(() => {
    if (draftParam) {
      // Restore points (area)
      if (Array.isArray(draftParam.area)) {
        resetPoints();
        // Add each point from draft
        draftParam.area.forEach((pt: any) => {
          if (
            pt &&
            typeof pt.latitude === 'number' &&
            typeof pt.longitude === 'number'
          ) {
            addPoint({ ...pt });
          }
        });
      }
      // Restore form fields
      if (draftParam.form) {
        setAreaName(draftParam.form.areaName || '');
        setAreaRegion(draftParam.form.areaRegion || null);
        setAreaProvince(draftParam.form.areaProvince || null);
        setAreaBarangay(draftParam.form.areaBarangay || '');
        setAreaOrganization(draftParam.form.areaOrganization || '');
        setAreaSlope(draftParam.form.areaSlope || '');
        setAreaMasl(draftParam.form.areaMasl || '');
        setAreaSoilType(draftParam.form.areaSoilType || '');
        setAreaSoilSuitability(draftParam.form.areaSoilSuitability || '');
        setDraftName(draftParam.form.draftName || '');
      }
      // Restore photos
      if (Array.isArray(draftParam.photos)) {
        // formPhotos is managed by context, so clear and add
        clearFormPhotos();
        draftParam.photos.forEach((uri: string) => {
          if (uri) {
            // Provide placeholder width/height (e.g., 100), or retrieve actual values if available
            addFormPhoto({ uri, width: 100, height: 100 });
          }
        });
      }
      // If the draft is a completed shape, set isComplete
      if (draftParam.area && draftParam.area.length >= 3) {
        setIsComplete(true);
      }
    }
  }, [draftParam]);

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Track if loaded from draft
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const navigation = useNavigation<RootStackNavigationProp>();

  const {
    points,
    redoStack,
    isComplete,
    addPoint,
    resetPoints,
    undoPoint,
    redoPoint,
    setIsComplete,
    closePolygon,
    insertPoint,
    updatePoint,
  } = usePointsContext();
  const {
    formPhotos,
    addFormPhoto,
    removeFormPhoto,
    clearFormPhotos,
    pickImageFromLibrary,
  } = usePhotosContext();

  const mapRef = useRef<MapView | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [areaName, setAreaName] = useState('');
  const [areaRegion, setAreaRegion] = useState<string | null>(null);
  const [areaProvince, setAreaProvince] = useState<string | null>(null);
  const [areaBarangay, setAreaBarangay] = useState('');
  const [areaOrganization, setAreaOrganization] = useState('');
  const [areaSlope, setAreaSlope] = useState('');
  const [areaMasl, setAreaMasl] = useState('');
  const [areaSoilType, setAreaSoilType] = useState('');
  const [areaSoilSuitability, setAreaSoilSuitability] = useState('');
  const [areaInHectares, setAreaInHectares] = useState(0);

  const [draftName, setDraftName] = useState('');

  const provincesForSelectedRegion =
    provincesByRegion.find((r) => r.region === areaRegion)?.provinces || [];

  const [currentPage, setCurrentPage] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [snapShot, setSnapshot] = React.useState<string | null>(null);

  const { userToken, userData, signOut } = useAuth();

  const panY = useRef(new Animated.Value(0)).current;
  const initialModalHeight = useRef(0);

  const scrollViewRef = useRef<ScrollView | null>(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (modalVisible) {
          setModalVisible(false);
        }
        panY.setValue(0);
        setCurrentPage(1); // Reset page on exit
      };
    }, [modalVisible, panY]),
  );

  useEffect(() => {
    console.log('### FINAL Map Points state changed (from Context):', points);
  }, [points]);

  useEffect(() => {
    if (!areaRegion === null) {
      console.log(areaRegion);
    }
    if (!areaProvince === null) {
      console.log(areaProvince);
    }
  });

  /**
   * Calculates the area of the closed polygon in hectares using Turf.js.
   * @param coordinates The array of Coordinate objects forming the polygon.
   * @returns The area in hectares.
   */
  const calculateAreaInHectares = (coordinates: Coordinate[]): number => {
    if (coordinates.length < 3) {
      return 0;
    }

    // 1. Convert RN Maps format to GeoJSON format: [[lon, lat], ...]
    // Turf.js expects the coordinates to be in [longitude, latitude] format.
    let geojsonCoords = coordinates.map((c) => [c.longitude, c.latitude]);

    // 2. CRITICAL FIX: Ensure the loop is closed by duplicating the first point
    const firstPoint = geojsonCoords[0];
    const lastPoint = geojsonCoords[geojsonCoords.length - 1];

    // Compare coordinates. Note: JavaScript array/object comparison uses reference,
    // so compare the actual longitude/latitude values.
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      // If the first and last points are not the same, append the first point
      geojsonCoords = [...geojsonCoords, firstPoint];
    }

    // 3. Create the Turf.js Polygon object
    // Turf.js expects the coordinates wrapped in an extra array for the outer ring
    try {
      const polygon = turf.polygon([geojsonCoords]);

      // 4. Calculate geodesic area in square meters (m²)
      const areaSqMeters = turf.area(polygon);

      // 5. Convert to hectares (1 ha = 10,000 m²)
      const areaHectares = areaSqMeters / 10000;

      return areaHectares;
    } catch (error) {
      console.error('Turf.js Calculation Error:', error);
      // Return 0 or re-throw a clearer error if needed
      return 0;
    }
  };

  const handleMapReady = () => {
    setMapLoaded(true);
    if (mapRef.current && points.length === 0) {
      console.log(
        '>>> Map: Map ready, points empty. Fitting to default bounds.',
      );
      mapRef.current.fitToCoordinates(
        [
          { latitude: 5.0, longitude: 115.0 },
          { latitude: 19.0, longitude: 127.0 },
        ],
        {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        },
      );
    } else if (mapRef.current && points.length > 0) {
      console.log(
        `>>> Map: Map ready, ${points.length} points exist (from context). Fitting to points.`,
      );
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const handleMapPress = (event: any) => {
    if (isComplete) {
      console.log('>>> Map: Map press ignored: shape is complete.');
      return;
    }

    const newCoord: Coordinate = event.nativeEvent.coordinate;

    // 1. Check if the press is near an existing polyline segment (requires at least 2 points for a segment)
    if (points.length >= 2) {
      // Use a max distance of 0.0001 decimal degrees for segment selection tolerance
      const segmentData = findClosestSegmentForInsertion(
        newCoord,
        points,
        0.0001,
      );

      if (segmentData) {
        // Insertion logic: add the point into the segment
        console.log(
          `>>> Map: Tapped near Polyline. Inserting point at index: ${segmentData.insertionIndex}`,
        );
        // Call the new context function
        insertPoint(newCoord, segmentData.insertionIndex);
        return;
      }
    }

    // 2. If not near a polyline segment, treat it as a regular map press (append point)
    console.log('>>> Map: Adding new regular map press point via context.');
    addPoint(newCoord);
  };

  const handleMarkerPress = (index: number) => {
    if (isComplete) {
      const tappedPoint = points[index];
      console.log('>>> Map: Tapped marker on completed shape:', tappedPoint);
      Alert.alert(
        'Point Details',
        `Lat: ${tappedPoint.latitude.toFixed(4)}, Lng: ${tappedPoint.longitude.toFixed(4)}`,
      );
      return;
    }

    if (points.length > 1 && index === 0) {
      console.log(
        '>>> Map: Tapped first marker to complete shape. Calling context.closePolygon()',
      );
      closePolygon();
    } else {
      console.log(`>>> Map: Tapped marker at index ${index} while plotting.`);
    }
  };

  const handleUndo = () => {
    if (isComplete) return;
    if (points.length === 1) {
      setUserLocation(null);
    }
    undoPoint();
  };

  const handleRedo = () => {
    if (isComplete) return;
    redoPoint();
  };

  const getCurrentUserLocation = async () => {
    if (isComplete) {
      Alert.alert(
        'Shape Already Completed',
        'Cannot add location points after completing the shape.',
      );
      return;
    }
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Permission Denied',
        'Please enable location services to mark your current location.',
        [{ text: 'OK' }],
      );
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    const userCoordinate: Coordinate = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    setUserLocation(userCoordinate);

    console.log('>>> Map: Adding new user location point via context.');
    addPoint(userCoordinate);
    mapRef.current?.animateToRegion({
      latitude: userCoordinate.latitude,
      longitude: userCoordinate.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  };

  const handleCompletePlotting = () => {
    if (isComplete) {
      Alert.alert(
        'Shape Already Completed',
        'You have already finished plotting points.',
      );
      return;
    }
    const uniquePointsCount = new Set(
      points.map((p) => `${p.latitude},${p.longitude}`),
    ).size;
    if (uniquePointsCount < 3) {
      Alert.alert(
        'Not Enough Points',
        'Please add at least 3 unique points before completing the shape.',
      );
      return;
    }

    console.log(
      '>>> Map: Completing shape via button press. Calling context.closePolygon()',
    );
    closePolygon();

    const calculatedArea = calculateAreaInHectares([...points]);
    setAreaInHectares(calculatedArea);

    Alert.alert(
      'Shape Completed',
      'Your polygon has been drawn. You can now fill out the form for this area.',
      [
        {
          text: 'OK',
          onPress: () => {
            setModalVisible(true);
            panY.setValue(0);
            setCurrentPage(1); // Ensure it opens on page 1
          },
        },
      ],
    );
  };

  const handleOpenForm = () => {
    setModalVisible(true);
    panY.setValue(0);
    setCurrentPage(1); // Ensure it opens on page 1
  };

  function clearForms() {
    resetPoints();
    setModalVisible(false);
    setAreaName('');
    setAreaRegion(null);
    setAreaProvince(null);
    setAreaOrganization('');
    setAreaSlope('');
    setAreaMasl('');
    setAreaSoilType('');
    setAreaSoilSuitability('');
    setCurrentPage(1);
    setUserLocation(null);
    setAreaBarangay('');
    panY.setValue(0);
  }

  function defineAreaContents() {
    const currentUserId = userData?.user_id;
    const areaData = {
      user_id: currentUserId,
      name: areaName,
      region: areaRegion,
      province: areaProvince,
      organization: areaOrganization,
      slope: areaSlope,
      masl: areaMasl,
      soil_type: areaSoilType,
      suitability: areaSoilSuitability,
      coordinates: points,
      photos: formPhotos.map((p) => ({
        base64: p.base64,
        mimeType: p.mimeType,
        filename: p.filename,
      })),
    };
    return areaData;
  }

  const handleClearMap = () => {
    Alert.alert(
      'Clear Map',
      'Are you sure you want to clear all plotted points?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            console.log('>>> Map: Clearing map via context resetPoints.');
            clearForms();
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  const handleCameraPress = async () => {
    console.log(">>> Map: Navigating to Camera page ('Camera').");
    navigation.navigate('Camera');
  };

  const handlePhotoLibraryPress = async () => {
    console.log('>>> Map: Picking image from library.');
    await pickImageFromLibrary();
  };

  const handleSubmitForm = async () => {
    if (isSubmitting) return;

    if (currentPage !== 3) {
      Alert.alert(
        'Incomplete Form',
        'Please proceed to the Topographical Data page.',
      );
      return;
    }

    if (!areaSoilType.trim() || !areaSoilSuitability.trim()) {
      Alert.alert(
        'Missing Information',
        'Please fill in all required form fields (Area Name, Region, Province, Organization, Slope, and Mean Average Sea Level).',
      );
      return;
    }

    const currentUserId = userData?.user_id;
    if (!currentUserId) {
      Alert.alert(
        'Authentication Error',
        'User ID not found. Please log in again.',
      );

      await signOut();
      return;
    }

    if (!API_URL) {
      Alert.alert(
        'Configuration Error',
        'API_URL environment variable is not set.',
      );
      console.error('API_URL is undefined!');
      return;
    }

    setIsSubmitting(true);

    const areaData = defineAreaContents();

    console.log(
      'Attempting to submit data:',
      JSON.stringify(areaData, null, 2),
    );

    try {
      const response = await axios.post(`${API_URL}/area`, areaData, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.status === 200 || response.status === 201) {
        console.log('Server response:', response.data);
        Alert.alert('Success!', 'Area details submitted successfully.');
        clearForms();
      } else {
        Alert.alert(
          'Unexpected Response',
          `The server responded with status ${response.status}. Please try again.`,
        );
      }
    } catch (err) {
      const error = err as AxiosError;

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 401 || status === 403) {
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in again.',
          );
          await signOut();
        } else {
          console.error('Server error:', status, errorData);
          Alert.alert(
            'Submission Failed',
            `Server responded with status ${status}: ${
              typeof errorData === 'string'
                ? errorData
                : JSON.stringify(errorData, null, 2)
            }`,
          );
        }
      } else if (error.request) {
        // Request made but no response
        console.error('No response received:', error.request);
        Alert.alert(
          'Network Error',
          'No response received from the server. Please check your network connection.',
        );
      } else {
        // Something completely different happened
        console.error('Unexpected error:', error.message);
        Alert.alert('Error', `Unexpected error occurred: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (event, gestureState) => {
        if (
          gestureState.dy > initialModalHeight.current * 0.3 ||
          gestureState.vy > 0.5
        ) {
          Animated.timing(panY, {
            toValue: initialModalHeight.current,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setModalVisible(false);
            panY.setValue(0);
            setCurrentPage(1); // Reset page on swipe close
          });
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const handleNextPage = () => {
    if (currentPage != 3) {
      setCurrentPage((prev) => prev + 1);
    } else {
      setCurrentPage(1);
    }
  };

  const handleBackPage = () => {
    if (currentPage != 1) {
      setCurrentPage((prev) => prev - 1);
    } else {
      setCurrentPage(3);
    }
  };

  const takeSnapshot = async () => {
    if (mapRef.current) {
      try {
        const uri = await mapRef.current.takeSnapshot({
          width: 500,
          height: 500,
          format: 'png',
          quality: 0.8,
          result: 'file',
        });
        {
          /*
          Steps to do for saving everything in offline
          1. Take a snapshot of the map (check).
          2. Take the uri of that map snapshot and save it locally in the device.
          3. Take all the coordinates data inside the array and save it locally.
          4. Take all the inputs in the forms and save it locally.
          5. Find a way to load it in the drafts.
           */
        }
        setSnapshot(`${uri}`);
        console.log(`Snapshot saved at: ${snapShot}`);
        console.log(`${points}`);
        const areaData = defineAreaContents();
        console.log(`Area Data Contents: ${JSON.stringify(areaData, null, 2)}`);
      } catch (e) {
        console.log(`Snapshot Error: ${e}`);
      }
    }
  };

  const renderCancelButton = () => (
    <TouchableOpacity
      style={{ marginTop: 10 }}
      onPress={() => {
        setModalVisible(false);
        panY.setValue(0);
        setCurrentPage(1);
      }}
      disabled={isSubmitting}
    >
      <View style={{ justifyContent: 'center' }}>
        <Text style={[Styles.text, { color: '#555', textAlign: 'center' }]}>
          Cancel
        </Text>
      </View>
    </TouchableOpacity>
  );

  // --- MODAL PAGE 1: AREA DETAILS ---
  const renderAreaDetailsForm = () => (
    <View>
      <Text
        style={[
          Styles.text,
          {
            marginBottom: 15,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 'bold',
          },
        ]}
      >
        Area Location Details (1/3)
      </Text>
      {/* NAME INPUT */}
      <Text style={[Styles.text, localStyles.formLabels]}>Area Name</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 15, width: '100%' }]}
        placeholder="Enter Area Name Here"
        placeholderTextColor="#8b8b8bff"
        value={areaName}
        onChangeText={setAreaName}
        multiline={false}
      />
      {/* REGION INPUT */}
      <Text style={[Styles.text, localStyles.formLabels]}>Region</Text>
      <FormDropdown
        data={provincesByRegion.map((r) => ({
          label: r.region,
          value: r.region,
        }))}
        value={areaRegion}
        onValueChange={setAreaRegion}
      />
      {/* PROVINCE INPUT */}
      <Text style={[Styles.text, localStyles.formLabels]}>Province</Text>
      <FormDropdown
        data={provincesForSelectedRegion}
        value={areaProvince}
        onValueChange={setAreaProvince}
        placeholder="Select province"
      />
      {/* BARANGAY INPUT */}
      <Text style={[Styles.text, localStyles.formLabels]}>Barangay</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter Barangay Here"
        placeholderTextColor="#8b8b8bff"
        value={areaBarangay}
        onChangeText={setAreaBarangay}
        multiline={false}
      />
      {/* ORGANIZATION INPUT */}
      <Text style={[Styles.text, localStyles.formLabels]}>Organization</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter Organization of Owner Here"
        placeholderTextColor="#8b8b8bff"
        value={areaOrganization}
        onChangeText={setAreaOrganization}
        multiline={false}
      />
      {/* PHOTO INPUT */}
      <Text style={[Styles.text, localStyles.formLabels, { marginBottom: 10 }]}>
        Attach Photos
      </Text>
      <View style={Styles.twoButtonContainer}>
        <TouchableOpacity
          style={[Styles.button, localStyles.smallPhotoButton]}
          onPress={handleCameraPress}
        >
          <Ionicons
            name="camera-outline"
            size={20}
            color={Styles.buttonText.color}
            style={{ marginRight: 5 }}
          />
          <Text style={Styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[Styles.button, localStyles.smallPhotoButton]}
          onPress={handlePhotoLibraryPress}
        >
          <Ionicons
            name="image-outline"
            size={20}
            color={Styles.buttonText.color}
            style={{ marginRight: 5 }}
          />
          <Text style={Styles.buttonText}>From Library</Text>
        </TouchableOpacity>
      </View>

      {formPhotos.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Clear Photos',
              'Are you sure you want to remove all attached photos?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear Photos',
                  onPress: clearFormPhotos,
                  style: 'destructive',
                },
              ],
              { cancelable: true },
            );
          }}
          style={[
            Styles.button,
            {
              backgroundColor: '#F08080',
              marginBottom: 15,
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={Styles.buttonText.color}
            style={{ marginRight: 5 }}
          />
          <Text style={Styles.buttonText}>Clear Photos</Text>
        </TouchableOpacity>
      )}

      {formPhotos.length > 0 ? (
        <View style={localStyles.photoPreviewGrid}>
          {formPhotos.map((photo) => (
            <View key={photo.id} style={localStyles.photoThumbnailContainer}>
              <Image
                source={{ uri: photo.uri }}
                style={localStyles.photoThumbnail}
              />
              <TouchableOpacity
                style={localStyles.deletePhotoButton}
                onPress={() => removeFormPhoto(photo.id)}
              >
                <Ionicons name="close-circle" size={24} color="red" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text
          style={[
            Styles.text,
            { color: '#888', marginBottom: 20, textAlign: 'center' },
          ]}
        >
          No photos attached yet.
        </Text>
      )}

      {/* PAGE SWITCH BUTTONS */}
      <View style={[Styles.twoButtonContainer]}>
        <FormButton
          title="Back"
          onPress={handleBackPage}
          disabled={currentPage <= 1}
          additionalStyles={[localStyles.smallPhotoButton]}
        />
        <FormButton
          title="Next"
          onPress={handleNextPage}
          disabled={currentPage >= 3}
          additionalStyles={[localStyles.smallPhotoButton]}
        />
      </View>

      {renderCancelButton()}
    </View>
  );

  // --- MODAL PAGE 2: TOPOGRAPHICAL DATA ---
  const renderTopographicalForm = () => (
    <View>
      <Text
        style={[
          Styles.text,
          {
            marginBottom: 15,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 'bold',
          },
        ]}
      >
        Topographical Data (2/3)
      </Text>

      {/* SLOPE INPUT */}
      <Text style={[Styles.text, localStyles.formLabels]}>Slope</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter the marked area's Slope in percentage"
        placeholderTextColor="#8b8b8bff"
        value={areaSlope}
        onChangeText={setAreaSlope}
        keyboardType="numeric"
        multiline={false}
      />

      {/* MASL INPUT */}
      <Text style={[Styles.text, localStyles.formLabels]}>
        Mean Average Sea Level (masl)
      </Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter the Mean Average Sea Level"
        placeholderTextColor="#8b8b8bff"
        value={areaMasl}
        onChangeText={setAreaMasl}
        keyboardType="numeric"
        multiline={false}
      />
      {/* PAGE SWITCH BUTTONS */}
      <View style={[Styles.twoButtonContainer]}>
        <FormButton
          title="Back"
          onPress={handleBackPage}
          disabled={currentPage <= 1}
          additionalStyles={[localStyles.smallPhotoButton]}
        />
        <FormButton
          title="Next"
          onPress={handleNextPage}
          disabled={currentPage >= 3}
          additionalStyles={[localStyles.smallPhotoButton]}
        />
      </View>
      {renderCancelButton()}
    </View>
  );

  // --- MODAL PAGE 3: FARM PROPERTIES ---
  const renderFarmPropertiesForm = () => (
    <View>
      <Text
        style={[
          Styles.text,
          {
            marginBottom: 15,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 'bold',
          },
        ]}
      >
        Farm Properties (3/3)
      </Text>
      {/* SOIL TYPE DROPDOWN */}
      <Text style={[Styles.text, localStyles.formLabels]}>Soil Type</Text>
      <FormDropdown
        data={SoilTypeData}
        value={areaSoilType}
        onValueChange={(val) => {
          setAreaSoilType(val);
        }}
      />
      {/* SOIL SUITABILITY DROPDOWN */}
      <Text style={[Styles.text, localStyles.formLabels]}>
        Soil Suitability
      </Text>
      <FormDropdown
        data={SoilSuitabilityData}
        value={areaSoilSuitability}
        onValueChange={(val) => {
          setAreaSoilSuitability(val);
        }}
      />
      {/* SOIL SUITABILITY DROPDOWN */}
      <Text style={[Styles.text, localStyles.formLabels]}>Hectares</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Automatic filled on completion"
        placeholderTextColor="#8b8b8bff"
        value={String(areaInHectares)}
        multiline={false}
        editable={false}
      />
      {/* PAGE SWITCH BUTTONS */}
      <View style={[Styles.twoButtonContainer]}>
        <FormButton
          title="Back"
          onPress={handleBackPage}
          disabled={currentPage <= 1}
          additionalStyles={[localStyles.smallPhotoButton]}
        />
        <FormButton
          title="Next"
          onPress={handleNextPage}
          disabled={currentPage >= 3}
          additionalStyles={[localStyles.smallPhotoButton]}
        />
      </View>

      {/* SUBMIT BUTTON */}
      <TouchableOpacity
        style={[Styles.button, { width: '100%', marginBottom: 15 }]}
        onPress={handleSubmitForm}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={Styles.buttonText.color} />
        ) : (
          <Text style={Styles.buttonText}>Submit Area Details</Text>
        )}
      </TouchableOpacity>

      {renderCancelButton()}
    </View>
  );

  // Save Draft Handler
  // Always use latest state for draft
  const handleSaveDraft = () => {
    const draftData = getDraftData(
      [...points],
      [],
      [...points],
      {
        user_id: userData?.user_id ?? null,
        draftName,
        areaName,
        areaRegion,
        areaProvince,
        areaBarangay,
        areaOrganization,
        areaSlope,
        areaMasl,
        areaSoilType,
        areaSoilSuitability,
      },
      formPhotos.map((p) => ({ uri: p.uri, base64: p.base64 })),
    );
    saveDraft(draftData);
    setHasUnsavedChanges(false);
  };

  // Track unsaved changes on any form or points update
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [
    points,
    areaName,
    areaRegion,
    areaProvince,
    areaBarangay,
    areaOrganization,
    areaSlope,
    areaMasl,
    areaSoilType,
    areaSoilSuitability,
    formPhotos,
  ]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        onMapReady={handleMapReady}
        onPress={handleMapPress}
        mapType="hybrid"
        followsUserLocation={true}
        initialRegion={{
          latitude: 12.8797,
          longitude: 121.774,
          latitudeDelta: 10.0,
          longitudeDelta: 10.0,
        }}
      >
        {points.map((point, index) => (
          <Marker
            draggable
            onDrag={(e) => {
              updatePoint(index, e.nativeEvent.coordinate);
            }}
            onDragEnd={(e) => {
              updatePoint(index, e.nativeEvent.coordinate);
            }}
            key={`marker-${index}`}
            coordinate={point}
            onPress={() => handleMarkerPress(index)}
            pinColor={Platform.OS !== 'ios' ? 'red' : undefined}
          >
            {Platform.OS === 'ios' && (
              <View>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={isComplete ? 25 : 30}
                  color={isComplete ? 'darkred' : 'red'}
                />
              </View>
            )}
          </Marker>
        ))}

        {userLocation &&
          !isCoordinateInArray(
            userLocation,
            points.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            })),
          ) && (
            <Marker
              draggable
              key="user-location-marker"
              coordinate={userLocation}
              title="My Location"
              pinColor={Platform.OS !== 'ios' ? 'blue' : undefined}
            >
              {Platform.OS === 'ios' && (
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={0}
                  color="blue"
                />
              )}
            </Marker>
          )}

        {points.length > 1 && (
          <Polyline coordinates={points} strokeWidth={3} strokeColor="blue" />
        )}
      </MapView>

      <SafeAreaView style={localStyles.backButtonContainer}>
        <TouchableOpacity
          onPress={() => {
            if (hasUnsavedChanges) {
              Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Would you like to save your draft before leaving?',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => {} },
                  {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () => {
                      setHasUnsavedChanges(false);
                      navigation.navigate('DraftsPage');
                    },
                  },
                  {
                    text: 'Save',
                    onPress: () => {
                      handleSaveDraft();
                      navigation.navigate('Home');
                    },
                  },
                ],
              );
            } else {
              navigation.navigate('Home');
            }
          }}
          style={localStyles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color={Styles.buttonText.color}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSaveDraft}
          style={localStyles.backButton}
        >
          <Entypo name="save" size={30} color={Styles.buttonText.color} />
        </TouchableOpacity>
      </SafeAreaView>

      <SafeAreaView style={localStyles.undoRedoClearContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handleClearMap}
            disabled={points.length === 0}
            style={[
              localStyles.clearButton,
              {
                backgroundColor:
                  points.length > 0
                    ? Styles.button.backgroundColor
                    : Styles.inputFields.backgroundColor,
                padding: 8,
                borderRadius: 20,
              },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={30}
              color={points.length > 0 ? 'black' : 'grey'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleUndo}
            disabled={points.length === 0 || isComplete}
            style={{
              backgroundColor:
                points.length > 0 && !isComplete
                  ? Styles.button.backgroundColor
                  : Styles.inputFields.backgroundColor,
              padding: 8,
              borderRadius: 20,
              marginRight: 10,
            }}
          >
            <EvilIcons
              name="undo"
              size={30}
              color={points.length > 0 && !isComplete ? 'black' : 'grey'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRedo}
            disabled={redoStack.length === 0 || isComplete}
            style={{
              backgroundColor:
                redoStack.length > 0 && !isComplete
                  ? Styles.button.backgroundColor
                  : Styles.inputFields.backgroundColor,
              padding: 8,
              borderRadius: 20,
            }}
          >
            <EvilIcons
              name="redo"
              size={30}
              color={redoStack.length > 0 && !isComplete ? 'black' : 'grey'}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <TouchableOpacity
        style={[Styles.button, localStyles.openFormButton]}
        onPress={handleOpenForm}
      >
        <Ionicons
          name="document-text-outline"
          size={24}
          color={Styles.buttonText.color}
          style={{ marginRight: 5 }}
        />
        <Text style={Styles.buttonText}>Open Form</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          Styles.button,
          localStyles.completeShapeButton,
          {
            opacity:
              new Set(points.map((p) => `${p.latitude},${p.longitude}`)).size >=
              3
                ? 1
                : 0.5,
          },
        ]}
        onPress={handleCompletePlotting}
        disabled={
          new Set(points.map((p) => `${p.latitude},${p.longitude}`)).size < 3
        }
      >
        <Text style={Styles.buttonText}>Complete Shape</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          Styles.button,
          {
            position: 'absolute',
            bottom: 60,
            left: 20,
            right: 20,
            width: undefined,
            marginTop: 0,
            alignSelf: 'center',
            opacity: isComplete ? 0.5 : 1,
          },
        ]}
        onPress={getCurrentUserLocation}
        disabled={isComplete}
      >
        <Text style={Styles.buttonText}>Mark My Location</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          setCurrentPage(1); // Reset page on close
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Animated.View
              style={[
                Styles.formBox,
                {
                  width: '100%',
                  minHeight: '60%',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingHorizontal: 20,
                  paddingVertical: 20,
                  transform: [{ translateY: panY }],
                },
              ]}
              onLayout={(event) => {
                if (initialModalHeight.current === 0) {
                  initialModalHeight.current = event.nativeEvent.layout.height;
                }
              }}
            >
              {/* Draggable indicator/header */}
              <View
                style={localStyles.modalHandle}
                {...panResponder.panHandlers}
              >
                <View style={localStyles.modalHandleBar} />
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                ref={scrollViewRef} // Assign ref here
              >
                {/* Conditional Rendering based on currentPage state */}
                {currentPage === 1 && renderAreaDetailsForm()}
                {currentPage === 2 && renderTopographicalForm()}
                {currentPage === 3 && renderFarmPropertiesForm()}
              </ScrollView>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    paddingTop: 10,
    paddingLeft: 10,
    flexDirection: 'row',
  },
  backButton: {
    backgroundColor: Styles.button.backgroundColor,
    padding: 8,
    borderRadius: 20,
    marginRight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoRedoClearContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1,
    paddingTop: 10,
    paddingRight: 10,
  },
  clearButton: {
    marginRight: 10,
  },
  openFormButton: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    width: undefined,
    marginTop: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  completeShapeButton: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    width: undefined,
    marginTop: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  smallPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    width: 190,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  photoPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  photoThumbnailContainer: {
    position: 'relative',
    margin: 5,
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 8,
  },
  deletePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
  },
  formLabels: {
    textAlign: 'left',
  },
  modalHandle: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#ccc',
  },
});
