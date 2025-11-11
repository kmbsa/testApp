import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';

import { API_URL, Weather_API_KEY } from '@env';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import Styles from '../../../styles/styles';
import {
  AreaEntry,
  MapPreviewProps,
  Coordinate,
} from '../../../navigation/types';

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

import { BackendCoordinate, BackendPhoto } from '../../../navigation/types';

const { width, height } = Dimensions.get('window');

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

  const [weatherData, setWeatherData] = useState<WeatherValues | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [ongoingCropsCount, setOngoingCropsCount] = useState<number | null>(
    null,
  );
  const [isCropsLoading, setIsCropsLoading] = useState(false);
  const [cropsFetchError, setCropsFetchError] = useState<string | null>(null);

  const mapRef = useRef<MapView | null>(null);

  const { width, height } = Dimensions.get('window');

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
        <View style={{ width: 34 }} />
      </View>

      <View style={localStyles.container}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={localStyles.map}
          initialRegion={getInitialRegion(areaData)}
          mapType="hybrid"
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
              <Text
                style={[
                  localStyles.modalText,
                  { marginTop: 15, fontWeight: 'bold' },
                ]}
              >
                Images:
              </Text>
              {areaData.images && areaData.images.length > 0 ? (
                <View style={localStyles.imageGrid}>
                  {areaData.images.map((image: BackendPhoto, index: number) => (
                    <TouchableOpacity
                      key={image.Image_ID.toString()}
                      onPress={() => openImageViewer(index)}
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
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={localStyles.noImagesText}>
                  No images associated with this entry.
                </Text>
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
                    navigation.navigate('FarmActivity', {
                      areaId: areaData.Area_ID,
                    });
                    setModalVisible(false);
                  }}
                >
                  <Text style={Styles.buttonText}>
                    Go to Farm Activity Input
                  </Text>
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

      {/* 🗑️ REMOVED: The second image viewer Modal component */}
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
    fontSize: 16,
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
    margin: 5,
    resizeMode: 'cover',
    backgroundColor: '#ccc',
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
});
