import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Platform,
  View,
  TextInput,
  Modal,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { EvilIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@env';
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

export default function Map() {
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
  const [areaRegion, setAreaRegion] = useState('');
  const [areaProvince, setAreaProvince] = useState('');
  const [areaOrganization, setAreaOrganization] = useState('');
  const [areaSlope, setAreaSlope] = useState('');
  const [areaMasl, setAreaMasl] = useState('');
  const [areaSoilType, setAreaSoilType] = useState('');
  const [areaSoilSuitability, setAreaSoilSuitability] = useState('');

  const [currentPage, setCurrentPage] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

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
    if (!isComplete) {
      Alert.alert(
        'Shape Not Complete',
        'Please complete plotting the shape before filling out the form.',
      );
      return;
    }
    setModalVisible(true);
    panY.setValue(0);
    setCurrentPage(1); // Ensure it opens on page 1
  };

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
            resetPoints();
            setModalVisible(false);
            setAreaName('');
            setAreaRegion('');
            setAreaProvince('');
            setAreaOrganization('');
            // NEW RESETS
            setAreaSlope('');
            setAreaMasl('');
            setCurrentPage(1);
            // END NEW RESETS
            setUserLocation(null);
            panY.setValue(0);
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

    // CHECK: Must be on the final page (page 2) to submit
    if (currentPage !== 2) {
      Alert.alert(
        'Incomplete Form',
        'Please proceed to the Topographical Data page.',
      );
      return;
    }

    if (
      !areaName.trim() ||
      !areaRegion.trim() ||
      !areaProvince.trim() ||
      !areaOrganization.trim() ||
      !areaSlope.trim() || // NEW VALIDATION
      !areaMasl.trim() // NEW VALIDATION
    ) {
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

    console.log(
      'Attempting to submit data:',
      JSON.stringify(areaData, null, 2),
    );

    try {
      const response = await fetch(`${API_URL}/area`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(areaData),
      });

      if (response.status === 401 || response.status === 403) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
        );
        await signOut();
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', response.status, errorText);
        Alert.alert(
          'Submission Failed',
          `Server responded with status ${response.status}: ${errorText || 'Unknown Error'}`,
        );
        return;
      }

      const responseData = await response.json();
      console.log('Server response:', responseData);
      Alert.alert('Success!', 'Area details submitted successfully.');

      resetPoints();
      clearFormPhotos();
      setAreaName('');
      setAreaRegion('');
      setAreaProvince('');
      setAreaOrganization('');
      // NEW RESETS
      setAreaSlope('');
      setAreaMasl('');
      setCurrentPage(1);
      // END NEW RESETS
      setModalVisible(false);
      panY.setValue(0);
      setUserLocation(null);
    } catch (error) {
      console.error('Network or submission error:', error);
      Alert.alert(
        'Error',
        `Could not connect to the server or submit data. Please check your network connection.\nDetails: ${error instanceof Error ? error.message : String(error)}`,
      );
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

  // --- Modal Page 1: Area Details & Photos ---
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
        Farm Properties (1/3)
      </Text>
      <Text style={[Styles.text, localStyles.formLabels]}>Name</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 15, width: '100%' }]}
        placeholder="Place Name"
        placeholderTextColor="#8b8b8bff"
        value={areaName}
        onChangeText={setAreaSoilType}
        multiline={false}
      />
      <Text style={[Styles.text, localStyles.formLabels]}>Region</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Location Details"
        placeholderTextColor="#8b8b8bff"
        value={areaRegion}
        onChangeText={setAreaRegion}
        multiline={false}
      />

      <Text style={[Styles.text, localStyles.formLabels]}>Province</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter Province Here"
        placeholderTextColor="#8b8b8bff"
        value={areaProvince}
        onChangeText={setAreaProvince}
        multiline={false}
      />

      <Text style={[Styles.text, localStyles.formLabels]}>Organization</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter Organization of Owner Here"
        placeholderTextColor="#8b8b8bff"
        value={areaOrganization}
        onChangeText={setAreaOrganization}
        multiline={false}
      />

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

  // --- Modal Page 2: Topographical Data ---
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

      {/* SLOPE Input */}
      <Text style={[Styles.text, localStyles.formLabels]}>Slope</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter the marked area's Slope in degrees"
        placeholderTextColor="#8b8b8bff"
        value={areaSlope}
        onChangeText={setAreaSlope}
        keyboardType="numeric"
        multiline={false}
      />

      {/* MASL Input */}
      <Text style={[Styles.text, localStyles.formLabels]}>
        Mean Average Sea Level (masl)
      </Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Enter the Mean Average Sea Level of the marked area"
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
      <Text style={[Styles.text, localStyles.formLabels]}>Area Name</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 15, width: '100%' }]}
        placeholder="Place Name"
        placeholderTextColor="#8b8b8bff"
        value={areaName}
        onChangeText={setAreaName}
        multiline={false}
      />
      <Text style={[Styles.text, localStyles.formLabels]}>Region</Text>
      <TextInput
        style={[Styles.inputFields, { marginBottom: 20, width: '100%' }]}
        placeholder="Location Details"
        placeholderTextColor="#8b8b8bff"
        value={areaRegion}
        onChangeText={setAreaRegion}
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

      {/* SUBMIT BUTTON */}
      <TouchableOpacity
        style={[Styles.button, { width: '100%' }]}
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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        onMapReady={handleMapReady}
        onPress={handleMapPress}
        mapType="hybrid"
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
              <View style={localStyles.mapMarker}>
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
                  size={30}
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
          onPress={() => navigation.navigate('Home')}
          style={localStyles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color={Styles.buttonText.color}
          />
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

      {/* Forms Button after completing */}
      {isComplete && (
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
      )}

      {!isComplete && (
        <TouchableOpacity
          style={[
            Styles.button,
            localStyles.openFormButton,
            {
              opacity:
                new Set(points.map((p) => `${p.latitude},${p.longitude}`))
                  .size >= 3
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
      )}

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
  },
  backButton: {
    backgroundColor: Styles.button.backgroundColor,
    padding: 8,
    borderRadius: 20,
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
