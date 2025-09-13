import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';

// Import the API key from the environment variable.
// This requires a library like 'react-native-dotenv' to be configured.
// Make sure to have a .env file with a key named Weather_API_KEY.
import { Weather_API_KEY } from '@env';

// Type definitions for the weather data structure
type WeatherData = {
  temperature: number;
  precipitationProbability: number;
  humidity: number;
  windSpeed: number;
};

type ErrorType = string | null;

// Main App component that fetches and displays weather data.
const App = () => {
  // State for storing the single weather data object.
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  // State for managing the loading status.
  const [loading, setLoading] = useState(true);
  // State for handling and displaying any errors.
  const [error, setError] = useState<ErrorType>(null);

  // The API key is now imported from the environment
  const API_KEY = Weather_API_KEY;

  // Function to fetch the weather data for the current moment.
  const fetchWeather = async (latitude: number, longitude: number) => {
    // The API endpoint for the timelines.
    const endpoint = 'https://api.tomorrow.io/v4/timelines';

    // The data to be sent in the POST request.
    const requestBody = {
      location: {
        lat: latitude,
        lon: longitude
      },
      fields: [
        "temperature",
        "humidity",
        "windSpeed"
      ],
      units: "metric",
      timesteps: ["1d"],
      timezone: "auto"
    };

    try {
      setLoading(true);
      setError(null);
      
      // Make the POST request to the API.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'apikey': API_KEY,
        },
        body: JSON.stringify(requestBody)
      });
      
      // Check if the response was successful.
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.message}`);
      }

      // Parse the JSON data from the response.
      const data = await response.json();
      
      // The current weather data is located at `data.data.timelines[0].intervals[0].values`.
      const currentInterval = data.data.timelines[0].intervals[0];
      setWeatherData(currentInterval.values);

    } catch (err: any) {
      console.error("Failed to fetch weather:", err);
      setError(err.message || 'Failed to fetch weather data.');
    } finally {
      setLoading(false);
    }
  };

  // Use the useEffect hook to fetch data when the component mounts.
  useEffect(() => {
    // New York City coordinates. You can change these.
    const lat = 40.7128;
    const lon = -74.0060;
    fetchWeather(lat, lon);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Current Weather</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => fetchWeather(40.7128, -74.0060)}
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
          <Text style={styles.loadingText}>Loading current weather...</Text>
        </View>
      ) : weatherData ? (
        <View style={styles.weatherCard}>
          <Text style={styles.weatherIcon}>
            {/* You can replace this with an actual icon component */}
            ☀️
          </Text>
          <Text style={styles.temperature}>{Math.round(weatherData.temperature)}°C</Text>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Wind:</Text>
            <Text style={styles.value}>{Math.round(weatherData.windSpeed)} m/s</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.label}>Humidity:</Text>
            <Text style={styles.value}>{Math.round(weatherData.humidity)}%</Text>
          </View>
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
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    margin: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  weatherIcon: {
    fontSize: 72,
    marginVertical: 16,
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  label: {
    fontSize: 18,
    color: '#888',
    fontWeight: '500',
  },
  value: {
    fontSize: 18,
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
    marginHorizontal: 16,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  }
});

export default App;
