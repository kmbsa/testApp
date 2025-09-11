import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Modal,
    ScrollView,
    Image,
    Dimensions
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../../../context/AuthContext';
import Styles from '../../../styles/styles';
import { API_URL, Weather_API_KEY } from "@env";
import {
    AreaEntry,
    RootStackNavigationProp,
    MapPreviewProps,
    WeatherValues,
    WeatherForecastResponse,
    Coordinate
} from '../../../navigation/types';
import { BackendCoordinate, BackendPhoto } from '../../../navigation/types';

const { width } = Dimensions.get('window');

// Helper function to map Tomorrow.io weather codes to Ionicons
const getWeatherIconName = (weatherCode: number): string => {
    switch (weatherCode) {
        case 1000:
            return 'sunny-outline'; // Clear, Sunny
        case 1100:
            return 'partly-sunny-outline'; // Mostly Clear
        case 1101:
            return 'partly-sunny-outline'; // Partly Cloudy
        case 1102:
            return 'cloudy-outline'; // Mostly Cloudy
        case 1001:
            return 'cloudy-outline'; // Cloudy
        case 2000:
        case 2100:
            return 'cloudy-outline'; // Fog
        case 4000:
        case 4200:
            return 'rainy-outline'; // Drizzle, Light Rain
        case 4201:
            return 'rainy-outline'; // Heavy Rain
        case 4001:
            return 'rainy-outline'; // Rain
        case 5000:
        case 5100:
        case 5101:
            return 'snow-outline'; // Snow
        case 6000:
        case 6001:
            return 'snow-outline'; // Freezing Rain
        case 7000:
        case 7100:
        case 7101:
            return 'thunderstorm-outline'; // Ice pellets, Thunderstorm
        default:
            return 'cloudy-outline';
    }
};

export default function AreaDetailsScreen() {
    const { userToken, signOut } = useAuth();
    const navigation = useNavigation<MapPreviewProps['navigation']>();
    const route = useRoute<MapPreviewProps['route']>();
    const insets = useSafeAreaInsets();

    const areaId = typeof route.params?.areaId === 'number'
        ? route.params.areaId
        : (route.params && typeof route.params.areaId === 'string'
            ? parseInt(route.params.areaId, 10)
            : 0);

    const [areaData, setAreaData] = useState<AreaEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [weatherData, setWeatherData] = useState<WeatherValues | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);

    const mapRef = useRef<MapView | null>(null);

    const fetchAreaDetails = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        if (isNaN(areaId) || areaId === 0) {
            setError("Invalid Area ID provided. Please go back and try again.");
            setIsLoading(false);
            return;
        }

        if (!userToken) {
            console.warn("User token is not available. Cannot fetch area details.");
            setError("Authentication token not found. Please log in.");
            setIsLoading(false);
            return;
        }

        if (!API_URL) {
            console.error("API_URL environment variable is not set!");
            setError("Configuration error: API endpoint is missing.");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/area/${areaId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`,
                },
            });

            if (response.status === 401 || response.status === 403) {
                Alert.alert("Session Expired", "Your session has expired. Please log in again.");
                await signOut();
                return;
            }

            if (response.status === 404) {
                setError("Area not found for this ID.");
                setAreaData(null);
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with status ${response.status}: ${errorText || 'Unknown Error'}`);
            }

            const data = await response.json();
            setAreaData(data.area);

            // Log image Filepaths to console for debugging
            if (data.area && data.area.images) {
                console.log("Image Filepaths received:");
                data.area.images.forEach((img: BackendPhoto, index: number) => {
                    // This log has been updated to show the full URL that will be attempted
                    console.log(`Image ${index + 1} URL: ${API_URL}/${img.Filepath}`);
                });
            }


            if (data.area && data.area.coordinates && data.area.coordinates.length > 0 && mapRef.current) {
                const mapCoordinates = data.area.coordinates.map((coord: BackendCoordinate) => ({
                    latitude: coord.Latitude,
                    longitude: coord.Longitude
                }));
                mapRef.current.fitToCoordinates(mapCoordinates, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                });
            }

        } catch (err: any) {
            console.error("Failed to fetch area details:", err);
            setError(err.message || "Failed to load area details. Please check your network connection.");
        } finally {
            setIsLoading(false);
        }
    }, [areaId, userToken, signOut]);

    const fetchCurrentWeather = useCallback(async (location: Coordinate) => {
        setIsWeatherLoading(true);
        setWeatherError(null);

        if (!Weather_API_KEY) {
            setWeatherError("Weather API Key is missing.");
            setIsWeatherLoading(false);
            return;
        }

        const url = `https://api.tomorrow.io/v4/weather/forecast?location=${location.latitude},${location.longitude}&units=metric&timesteps=1h&apikey=${Weather_API_KEY}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch weather data.');
            }
            
            const data: WeatherForecastResponse = await response.json();
            
            if (data?.timelines?.hourly?.length > 0) {
                setWeatherData(data.timelines.hourly[0].values);
            }
        } catch (err: any) {
            console.error("Weather API Error:", err);
            setWeatherError(err.message);
        } finally {
            setIsWeatherLoading(false);
        }
    }, []);

    useEffect(() => {
        if (modalVisible && areaData && areaData.coordinates.length > 0) {
            const location = {
                latitude: areaData.coordinates[0].Latitude,
                longitude: areaData.coordinates[0].Longitude
            };
            fetchCurrentWeather(location);
        }
    }, [modalVisible, areaData, fetchCurrentWeather]);

    useFocusEffect(
        useCallback(() => {
            fetchAreaDetails();
        }, [fetchAreaDetails])
    );

    const getInitialRegion = (): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | undefined => {
        if (areaData && areaData.coordinates && areaData.coordinates.length > 0) {
            const firstCoord = areaData.coordinates[0];
            return {
                latitude: firstCoord.Latitude,
                longitude: firstCoord.Longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            };
        }
        return {
            latitude: 12.8797,
            longitude: 121.7740,
            latitudeDelta: 10.0,
            longitudeDelta: 10.0,
        }; // Default Philippines region
    };

    if (isLoading) {
        return (
            <View style={[localStyles.loadingContainer, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={Styles.button.backgroundColor} />
                <Text style={[Styles.text, { marginTop: 10, color: '#888' }]}>Loading area details...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[localStyles.loadingContainer, { paddingTop: insets.top }]}>
                <Text style={localStyles.errorText}>{error}</Text>
                <TouchableOpacity onPress={fetchAreaDetails} style={{ marginTop: 10 }}>
                    <Text style={[Styles.buttonText, { textDecorationLine: 'underline' }]}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 10 }}>
                    <Text style={[Styles.buttonText, { textDecorationLine: 'underline' }]}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!areaData) {
        return (
            <View style={[localStyles.loadingContainer, { paddingTop: insets.top }]}>
                <Text style={localStyles.emptyText}>No area data found for this ID.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 10 }}>
                    <Text style={[Styles.buttonText, { textDecorationLine: 'underline' }]}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const mapCoordinates = areaData.coordinates.map((coord: BackendCoordinate) => ({
        latitude: coord.Latitude,
        longitude: coord.Longitude
    }));

    return (
        <View style={[localStyles.safeArea, { paddingTop: insets.top }]}>
            <View style={localStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backButton}>
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
                    style={localStyles.map}
                    initialRegion={getInitialRegion()}
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
                        <Marker
                            key={`coord-${index}`}
                            coordinate={coord}
                            pinColor="red"
                        />
                    ))}
                </MapView>

                <View style={[localStyles.detailsButtonContainer, { bottom: 20 + insets.bottom }]}>
                    <TouchableOpacity style={localStyles.detailsButton} onPress={() => setModalVisible(true)}>
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
                    <View style={[localStyles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
                        <View style={localStyles.modalHeader}>
                            <Text style={localStyles.modalTitle}>{areaData.Area_Name} Details</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close-circle" size={30} color={Styles.text.color} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            

                            <Text style={localStyles.modalText}><Text style={{ fontWeight: 'bold' }}>Region:</Text> {areaData.Region || 'N/A'}</Text>
                            <Text style={localStyles.modalText}><Text style={{ fontWeight: 'bold' }}>Province:</Text> {areaData.Province || 'N/A'}</Text>
                            <Text style={localStyles.modalText}><Text style={{ fontWeight: 'bold' }}>Coordinates Count:</Text> {areaData.coordinates.length}</Text>
                            <Text style={localStyles.modalText}><Text style={{ fontWeight: 'bold' }}>Submission Date:</Text> {new Date(areaData.created_at).toLocaleDateString()}</Text>

                            <Text style={[localStyles.modalText, { marginTop: 15, fontWeight: 'bold' }]}>Images:</Text>
                            {areaData.images && areaData.images.length > 0 ? (
                                <View style={localStyles.imageGrid}>
                                    {areaData.images.map((image: BackendPhoto) => {
                                        // --- Add console log to see the URL being attempted ---
                                        console.log('Attempting to load image:', image.Filepath);
                                        return (
                                            <Image
                                                key={image.Image_ID.toString()}
                                                // Updated logic to use API_URL and Filepath
                                                source={{ uri: `${API_URL}/${image.Filepath}` }}
                                                style={localStyles.imageThumbnail}
                                                // --- Enhanced onError logging ---
                                                onError={(e) => {
                                                    console.error('Image load error for URL:', `${API_URL}/${image.Filepath}`, 'Error:', e.nativeEvent.error);
                                                }}
                                            />
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={localStyles.noImagesText}>No images associated with this entry.</Text>
                            )}
                            {/* Weather Section */}
                            <View style={localStyles.weatherContainer}>
                                {isWeatherLoading ? (
                                    <ActivityIndicator size="small" color={Styles.button.backgroundColor} />
                                ) : weatherError ? (
                                    <Text style={localStyles.weatherErrorText}>Weather data not available.</Text>
                                ) : weatherData ? (
                                    <>
                                        <View style={localStyles.weatherInfo}>
                                            <Ionicons 
                                                name={getWeatherIconName(weatherData.weatherCode)} 
                                                size={50} 
                                                color="#007BFF" 
                                            />
                                            <Text style={localStyles.weatherTemp}>{weatherData.temperature.toFixed(0)}°C</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={localStyles.fullForecastButton}
                                            onPress={() => {
                                                const location = {
                                                  latitude: areaData.coordinates[0].Latitude,
                                                  longitude: areaData.coordinates[0].Longitude
                                                };
                                                navigation.navigate('WeatherPreview', { location });
                                                setModalVisible(false);
                                            }}
                                        >
                                            <Text style={localStyles.fullForecastText}>View Daily Forecast</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : null}
                            </View>
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
        width: (width - 60) / 3, // Roughly 3 images per row, considering padding and margin
        height: (width - 60) / 3,
        borderRadius: 8,
        margin: 5,
        resizeMode: 'cover',
        backgroundColor: '#ccc', // Placeholder background
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
    }
});
