import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

// Import the API key from the environment variable.
// This requires a library like 'react-native-dotenv' to be configured.
// Make sure to have a .env file with a key named Weather_API_KEY.
import { Weather_API_KEY } from '@env';

// Type definitions for the weather data structure
type WeatherData = {
  date: string;
  temperature: number;
  precipitationProbability: number;
  humidity: number;
  windSpeed: number;
};

type ErrorType = string | null;

// Main App component that fetches and displays weather data.
const App = () => {
  // State for storing the weather data (next 5 days).
  const [weatherData, setWeatherData] = useState<WeatherData[] | null>(null);
  // State for managing the loading status.
  const [loading, setLoading] = useState(true);
  // State for handling and displaying any errors.
  const [error, setError] = useState<ErrorType>(null);

  // The API key is now imported from the environment
  const API_KEY = Weather_API_KEY;

  // Function to fetch the weather data for the next 5 days.
  const fetchWeather = async (latitude: number, longitude: number) => {
    const endpoint = 'https://api.tomorrow.io/v4/timelines';

    try {
      setLoading(true);
      setError(null);

      // Build the query string for the GET request
      const queryString = new URLSearchParams({
        location: `${latitude},${longitude}`,
        fields: 'temperature,humidity,precipitationProbability,windSpeed', // Request multiple fields
        units: 'metric',
        timesteps: '1d', // Daily forecast
        timezone: 'auto',
        apikey: API_KEY,
      }).toString();

      console.log('Request URL: ', `${endpoint}?${queryString}`);

      // Make the GET request to the API
      const response = await fetch(`${endpoint}?${queryString}`, {
        headers: {
          accept: 'application/json',
        },
      });

      console.log('Response Status:', response.status); // Log response status

      // Check if the response was successful
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.message}`);
      }

      // Parse the JSON data from the response
      const data = await response.json();

      // Access the forecast data (multiple daily intervals)
      const forecastIntervals = data.data.timelines[0].intervals;

      // If you need data for the next 5 days, slice the array
      const forecastData = forecastIntervals
        .slice(0, 5)
        .map((interval: any) => ({
          date: interval.startTime.split('T')[0], // Extract date part from ISO string
          temperature: interval.values.temperature,
          precipitationProbability: interval.values.precipitationProbability,
          humidity: interval.values.humidity,
          windSpeed: interval.values.windSpeed,
        }));

      // Update the weather data state
      setWeatherData(forecastData);
    } catch (err: any) {
      console.error('Failed to fetch weather:', err);
      setError(err.message || 'Failed to fetch weather data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const lat = 40.7128;
    const lon = -74.006;
    fetchWeather(lat, lon);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>5-Day Weather Forecast</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => fetchWeather(40.7128, -74.006)}
          disabled={loading}
        >
          <Text style={styles.refreshText}>
            {loading ? 'Loading...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading weather...</Text>
        </View>
      ) : weatherData ? (
        <View style={styles.forecastContainer}>
          {weatherData.map((day, index) => (
            <View style={styles.weatherCard} key={index}>
              <Text style={styles.date}>{day.date}</Text>
              <Text style={styles.temperature}>
                {Math.round(day.temperature)}°C
              </Text>
              <View style={styles.dataRow}>
                <Text style={styles.label}>Wind:</Text>
                <Text style={styles.value}>
                  {Math.round(day.windSpeed)} m/s
                </Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.label}>Humidity:</Text>
                <Text style={styles.value}>{Math.round(day.humidity)}%</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.label}>Precipitation:</Text>
                <Text style={styles.value}>
                  {Math.round(day.precipitationProbability)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            No weather data available. Press Refresh to load.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forecastContainer: {
    marginTop: 80,
    paddingHorizontal: 16,
  },
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  date: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  temperature: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: '#888',
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
    alignSelf: 'stretch',
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  noDataContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default App;
