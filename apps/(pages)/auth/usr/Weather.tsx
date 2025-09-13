import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Styles from '../../../styles/styles';

import { Coordinate, WeatherPreviewProps } from '../../../navigation/types';

import { Weather_API_KEY } from '@env';

const { width } = Dimensions.get('window');

export interface WeatherProps {
    isVisible: boolean;
    onClose: () => void;
    location: Coordinate;
}

export interface WeatherValues {
    weatherCode: number;
    temperature: number;
    temperatureApparent: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    pressureSurfaceLevel: number;
}

export interface WeatherDataPoint {
    time: string;
    values: WeatherValues;
}

interface Timelines {
    hourly: WeatherDataPoint[];
    daily: WeatherDataPoint[];
}

export interface WeatherForecastResponse {
    timelines: Timelines;
    location: {
        lat: number;
        lon: number;
        name: string;
        type: string;
    };
}
// A simple line graph component
interface LineGraphProps {
    data: WeatherDataPoint[];
}

const LineGraph = ({ data }: LineGraphProps) => {
    if (data.length === 0) return null;

    const validData = data.filter(d => d.values?.temperature != null);
    if (validData.length === 0) return null;

    const temperatures = validData.map(d => d.values.temperature);
    const maxTemp = Math.max(...temperatures);
    const minTemp = Math.min(...temperatures);
    const tempRange = maxTemp - minTemp;
    const graphHeight = 150;

    const points = validData.map((d, index) => {
        const temp = d.values.temperature;
        const yPos = tempRange > 0 ? (temp - minTemp) / tempRange : 0;
        const xPos = (index / (validData.length - 1)) * (width - 80);
        return { x: xPos, y: (1 - yPos) * (graphHeight - 20) + 10, temp: temp, time: d.time };
    });

    return (
        <View style={localStyles.chartContainer}>
            {points.length > 1 && points.slice(0, points.length - 1).map((point, index) => {
                const nextPoint = points[index + 1];
                const dx = nextPoint.x - point.x;
                const dy = nextPoint.y - point.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const transformOrigin = { x: 0, y: 0 };

                return (
                    <View
                        key={index}
                        style={[
                            localStyles.line,
                            {
                                width: distance,
                                transform: [
                                    { translateX: point.x },
                                    { translateY: point.y },
                                    { rotate: `${angle}deg` },
                                ],
                            },
                        ]}
                    />
                );
            })}
            {/* Render the data points and labels */}
            {points.map((point, index) => (
                <View key={index} style={[localStyles.pointWrapper, { left: point.x, top: point.y }]}>
                    <View style={localStyles.point} />
                    <Text style={localStyles.pointLabel}>{point.temp.toFixed(0)}°</Text>
                    <Text style={localStyles.pointDateLabel}>{new Date(point.time).toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                </View>
            ))}
        </View>
    );
};

// Main weather screen component
export default function Weather({ route, navigation }: WeatherPreviewProps) {
    const [currentWeather, setCurrentWeather] = useState<WeatherValues | null>(null);
    const [dailyForecast, setDailyForecast] = useState<WeatherDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const apiKey = typeof Weather_API_KEY !== 'undefined' ? Weather_API_KEY : 'YOUR_API_KEY_HERE';
    const baseUrl = "https://api.tomorrow.io/v4/weather/forecast";
    
    // Extract location from navigation params
    const location = route.params?.location;

    const fetchWeatherData = useCallback(async () => {
        if (!location || !apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            setError('Location or API Key is missing.');
            return;
        }

        setIsLoading(true);
        setError(null);

        const [latitude, longitude] = [location.latitude, location.longitude];
        const fields = [
            "temperature", "temparatureApparent", "humidity",
            "windSpeed", "windDirection", "pressureSurfaceLevel"
        ];

        try {
            const url = `${baseUrl}?location=${latitude},${longitude}&units=metric&timesteps=1d,1h&fields=${fields.join(',')}&apikey=${apiKey}`;
            const response = await axios.get<WeatherForecastResponse>(url);
            
            const data: WeatherForecastResponse = response.data;
            
            const dailyData = data?.timelines?.daily || [];
            const hourlyData = data?.timelines?.hourly || [];

            const next6Days = dailyData.slice(0, 6);
            setDailyForecast(next6Days);

            if (hourlyData.length > 0) {
                setCurrentWeather(hourlyData[0].values);
            }
        } catch (err: any) {
            console.error("Weather API Error:", err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch weather data.');
        } finally {
            setIsLoading(false);
        }
    }, [location, apiKey]);

    useEffect(() => {
        if (location) {
            fetchWeatherData();
        }
    }, [location, fetchWeatherData]);

    return (
        <SafeAreaView style={Styles.container}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backButton}>
                <Ionicons name="arrow-back" size={30} color={Styles.headerText.color} />
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={localStyles.scrollViewContent}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={Styles.header.backgroundColor} />
                ) : error ? (
                    <Text style={localStyles.errorText}>{error}</Text>
                ) : (
                    <View style={localStyles.contentContainer}>
                        {currentWeather && (
                            <View style={localStyles.weatherSummary}>
                                <Text style={localStyles.currentTemp}>
                                    {currentWeather.temperature?.toFixed(0) ?? 'N/A'}°C
                                </Text>
                                <Text style={localStyles.summaryText}>
                                    Current Conditions
                                </Text>
                            </View>
                        )}

                        {currentWeather && (
                            <View style={[localStyles.weatherSummary, localStyles.detailsContainer]}>
                                <Text style={[localStyles.detailHeader, { color: Styles.headerText.color }]}>Current Conditions</Text>
                                <View style={localStyles.detailsGrid}>
                                    <View style={localStyles.detailItem}>
                                        <Text style={localStyles.detailLabel}>Temperature Apparent</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.temperatureApparent?.toFixed(1) ?? 'N/A'} °C</Text>
                                    </View>
                                    <View style={localStyles.detailItem}>
                                        <Text style={localStyles.detailLabel}>Humidity</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.humidity?.toFixed(0) ?? 'N/A'}%</Text>
                                    </View>
                                    <View style={localStyles.detailItem}>
                                        <Text style={localStyles.detailLabel}>Wind Speed</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.windSpeed?.toFixed(1) ?? 'N/A'} m/s</Text>
                                    </View>
                                    <View style={localStyles.detailItem}>
                                        <Text style={localStyles.detailLabel}>Wind Direction</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.windDirection?.toFixed(0) ?? 'N/A'}°</Text>
                                    </View>
                                    <View style={localStyles.detailItem}>
                                        <Text style={localStyles.detailLabel}>Pressure</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.pressureSurfaceLevel?.toFixed(1) ?? 'N/A'} hPa</Text>
                                    </View>
                                </View>

                                <Text style={[localStyles.detailHeader, { color: Styles.headerText.color }]}>Next 5 Days Temperature</Text>
                                <View style={localStyles.dailyForecastList}>
                                    {dailyForecast.length > 0 && dailyForecast.map((day, index) => (
                                        <View key={index} style={[localStyles.dayCard, Styles.itemBackground]}>
                                            <Text style={localStyles.dayCardText}>{new Date(day.time).toLocaleDateString()}</Text>
                                            <Text style={localStyles.dayCardText}>{day.values.temperature?.toFixed(1) ?? 'N/A'}°C</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {!isLoading && !error && !currentWeather && (
                            <Text style={localStyles.noDataText}>No weather data available for this location.</Text>
                        )}
                        <View style={[localStyles.weatherSummary, localStyles.detailsContainer, { alignItems: 'center' }]}>
                            <Text style={[localStyles.detailHeader, { color: Styles.headerText.color }]}>Temperature Trend</Text>
                            {dailyForecast.length > 0 && <LineGraph data={dailyForecast} />}
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const localStyles = StyleSheet.create({
    scrollViewContent: {
        alignItems: 'center',
        paddingTop: 50
    },
    backButton: {
        position: 'absolute',
        top: 40,
        left: 20,
        zIndex: 10,
        padding: 5,
        borderRadius: 50,
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
    },
    closeButton: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#888',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
    },
    noDataText: {
        textAlign: 'center',
        marginTop: 20,
        color: Styles.headerText.color,
    },
    contentContainer: {
        width: '90%',
    },
    weatherSummary: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: Styles.header.backgroundColor,
        borderRadius: 10,
        marginBottom: 15,
    },
    currentTemp: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Styles.headerText.color,
    },
    summaryText: {
        marginTop: 5,
        fontSize: 14,
        color: Styles.headerText.color,
    },
    detailsContainer: {
        marginTop: 10,
    },
    detailHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    detailItem: {
        width: '48%',
        marginBottom: 10,
        backgroundColor: Styles.itemBackground.backgroundColor,
        padding: 10,
        borderRadius: 8,
    },
    detailLabel: {
        fontSize: 12,
        color: '#777',
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    dailyForecastList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
    },
    dayCard: {
        alignItems: 'center',
        padding: 10,
        margin: 5,
        borderRadius: 8,
        backgroundColor: Styles.itemBackground.backgroundColor,
        width: (width - 60) / 3,
    },
    dayCardText: {
        fontSize: 12,
        textAlign: 'center',
    },
    chartContainer: {
        height: 180,
        marginTop: 10,
        position: 'relative',
    },
    line: {
        position: 'absolute',
        height: 2,
        backgroundColor: Styles.header.backgroundColor,
    },
    pointWrapper: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        marginLeft: -20,
        marginTop: -20,
    },
    point: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Styles.headerText.color,
        borderWidth: 2,
        borderColor: Styles.header.backgroundColor,
    },
    pointLabel: {
        position: 'absolute',
        top: -20,
        fontSize: 12,
        fontWeight: 'bold',
        color: Styles.headerText.color,
    },
    pointDateLabel: {
        position: 'absolute',
        bottom: -20,
        fontSize: 10,
        color: Styles.headerText.color,
    },
});
