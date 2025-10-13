import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  FlatList,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_URL } from '@env';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import Styles from '../../../styles/styles';
import { AreaEntry, RootStackNavigationProp } from '../../../navigation/types';

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Styles.background.backgroundColor,
  },
  container: {
    flex: 1,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
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
  searchBar: {
    width: '100%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    fontSize: 16,
    color: Styles.text.color,
    backgroundColor: Styles.formBox.backgroundColor,
  },
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: Styles.formBox.backgroundColor,
    padding: 15,
    margin: 5,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Styles.text.color,
    marginBottom: 5,
  },
  cardDetails: {
    fontSize: 14,
    color: Styles.text.color,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  // --- emptyText style is defined here as requested ---
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  loadMoreButton: {
    backgroundColor: Styles.button.backgroundColor,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignSelf: 'center',
    marginVertical: 20,
  },
  loadMoreText: {
    color: Styles.buttonText.color,
    fontWeight: 'bold',
  },
});

const ITEMS_PER_PAGE = 10;

export default function MapEntriesScreen() {
  const { userToken, signOut } = useAuth();
  const navigation = useNavigation<RootStackNavigationProp>();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<AreaEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchEntries = useCallback(
    async (page: number, query: string = '') => {
      if (!userToken) {
        console.warn('User token is not available. Cannot fetch entries.');
        setIsLoading(false);
        return;
      }

      if (!API_URL) {
        console.error('API_URL environment variable is not set!');
        setError('Configuration error: API endpoint is missing.');
        setIsLoading(false);
        return;
      }

      // Set the appropriate loading state
      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsFetchingMore(true);
      }
      setError(null);

      try {
        let url = `${API_URL}/areas?page=${page}&per_page=${ITEMS_PER_PAGE}`;
        if (query) {
          url += `&search=${encodeURIComponent(query)}`;
        }

        const response = await axios.get(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
        });

        const data = response.data;

        if (page === 1) {
          setEntries(data.entries);
        } else {
          setEntries((prevEntries) => [...prevEntries, ...data.entries]);
        }

        setCurrentPage(data.page);
        setHasMore(data.has_more);
      } catch (err: any) {
        // Axios error handling
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;

          if (status === 401 || status === 403) {
            Alert.alert(
              'Session Expired',
              'Your session has expired. Please log in again.',
            );
            await signOut();
            return;
          }

          console.error('Axios error response:', err.response);
          setError(
            err.response?.data?.message ||
              'Failed to load entries. Please check your network connection.',
          );
        } else {
          console.error('Unexpected error:', err);
          setError(
            err.message ||
              'Failed to load entries. Please check your network connection.',
          );
        }
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [userToken, signOut],
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchEntries(1, searchQuery);
    }, 500); // Debounce delay
    return () => clearTimeout(handler);
  }, [searchQuery, fetchEntries]);

  const handleLoadMore = () => {
    if (hasMore && !isFetchingMore) {
      fetchEntries(currentPage + 1, searchQuery);
    }
  };

  const renderItem = ({ item }: { item: AreaEntry }) => (
    <TouchableOpacity
      style={localStyles.card}
      onPress={() =>
        navigation.navigate('MapPreview', { areaId: item.Area_ID })
      }
    >
      <Text style={localStyles.cardTitle} numberOfLines={1}>
        {item.Area_Name}
      </Text>
      <Text style={localStyles.cardDetails}>Region: {item.Region}</Text>
      <Text style={localStyles.cardDetails}>Province: {item.Province}</Text>
      <Text style={localStyles.cardDetails}>
        Coordinates: {item.coordinates.length}
      </Text>
      <Text style={localStyles.cardDetails}>Images: {item.images.length}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[localStyles.safeArea, { paddingTop: insets.top }]}>
      <View style={localStyles.header}>
        <View style={localStyles.headerTopRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={localStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
          </TouchableOpacity>
          <View style={localStyles.headerTitleContainer}>
            <Text style={localStyles.title}>Map Entries</Text>
          </View>
          <View style={{ width: 34 }} />
        </View>
        <TextInput
          style={[Styles.inputFields, { width: '100%' }]} // Using global inputFields style
          placeholder="Search for an area..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isLoading && !isFetchingMore ? (
        <View style={[localStyles.loadingContainer, { flex: 1 }]}>
          <ActivityIndicator
            size="large"
            color={Styles.button.backgroundColor}
          />
          <Text style={[Styles.text, { marginTop: 10, color: '#888' }]}>
            Loading entries...
          </Text>
        </View>
      ) : error ? (
        <View style={[localStyles.loadingContainer, { flex: 1 }]}>
          <Text style={localStyles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchEntries(1)}
            style={{ marginTop: 10 }}
          >
            <Text
              style={[Styles.buttonText, { textDecorationLine: 'underline' }]}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : entries.length > 0 ? (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.Area_ID)}
          renderItem={renderItem}
          contentContainerStyle={localStyles.listContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            hasMore ? (
              <View style={localStyles.loadingContainer}>
                <TouchableOpacity
                  onPress={handleLoadMore}
                  style={localStyles.loadMoreButton}
                  disabled={isFetchingMore}
                >
                  {isFetchingMore ? (
                    <ActivityIndicator
                      size="small"
                      color={Styles.buttonText.color}
                    />
                  ) : (
                    <Text style={localStyles.loadMoreText}>Load More</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={localStyles.loadingContainer}>
                <Text style={localStyles.emptyText}>End of results.</Text>
              </View>
            )
          }
        />
      ) : (
        <View style={[localStyles.loadingContainer, { flex: 1 }]}>
          <Text style={localStyles.emptyText}>No entries found.</Text>
        </View>
      )}
    </View>
  );
}
