import React, { useState, useCallback, useRef } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  Polygon,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { API_URL, Weather_API_KEY } from '@env';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { getDeviceHeader } from '../../../utils/deviceDetection';
import Styles from '../../../styles/styles';
import {
  AreaEntry,
  MapPreviewProps,
  Coordinate,
  BackendCoordinate,
  BackendPhoto,
} from '../../../navigation/types';

export interface Farm {
  Farm_ID: number;
  Soil_Type: string;
  Soil_Suitability: string;
  Hectares: string;
  Status: string;
  coordinates: BackendCoordinate[];
}

export interface WeatherValues {
  temperature?: number;
  humidity?: number;
  precipitationProbability?: number;
  windSpeed?: number;
  temperatureApparent?: number;
  windDirection?: number;
  pressureSurfaceLevel?: number;
  weatherCode?: number; // Added weather code
}

export interface WeatherForecastResponse {
  data: {
    timelines: {
      intervals: {
        values: WeatherValues;
      }[];
    }[];
  };
}

const { width } = Dimensions.get('window');

// Helper function to get an icon based on the tomorrow.io weather code
const getWeatherIcon = (weatherCode: number | undefined): string => {
  if (weatherCode === undefined) {
    return '🌡️'; // Default emoji icon
  }
  switch (weatherCode) {
    case 1000: // Clear
    case 1100: // Mostly Clear
      return '☀️';
    case 1101: // Partly Cloudy
    case 1102: // Mostly Cloudy
    case 1001: // Cloudy
      return '☁️';
    case 4000: // Drizzle
    case 4200: // Light Rain
    case 4001: // Rain
    case 4201: // Heavy Rain
      return '🌧️';
    case 5000: // Snow
    case 5001: // Flurries
    case 5100: // Light Snow
    case 5101: // Heavy Snow
      return '🌨️';
    case 6000: // Freezing Drizzle
    case 6001: // Freezing Rain
    case 6200: // Light Freezing Rain
    case 6201: // Heavy Freezing Rain
    case 7000: // Ice Pellets
    case 7101: // Heavy Ice Pellets
    case 7102: // Light Ice Pellets
      return '🧊';
    case 8000: // Thunderstorm
      return '⛈️';
    case 2000: // Fog
    case 2100: // Light Fog
      return '🌫️';
    default:
      return '🌡️'; // Default if code not recognized
  }
};

export default function AreaDetailsScreen() {
  const navigation = useNavigation<MapPreviewProps['navigation']>();
  const route = useRoute<MapPreviewProps['route']>();
  const insets = useSafeAreaInsets();
  const { userToken, signOut } = useAuth();

  const [areaData, setAreaData] = useState<AreaEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedFarmCropCount, setSelectedFarmCropCount] = useState<number>(0);
  const [farmModalVisible, setFarmModalVisible] = useState(false);

  const [weatherData, setWeatherData] = useState<WeatherValues | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [ongoingCropsCount, setOngoingCropsCount] = useState<number | null>(
    null,
  );
  const [isCropsLoading, setIsCropsLoading] = useState(false);
  const [cropsFetchError, setCropsFetchError] = useState<string | null>(null);
  const [isToggleFarmStatus, setIsToggleFarmStatus] = useState(false);
  const [isPhotoManagementMode, setIsPhotoManagementMode] = useState(false);
  const [selectedPhotosForDeletion, setSelectedPhotosForDeletion] = useState<
    number[]
  >([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const [mapType, setMapType] = useState<'hybrid' | 'standard'>('hybrid');

  const areaId =
    typeof route.params?.areaId === 'number'
      ? route.params.areaId
      : route.params && typeof route.params.areaId === 'string'
        ? parseInt(route.params.areaId, 10)
        : 0;

  const fetchAreaDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (isNaN(areaId) || areaId === 0) {
      setError('Invalid Area ID provided. Please go back and try again.');
      setIsLoading(false);
      return;
    }

    if (!userToken) {
      console.warn('User token is not available. Cannot fetch area details.');
      setError('Authentication token not found. Please log in.');
      setIsLoading(false);
      return;
    }

    if (!API_URL) {
      console.error('API_URL environment variable is not set!');
      setError('Configuration error: API endpoint is missing.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/area/${areaId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
          ...getDeviceHeader(),
        },
      });

      if (response.status === 401 || response.status === 403) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
        );
        await signOut();
        return;
      }

      if (response.status === 404) {
        setError('Area not found for this ID.');
        setAreaData(null);
        return;
      }

      if (!response.data) {
        const errorText = await response.data;
        throw new Error(
          `Server responded with status ${response.status}: ${errorText || 'Unknown Error'}`,
        );
      }

      const data = await response.data;
      setAreaData(data.area);
      setFarms(data.area.farm || []);

      if (
        data.area &&
        data.area.coordinates &&
        data.area.coordinates.length > 0
      ) {
        const mapCoordinates = data.area.coordinates
          .map((coord: BackendCoordinate) => ({
            latitude: Number(coord.Latitude),
            longitude: Number(coord.Longitude),
          }))
          .filter(
            (coord: { latitude: number; longitude: number }) =>
              typeof coord.latitude === 'number' &&
              typeof coord.longitude === 'number' &&
              !isNaN(coord.latitude) &&
              !isNaN(coord.longitude),
          );

        // 🚨 FIX: Call fetchCurrentWeather after successful data fetch
        const centerCoord = {
          latitude: Number(data.area.coordinates[0].Latitude),
          longitude: Number(data.area.coordinates[0].Longitude),
        };
        fetchCurrentWeather(centerCoord);

        if (mapRef.current) {
          mapRef.current.fitToCoordinates(mapCoordinates, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch area details:', err);
      setError(
        err.message ||
          'Failed to load area details. Please check your network connection.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [areaId, userToken, signOut]);

  const fetchOngoingCropsCount = useCallback(async () => {
    setIsCropsLoading(true);
    setCropsFetchError(null);
    try {
      const response = await axios.get<{ count: number }>(
        `${API_URL}/area/farm_harvest_ongoing_count/${areaId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      setOngoingCropsCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch ongoing crop count:', error);
      setCropsFetchError('Failed to fetch crop data.');
      setOngoingCropsCount(0); // Default to 0 on error
    } finally {
      setIsCropsLoading(false);
    }
  }, [areaId, userToken]);

  const fetchCurrentWeather = useCallback(async (location: Coordinate) => {
    setIsWeatherLoading(true);
    setWeatherError(null);

    const apiKey =
      typeof Weather_API_KEY !== 'undefined'
        ? Weather_API_KEY
        : 'YOUR_API_KEY_HERE';
    const baseUrl = 'https://api.tomorrow.io/v4/timelines';
    const fields = [
      'temperature',
      'humidity',
      'precipitationProbability',
      'windSpeed',
      'temperatureApparent',
      'windDirection',
      'pressureSurfaceLevel',
      'weatherCode',
    ];

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      setWeatherError('Weather API Key is missing.');
      setIsWeatherLoading(false);
      return;
    }

    try {
      const url = `${baseUrl}?location=${location.latitude},${location.longitude}&units=metric&timesteps=1d&fields=${fields.join(',')}&apikey=${apiKey}`;
      const response = await axios.get<WeatherForecastResponse>(url);

      const data: WeatherForecastResponse = response.data;
      const dailyData = data?.data?.timelines[0]?.intervals || [];

      if (dailyData.length > 0) {
        setWeatherData(dailyData[0].values);
      } else {
        setWeatherData(null);
        setWeatherError('No weather data available.');
      }
    } catch (err: any) {
      console.error('Weather API Error:', err);
      setWeatherError(
        err.response?.data?.message ||
          err.message ||
          'Failed to fetch weather data.',
      );
    } finally {
      setIsWeatherLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAreaDetails();
      fetchOngoingCropsCount();
    }, [fetchAreaDetails, fetchOngoingCropsCount]),
  );

  const openImageViewer = (index: number) => {
    if (areaData && areaData.images && API_URL) {
      setModalVisible(false);
      navigation.navigate('ImageViewerScreen', {
        images: areaData.images,
        initialIndex: index,
        apiUrl: API_URL,
      });
    }
  };

  // Helper: Convert backend coordinates to map format
  const convertBackendCoordinates = (
    backendCoords: BackendCoordinate[],
  ): Coordinate[] => {
    return backendCoords.map((coord) => ({
      latitude: Number(coord.Latitude),
      longitude: Number(coord.Longitude),
    }));
  };

  // Helper: Ray-casting algorithm for point-in-polygon detection
  const isPointInPolygon = (
    point: Coordinate,
    polygon: Coordinate[],
  ): boolean => {
    if (polygon.length < 3) return false;

    const x = point.latitude;
    const y = point.longitude;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  };

  // Helper: Get crop count for a specific farm
  const getFarmCropCount = async (farmId: number): Promise<number> => {
    if (!userToken) return 0;

    try {
      const response = await axios.get<{ harvests: Array<{ status: string }> }>(
        `${API_URL}/area/farm_harvest/farm_id=${farmId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Count harvests with 'Ongoing' status
      const ongoingCount =
        response.data.harvests?.filter(
          (harvest) => harvest.status === 'Ongoing',
        ).length || 0;

      return ongoingCount;
    } catch (error) {
      console.warn(`Failed to fetch crop count for farm ${farmId}:`, error);
      return 0;
    }
  };

  // Helper: Handle farm tap
  const handleFarmTap = async (farm: Farm) => {
    setSelectedFarm(farm);
    const cropCount = await getFarmCropCount(farm.Farm_ID);
    setSelectedFarmCropCount(cropCount);
    setFarmModalVisible(true);
  };

  // Toggle photo selection for deletion
  const togglePhotoSelection = (imageId: number) => {
    setSelectedPhotosForDeletion((prev) =>
      prev.includes(imageId)
        ? prev.filter((id) => id !== imageId)
        : [...prev, imageId],
    );
  };

  // Delete selected photos
  const handleDeletePhotos = async () => {
    if (selectedPhotosForDeletion.length === 0) {
      Alert.alert('No Photos Selected', 'Please select photos to delete.');
      return;
    }

    Alert.alert(
      'Confirm Delete',
      `Delete ${selectedPhotosForDeletion.length} photo(s)? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletePromises = selectedPhotosForDeletion.map((imageId) =>
                axios.delete(`${API_URL}/area/${areaId}/photo/${imageId}`, {
                  headers: {
                    Authorization: `Bearer ${userToken}`,
                    ...getDeviceHeader(),
                  },
                }),
              );

              await Promise.all(deletePromises);

              // Update local state
              setAreaData((prev) =>
                prev
                  ? {
                      ...prev,
                      images: prev.images.filter(
                        (img: BackendPhoto) =>
                          !selectedPhotosForDeletion.includes(img.Image_ID),
                      ),
                    }
                  : null,
              );

              setSelectedPhotosForDeletion([]);
              Alert.alert('Success', 'Photos deleted successfully.');
            } catch (error) {
              console.error('Error deleting photos:', error);
              Alert.alert(
                'Error',
                'Failed to delete photos. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  // Pick image from library
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable media library access in settings.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadPhoto(result.assets[0]);
    }
  };

  // Take photo with camera
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable camera access in settings.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadPhoto(result.assets[0]);
    }
  };

  // Upload photo to backend
  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    setIsUploadingPhotos(true);
    try {
      let base64Data: string | null = null;

      if (asset.base64) {
        base64Data = asset.base64;
      } else if (asset.uri) {
        try {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (readError) {
          console.error('Failed to read base64 from asset URI:', readError);
          Alert.alert('Error', 'Could not read image data for upload.');
          setIsUploadingPhotos(false);
          return;
        }
      }

      if (!base64Data) {
        Alert.alert('Error', 'No image data available to process.');
        setIsUploadingPhotos(false);
        return;
      }

      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `photo_${Date.now()}.jpg`,
      } as any);

      const response = await axios.post(
        `${API_URL}/area/${areaId}/photos`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'multipart/form-data',
            ...getDeviceHeader(),
          },
        },
      );

      // Update local state with new photo
      if (response.data && response.data.image) {
        setAreaData((prev) =>
          prev
            ? {
                ...prev,
                images: [...(prev.images || []), response.data.image],
              }
            : null,
        );
        Alert.alert('Success', 'Photo uploaded successfully.');
      }
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message ||
          'Failed to upload photo. Please try again.',
      );
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  // Helper: Toggle farm status
  const handleToggleFarmStatus = async () => {
    if (!selectedFarm || !userToken) return;

    const newStatus = selectedFarm.Status === 'Active' ? 'Inactive' : 'Active';
    setIsToggleFarmStatus(true);

    try {
      await axios.put(
        `${API_URL}/area/${areaId}/farm/${selectedFarm.Farm_ID}/status`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            ...getDeviceHeader(),
          },
        },
      );

      // Update local state
      setSelectedFarm({ ...selectedFarm, Status: newStatus });
      setFarms((prevFarms) =>
        prevFarms.map((farm) =>
          farm.Farm_ID === selectedFarm.Farm_ID
            ? { ...farm, Status: newStatus }
            : farm,
        ),
      );

      Alert.alert('Success', `Farm status changed to ${newStatus}`);
    } catch (error) {
      console.error('Failed to toggle farm status:', error);
      Alert.alert('Error', 'Failed to change farm status. Please try again.');
    } finally {
      setIsToggleFarmStatus(false);
    }
  };

  // Helper: Detect farm taps on map
  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const tapPoint: Coordinate = { latitude, longitude };

    for (const farm of farms) {
      const farmCoordinates = convertBackendCoordinates(farm.coordinates);
      if (isPointInPolygon(tapPoint, farmCoordinates)) {
        handleFarmTap(farm);
        return;
      }
    }
  };

  const getInitialRegion = (
    areaData: AreaEntry | null,
  ):
    | {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
      }
    | undefined => {
    if (areaData && areaData.coordinates && areaData.coordinates.length > 0) {
      const firstCoord = areaData.coordinates[0];
      return {
        latitude: Number(firstCoord.Latitude),
        longitude: Number(firstCoord.Longitude),
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }
    return {
      latitude: 12.8797,
      longitude: 121.774,
      latitudeDelta: 10.0,
      longitudeDelta: 10.0,
    };
  };

  if (isLoading) {
    return (
      <View style={[localStyles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Styles.button.backgroundColor} />
        <Text style={[Styles.text, { marginTop: 10, color: '#888' }]}>
          Loading area details...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[localStyles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={localStyles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchAreaDetails} style={{ marginTop: 10 }}>
          <Text
            style={[Styles.buttonText, { textDecorationLine: 'underline' }]}
          >
            Retry
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginTop: 10 }}
        >
          <Text
            style={[Styles.buttonText, { textDecorationLine: 'underline' }]}
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!areaData) {
    return (
      <View style={[localStyles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={localStyles.emptyText}>
          No area data found for this ID.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginTop: 10 }}
        >
          <Text
            style={[Styles.buttonText, { textDecorationLine: 'underline' }]}
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mapCoordinates = areaData.coordinates.map(
    (coord: BackendCoordinate) => ({
      latitude: Number(coord.Latitude),
      longitude: Number(coord.Longitude),
    }),
  );

  const handleToggleMapType = () => {
    setMapType((prevType) => (prevType === 'hybrid' ? 'standard' : 'hybrid'));
  };

  return (
    <View style={[localStyles.safeArea, { paddingTop: insets.top }]}>
      <View style={localStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={localStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
        </TouchableOpacity>
        <View style={localStyles.headerTitleContainer}>
          <Text style={localStyles.title}>{areaData.Area_Name}</Text>
        </View>
        <TouchableOpacity
          onPress={handleToggleMapType}
          style={localStyles.backButton}
        >
          <MaterialCommunityIcons
            name={mapType === 'hybrid' ? 'satellite-variant' : 'map'}
            size={24}
            color={Styles.text.color}
          />
        </TouchableOpacity>
      </View>

      <View style={localStyles.container}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={localStyles.map}
          initialRegion={getInitialRegion(areaData)}
          mapType={mapType}
          onPress={handleMapPress}
          onMapReady={() => {
            if (mapCoordinates.length > 0 && mapRef.current) {
              mapRef.current.fitToCoordinates(mapCoordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
              });
            }
          }}
        >
          {mapCoordinates.length > 1 && (
            <Polyline
              coordinates={mapCoordinates}
              strokeWidth={3}
              strokeColor="blue"
            />
          )}
          {mapCoordinates.map((coord, index) => (
            <Marker key={`coord-${index}`} coordinate={coord} pinColor="red">
              {Platform.OS === 'ios' && (
                <View>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={30}
                    color="red"
                  />
                </View>
              )}
            </Marker>
          ))}

          {/* Render farm plots */}
          {farms.map((farm) => {
            const farmCoords: Coordinate[] = convertBackendCoordinates(
              farm.coordinates,
            );
            if (farmCoords.length < 2) return null;

            return [
              <Polygon
                key={`farm-polygon-${farm.Farm_ID}`}
                coordinates={farmCoords}
                strokeColor="rgba(255, 165, 0, 1)"
                fillColor="rgba(255, 165, 0, 0.3)"
                strokeWidth={3}
              />,
            ];
          })}
        </MapView>

        <View
          style={[
            localStyles.detailsButtonContainer,
            { bottom: 20 + insets.bottom },
          ]}
        >
          <TouchableOpacity
            style={localStyles.detailsButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={localStyles.detailsButtonText}>Show Details</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={localStyles.modalContainer}
          activeOpacity={1}
          onPressOut={() => setModalVisible(false)}
        >
          <View
            style={[
              localStyles.modalContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>
                {areaData.Area_Name} Details
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons
                  name="close-circle"
                  size={30}
                  color={Styles.text.color}
                />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={localStyles.modalText}>
                <Text style={{ fontWeight: 'bold' }}>Region:</Text>{' '}
                {areaData.Region || 'N/A'}
              </Text>
              <Text style={localStyles.modalText}>
                <Text style={{ fontWeight: 'bold' }}>Province:</Text>{' '}
                {areaData.Province || 'N/A'}
              </Text>
              <Text style={localStyles.modalText}>
                <Text style={{ fontWeight: 'bold' }}>Organization:</Text>{' '}
                {areaData.Organization || 'N/A'}
              </Text>
              <Text style={localStyles.modalText}>
                <Text style={{ fontWeight: 'bold' }}>Submission Date:</Text>{' '}
                {new Date(areaData.created_at).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                style={[Styles.button, localStyles.farmActivityButton]}
                onPress={() => {
                  navigation.navigate('MapDetailsUpdate', {
                    areaId: areaData.Area_ID,
                  });
                  setModalVisible(false);
                }}
              >
                <Text style={Styles.buttonText}>More Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[Styles.button, localStyles.farmActivityButton]}
                onPress={() => {
                  navigation.navigate('MapCoordinatesUpdate', {
                    areaId: areaData.Area_ID,
                  });
                  setModalVisible(false);
                }}
              >
                <Text style={Styles.buttonText}>Update Coordinates</Text>
              </TouchableOpacity>
              <View
                style={[localStyles.imagesHeaderContainer, { marginTop: 15 }]}
              >
                <Text style={{ fontWeight: 'bold', flex: 1, color: '#F4D03F' }}>Images:</Text>
                {areaData.images && areaData.images.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setIsPhotoManagementMode(!isPhotoManagementMode);
                      setSelectedPhotosForDeletion([]);
                    }}
                    style={localStyles.managementToggleButton}
                  >
                    <MaterialCommunityIcons
                      name={isPhotoManagementMode ? 'close' : 'pencil'}
                      size={18}
                      color="#3D550C"
                    />
                    <Text
                      style={{ color: '#3D550C', fontSize: 12, marginLeft: 4 }}
                    >
                      {isPhotoManagementMode ? 'Done' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {areaData.images && areaData.images.length > 0 ? (
                <>
                  <View style={localStyles.imageGrid}>
                    {areaData.images.map(
                      (image: BackendPhoto, index: number) => (
                        <TouchableOpacity
                          key={image.Image_ID.toString()}
                          onPress={() => {
                            if (isPhotoManagementMode) {
                              togglePhotoSelection(image.Image_ID);
                            } else {
                              openImageViewer(index);
                            }
                          }}
                          style={[
                            localStyles.imageThumbnailContainer,
                            selectedPhotosForDeletion.includes(
                              image.Image_ID,
                            ) && localStyles.imageThumbnailSelected,
                          ]}
                        >
                          <Image
                            source={{ uri: `${API_URL}/${image.Filepath}` }}
                            style={localStyles.imageThumbnail}
                            onError={(e) => {
                              console.error(
                                'Image load error for URL:',
                                `${API_URL}/${image.Filepath}`,
                                'Error:',
                                e.nativeEvent.error,
                              );
                            }}
                          />
                          {isPhotoManagementMode &&
                            selectedPhotosForDeletion.includes(
                              image.Image_ID,
                            ) && (
                              <View style={localStyles.selectedCheckmark}>
                                <MaterialCommunityIcons
                                  name="check-circle"
                                  size={32}
                                  color="#28a745"
                                />
                              </View>
                            )}
                        </TouchableOpacity>
                      ),
                    )}
                    {/* Add Photo Button */}
                    <TouchableOpacity
                      style={[
                        localStyles.imageThumbnailContainer,
                        localStyles.addPhotoButton,
                      ]}
                      onPress={() => {
                        Alert.alert('Add Photo', 'Choose a method:', [
                          {
                            text: 'Camera',
                            onPress: handleTakePhoto,
                          },
                          {
                            text: 'Library',
                            onPress: handlePickImage,
                          },
                          { text: 'Cancel', style: 'cancel' },
                        ]);
                      }}
                      disabled={isUploadingPhotos}
                    >
                      {isUploadingPhotos ? (
                        <ActivityIndicator
                          size="large"
                          color={Styles.button.backgroundColor}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="plus"
                          size={30}
                          color="#3D550C"
                        />
                      )}
                    </TouchableOpacity>
                  </View>

                  {isPhotoManagementMode && (
                    <View style={localStyles.deleteButtonContainer}>
                      <TouchableOpacity
                        style={[
                          Styles.button,
                          localStyles.deleteButton,
                          selectedPhotosForDeletion.length === 0 && {
                            opacity: 0.5,
                          },
                        ]}
                        onPress={handleDeletePhotos}
                        disabled={selectedPhotosForDeletion.length === 0}
                      >
                        <MaterialCommunityIcons
                          name="trash-can"
                          size={20}
                          color="#fff"
                        />
                        <Text style={[Styles.buttonText, { marginLeft: 8 }]}>
                          Delete ({selectedPhotosForDeletion.length})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <View style={localStyles.noImagesContainer}>
                  <Text style={localStyles.noImagesText}>
                    No images associated with this entry.
                  </Text>
                  <TouchableOpacity
                    style={[Styles.button, { marginTop: 10 }]}
                    onPress={() => {
                      Alert.alert('Add Photo', 'Choose a method:', [
                        {
                          text: 'Camera',
                          onPress: handleTakePhoto,
                        },
                        {
                          text: 'Library',
                          onPress: handlePickImage,
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                    disabled={isUploadingPhotos}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={20}
                      color="#fff"
                    />
                    <Text style={[Styles.buttonText, { marginLeft: 8 }]}>
                      Add Photo
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* === Farm Activity Section === */}
              <View style={localStyles.farmActivityContainer}>
                <Text style={localStyles.modalTitle}>Farm Activity Status</Text>
                {isCropsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={Styles.button.backgroundColor}
                  />
                ) : cropsFetchError ? (
                  <Text style={localStyles.errorText}>{cropsFetchError}</Text>
                ) : (
                  <Text style={localStyles.modalText}>
                    <Text style={{ fontWeight: 'bold' }}>Ongoing Crops:</Text>{' '}
                    {ongoingCropsCount !== null ? ongoingCropsCount : 'N/A'}
                  </Text>
                )}
                <TouchableOpacity
                  style={[Styles.button, localStyles.farmActivityButton]}
                  onPress={() => {
                    navigation.navigate('FarmPlotCoordinates', {
                      areaId: areaData.Area_ID,
                    });
                    setModalVisible(false);
                  }}
                >
                  <Text style={Styles.buttonText}>Add / Update Farm Plot</Text>
                </TouchableOpacity>
              </View>

              {/* Weather Section */}
              <View style={localStyles.weatherContainer}>
                <Text style={localStyles.modalTitle}>Current Weather</Text>
                {isWeatherLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={Styles.button.backgroundColor}
                  />
                ) : weatherError ? (
                  <Text style={localStyles.weatherErrorText}>
                    Weather data not available.
                  </Text>
                ) : weatherData ? (
                  <>
                    <View style={localStyles.weatherInfo}>
                      <Text style={localStyles.weatherIcon}>
                        {getWeatherIcon(weatherData.weatherCode)}
                      </Text>
                      <Text style={localStyles.weatherTemp}>
                        {weatherData.temperature?.toFixed(0) ?? 'N/A'}°C
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={localStyles.fullForecastButton}
                      onPress={() => {
                        const location = {
                          latitude: areaData.coordinates[0].Latitude,
                          longitude: areaData.coordinates[0].Longitude,
                        };
                        navigation.navigate('WeatherPreview', { location });
                        setModalVisible(false);
                      }}
                    >
                      <Text style={localStyles.fullForecastText}>
                        View Daily Forecast
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Farm Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={farmModalVisible}
        onRequestClose={() => setFarmModalVisible(false)}
      >
        <TouchableOpacity
          style={localStyles.modalContainer}
          activeOpacity={1}
          onPressOut={() => setFarmModalVisible(false)}
        >
          <View
            style={[
              localStyles.modalContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>
                {selectedFarm
                  ? `Farm #${selectedFarm.Farm_ID}`
                  : 'Farm Details'}
              </Text>
              <TouchableOpacity onPress={() => setFarmModalVisible(false)}>
                <Ionicons
                  name="close-circle"
                  size={30}
                  color={Styles.text.color}
                />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedFarm && (
                <>
                  <Text style={localStyles.modalText}>
                    <Text style={{ fontWeight: 'bold' }}>Soil Type:</Text>{' '}
                    {selectedFarm.Soil_Type || 'N/A'}
                  </Text>
                  <Text style={localStyles.modalText}>
                    <Text style={{ fontWeight: 'bold' }}>
                      Soil Suitability:
                    </Text>{' '}
                    {selectedFarm.Soil_Suitability || 'N/A'}
                  </Text>
                  <Text style={localStyles.modalText}>
                    <Text style={{ fontWeight: 'bold' }}>Hectares:</Text>{' '}
                    {selectedFarm.Hectares || 'N/A'}
                  </Text>
                  <Text style={localStyles.modalText}>
                    <Text style={{ fontWeight: 'bold' }}>Status:</Text>{' '}
                    {selectedFarm.Status || 'N/A'}
                  </Text>
                  <Text style={localStyles.modalText}>
                    <Text style={{ fontWeight: 'bold' }}>Ongoing Crops:</Text>{' '}
                    {selectedFarmCropCount}
                  </Text>

                  <TouchableOpacity
                    style={[
                      Styles.button,
                      localStyles.farmActivityButton,
                      {
                        backgroundColor:
                          selectedFarm.Status === 'Active'
                            ? '#28a745'
                            : '#FFA500',
                        marginVertical: 8,
                      },
                    ]}
                    onPress={handleToggleFarmStatus}
                    disabled={isToggleFarmStatus}
                  >
                    <Text style={Styles.buttonText}>
                      {isToggleFarmStatus
                        ? 'Updating...'
                        : selectedFarm.Status === 'Active'
                          ? 'Set Inactive'
                          : 'Set Active'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[Styles.button, localStyles.farmActivityButton]}
                    onPress={() => {
                      if (selectedFarm) {
                        navigation.navigate('FarmActivity', {
                          areaId,
                          farmId: selectedFarm.Farm_ID,
                        });
                      }
                      setFarmModalVisible(false);
                    }}
                  >
                    <Text style={Styles.buttonText}>View Farm Planning</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Styles.background.backgroundColor,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Styles.text.color,
  },
  backButton: {
    padding: 5,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  detailsButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  detailsButton: {
    backgroundColor: Styles.button.backgroundColor,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  detailsButtonText: {
    color: Styles.buttonText.color,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Styles.background.backgroundColor,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Styles.formBox.backgroundColor,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Styles.text.color,
  },
  modalText: {
    fontSize: 18,
    color: Styles.text.color,
    marginBottom: 10,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: 10,
  },
  imageThumbnail: {
    width: (width - 60) / 3,
    height: (width - 60) / 3,
    borderRadius: 8,
    margin: 2,
    resizeMode: 'cover',
    backgroundColor: '#3D550C',
  },
  noImagesText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  weatherContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginTop: 50,
  },
  weatherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  weatherIcon: {
    fontSize: 48,
  },
  weatherTemp: {
    fontSize: 48,
    fontWeight: '200',
    color: Styles.text.color,
    marginLeft: 10,
  },
  weatherErrorText: {
    color: '#d9534f',
    textAlign: 'center',
    fontSize: 14,
  },
  fullForecastButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  fullForecastText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  seeFarmsButton: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    width: undefined,
    marginTop: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: '#F4D03F',
  },
  farmActivityContainer: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginTop: 15,
    alignItems: 'center',
  },
  farmActivityButton: {
    width: '100%',
    marginTop: 15,
    backgroundColor: '#F4D03F',
  },
  imagesHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  managementToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4D03F',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  imageThumbnailContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#3D550C',
  },
  imageThumbnailSelected: {
    borderWidth: 3,
    borderColor: '#28a745',
  },
  selectedCheckmark: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
  },
  addPhotoButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4D03F',
    margin: 2,
  },
  deleteButtonContainer: {
    marginTop: 15,
    width: '100%',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImagesContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});
