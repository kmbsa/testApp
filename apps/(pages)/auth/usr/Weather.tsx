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
import { LineChart } from 'react-native-chart-kit';
import Styles from '../../../styles/styles';

import { Coordinate, WeatherPreviewProps } from '../../../navigation/types';

import { Weather_API_KEY } from '@env';

const { width } = Dimensions.get('window');

// Updated interface to match the fields from your Postman request
export interface WeatherValues {
    temperature: number;
    humidity?: number;
    precipitationProbability?: number;
    windSpeed?: number;
    temperatureApparent?: number;
    windDirection?: number;
    pressureSurfaceLevel?: number;
}

// Updated interface to match the API response structure
export interface WeatherDataPoint {
    startTime: string; // The Postman response uses 'startTime'
    values: WeatherValues;
}

// The API response now contains a list of timelines
interface Timelines {
    timestep: string;
    intervals: WeatherDataPoint[];
}

export interface WeatherForecastResponse {
    data: {
        timelines: Timelines[];
    };
}
// A simple line graph component
interface LineGraphProps {
    data: WeatherDataPoint[];
}

const LineGraph = ({ data }: LineGraphProps) => {
    if (data.length === 0) return null;

    // Filter out any data points without a temperature value
    const validData = data.filter(d => d.values?.temperature != null);
    if (validData.length === 0) return null;
    
    // Prepare data for the LineChart component
    const temperatures = validData.map(d => parseFloat(d.values.temperature.toFixed(0)));
    const labels = validData.map(d => new Date(d.startTime).toLocaleDateString('en-US', { weekday: 'short' }));

    const chartData = {
        labels: labels,
        datasets: [{
            data: temperatures,
        }],
    };

    const chartConfig = {
        backgroundGradientFrom: Styles.header.backgroundColor,
        backgroundGradientTo: Styles.header.backgroundColor,
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        propsForDots: {
            r: "6",
            strokeWidth: "2",
            stroke: Styles.header.backgroundColor,
        },
    };

    return (
        <View style={[localStyles.chartContainer, { backgroundColor: '#F4D03F'}]}>
            <LineChart
                data={chartData}
                width={width - 100}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={{
                    borderRadius: 10,
                }}
            />
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
    // Use the correct base URL from your Postman request
    const baseUrl = "https://api.tomorrow.io/v4/timelines";
    
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
        // Use the fields from your Postman request, including the newly requested ones
        const fields = [
            "temperature", "humidity", "precipitationProbability", "windSpeed",
            "temperatureApparent", "windDirection", "pressureSurfaceLevel"
        ];

        try {
            // Updated API request with the correct base URL and timesteps
            const url = `${baseUrl}?location=${latitude},${longitude}&units=metric&timesteps=1d&fields=${fields.join(',')}&apikey=${apiKey}`;
            const response = await axios.get<WeatherForecastResponse>(url);
            
            // Access the correct data path from your Postman response structure
            const data: WeatherForecastResponse = response.data;
            const dailyData = data?.data?.timelines[0]?.intervals || [];

            setDailyForecast(dailyData);

            // Set current weather from the first daily data point, as you requested only 1d timestep
            if (dailyData.length > 0) {
                setCurrentWeather(dailyData[0].values);
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
                                        <Text style={localStyles.detailLabel}>Humidity</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.humidity?.toFixed(0) ?? 'N/A'}%</Text>
                                    </View>
                                    <View style={localStyles.detailItem}>
                                        <Text style={localStyles.detailLabel}>Apparent Temp</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.temperatureApparent?.toFixed(1) ?? 'N/A'}°C</Text>
                                    </View>
                                    <View style={localStyles.detailItem}>
                                        <Text style={localStyles.detailLabel}>Precipitation</Text>
                                        <Text style={localStyles.detailValue}>{currentWeather.precipitationProbability?.toFixed(0) ?? 'N/A'}%</Text>
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
                                            <Text style={localStyles.dayCardText}>{new Date(day.startTime).toLocaleDateString()}</Text>
                                            <Text style={localStyles.dayCardText}>{day.values.temperature?.toFixed(1) ?? 'N/A'}°C</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {!isLoading && !error && !currentWeather && (
                            <Text style={localStyles.noDataText}>No weather data available for this location.</Text>
                        )}
                            {/*Container for the Temperature Trend*/}
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
        marginVertical: 10,
        padding: 20,
        backgroundColor: Styles.itemBackground.backgroundColor,
        height: 250,
    },
    chartBackground: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.2,
        borderRadius: 10,
    },
    line: {
        position: 'absolute',
        height: 3,
        backgroundColor: Styles.headerText.color,
        borderRadius: 2,
    },
    pointWrapper: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
        height: 60,
        marginLeft: -30,
        marginTop: -30,
    },
    point: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Styles.headerText.color,
        borderWidth: 2,
        borderColor: Styles.header.backgroundColor,
    },
    pointLabel: {
        position: 'absolute',
        top: -15,
        fontSize: 14,
        fontWeight: 'bold',
        color: Styles.headerText.color,
    },
    pointDateLabel: {
        position: 'absolute',
        bottom: -15,
        fontSize: 10,
        color: '#ccc',
    },
});
