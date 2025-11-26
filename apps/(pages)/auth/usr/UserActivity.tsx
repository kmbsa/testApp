import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_URL } from '@env';
import Styles from '../../../styles/styles';

import { useAuth } from '../../../context/AuthContext';
import { ActivityLog } from '../../../navigation/types';
import { getDeviceHeader } from '../../../utils/deviceDetection';

interface ActivityResponse {
  logs: ActivityLog[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

type ActivityTypeFilter =
  | 'ALL'
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'REGISTRATION';
type EntityTypeFilter =
  | 'ALL'
  | 'USER'
  | 'AREA'
  | 'FARM'
  | 'FARM_HARVEST'
  | 'USER_CREDENTIALS';

const ACTIVITY_TYPES: { label: string; value: ActivityTypeFilter }[] = [
  { label: 'All Activities', value: 'ALL' },
  { label: 'Login', value: 'LOGIN' },
  { label: 'Logout', value: 'LOGOUT' },
  { label: 'Create', value: 'CREATE' },
  { label: 'Update', value: 'UPDATE' },
  { label: 'Registration', value: 'REGISTRATION' },
];

const ENTITY_TYPES: { label: string; value: EntityTypeFilter }[] = [
  { label: 'All Entities', value: 'ALL' },
  { label: 'User', value: 'USER' },
  { label: 'Area', value: 'AREA' },
  { label: 'Farm', value: 'FARM' },
  { label: 'Farm Harvest', value: 'FARM_HARVEST' },
  { label: 'Credentials', value: 'USER_CREDENTIALS' },
];

// Helper to get color for activity type
const getActivityTypeColor = (activityType: string): string => {
  switch (activityType) {
    case 'LOGIN':
    case 'REGISTRATION':
      return '#90EE90'; // Light green
    case 'LOGOUT':
      return '#FF6B6B'; // Red
    case 'CREATE':
      return '#87CEEB'; // Sky blue
    case 'UPDATE':
      return '#DA70D6'; // Purple
    case 'LOGIN_FAILED':
      return '#FF4444'; // Dark red
    default:
      return '#FFD700'; // Gold
  }
};

// Helper to get icon for activity type
const getActivityTypeIcon = (activityType: string): string => {
  switch (activityType) {
    case 'LOGIN':
      return 'log-in';
    case 'LOGOUT':
      return 'log-out';
    case 'CREATE':
      return 'add-circle';
    case 'UPDATE':
      return 'create';
    case 'REGISTRATION':
      return 'person-add';
    case 'LOGIN_FAILED':
      return 'alert-circle';
    default:
      return 'info-circle';
  }
};

// Helper to format timestamp
const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    return timestamp;
  }
};

export default function UserActivityScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userToken: token } = useAuth();

  // State
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(
    null,
  );
  const [entityName, setEntityName] = useState<string>('');
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Filter state
  const [activityTypeFilter, setActivityTypeFilter] =
    useState<ActivityTypeFilter>('ALL');
  const [entityTypeFilter, setEntityTypeFilter] =
    useState<EntityTypeFilter>('ALL');
  const [showActivityTypeMenu, setShowActivityTypeMenu] = useState(false);
  const [showEntityTypeMenu, setShowEntityTypeMenu] = useState(false);

  // Fetch activity logs
  const fetchActivityLogs = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (!token) {
        Alert.alert(
          'Authentication Error',
          'User token not found. Please log in again.',
        );
        return;
      }

      if (!API_URL) {
        Alert.alert('Configuration Error', 'API URL is not configured.');
        if (!append) setIsLoading(false);
        return;
      }

      if (!append) {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('per_page', '20');

        if (activityTypeFilter !== 'ALL') {
          params.append('activity_type', activityTypeFilter);
        }
        if (entityTypeFilter !== 'ALL') {
          params.append('entity_type', entityTypeFilter);
        }

        const response = await axios.get<ActivityResponse>(
          `${API_URL}/auth/activity-logs?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              ...getDeviceHeader(),
            },
          },
        );

        if (append) {
          setActivities((prev) => [...prev, ...(response.data.logs || [])]);
        } else {
          setActivities(response.data.logs || []);
        }

        setCurrentPage(page);
        setTotalPages(response.data.pages || 1);
        setHasMorePages(page < (response.data.pages || 1));
      } catch (error) {
        console.error('Failed to fetch activity logs:', error);
        if (!append) {
          Alert.alert(
            'Error',
            'Failed to load activity logs. Please try again.',
          );
          setActivities([]);
        }
      } finally {
        if (!append) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
        setIsRefreshing(false);
      }
    },
    [token, activityTypeFilter, entityTypeFilter],
  );

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchActivityLogs(1, false);
  }, [activityTypeFilter, entityTypeFilter, fetchActivityLogs]);

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchActivityLogs(1, false);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (currentPage < totalPages && !isLoadingMore) {
      setIsLoadingMore(true);
      fetchActivityLogs(currentPage + 1, true);
    }
  };

  // Fetch entity name based on type and ID
  const fetchEntityName = useCallback(
    async (entityType: string, entityId: number | null) => {
      if (!entityId || !token) {
        setEntityName('N/A');
        return;
      }

      try {
        let name = '';

        if (entityType === 'AREA') {
          const response = await axios.get(`${API_URL}/area/${entityId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              ...getDeviceHeader(),
            },
          });
          name = response.data.area?.Area_Name || 'Unknown Area';
        } else if (entityType === 'FARM') {
          const response = await axios.get(
            `${API_URL}/area/1/farm/${entityId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...getDeviceHeader(),
              },
            },
          );
          name = response.data.farm?.Soil_Type || 'Unknown Farm';
        } else {
          name = 'N/A';
        }

        setEntityName(name);
      } catch (error) {
        console.error('Failed to fetch entity name:', error);
        setEntityName('Unknown');
      }
    },
    [token],
  );

  // Render activity log item
  const renderActivityItem = ({ item }: { item: ActivityLog }) => (
    <TouchableOpacity
      style={localStyles.activityCard}
      onPress={() => {
        setSelectedActivity(item);
        fetchEntityName(item.Entity_Type, item.Entity_ID);
        setDetailsModalVisible(true);
      }}
    >
      <View style={localStyles.activityCardContent}>
        <View style={localStyles.activityTypeIconContainer}>
          <View
            style={[
              localStyles.iconBadge,
              {
                backgroundColor: getActivityTypeColor(item.Activity_Type),
              },
            ]}
          >
            <Ionicons
              name={getActivityTypeIcon(item.Activity_Type) as any}
              size={20}
              color="white"
            />
          </View>
        </View>

        <View style={localStyles.activityInfo}>
          <Text style={localStyles.activityTitle}>
            {item.Activity_Type.replace(/_/g, ' ')}
          </Text>
          <Text style={localStyles.activityDescription} numberOfLines={2}>
            {item.Description}
          </Text>
          <View style={localStyles.metaRow}>
            <Text style={localStyles.entityType}>{item.Entity_Type}</Text>
            <Text style={localStyles.timestamp}>
              {formatTimestamp(item.Timestamp)}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={24} color="#F4D03F" />
      </View>
    </TouchableOpacity>
  );

  // Render filter menu modal
  const renderFilterMenu = (
    items: { label: string; value: string }[],
    currentValue: string,
    onSelect: (value: string) => void,
    onClose: () => void,
  ) => (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={localStyles.filterMenuOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={localStyles.filterMenuContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={localStyles.filterMenuItem}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    localStyles.filterMenuItemText,
                    item.value === currentValue &&
                      localStyles.filterMenuItemTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {item.value === currentValue && (
                  <Ionicons name="checkmark" size={20} color="#3D550C" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Render details modal
  const renderDetailsModal = () => {
    if (!selectedActivity) return null;

    return (
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View
          style={[localStyles.detailsContainer, { paddingTop: insets.top }]}
        >
          <View style={localStyles.detailsHeader}>
            <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
              <Ionicons name="close" size={28} color={Styles.text.color} />
            </TouchableOpacity>
            <Text style={localStyles.detailsTitle}>Activity Details</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={localStyles.detailsContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={localStyles.detailsCard}>
              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>Activity Type</Text>
                <Text style={localStyles.detailsValue}>
                  {selectedActivity.Activity_Type.replace(/_/g, ' ')}
                </Text>
              </View>

              <View style={localStyles.divider} />

              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>Entity Type</Text>
                <Text style={localStyles.detailsValue}>
                  {selectedActivity.Entity_Type}
                </Text>
              </View>

              <View style={localStyles.divider} />

              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>Target Name</Text>
                <Text style={localStyles.detailsValue}>
                  {entityName || 'Loading...'}
                </Text>
              </View>

              <View style={localStyles.divider} />

              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>Description</Text>
                <Text style={localStyles.detailsValueLarge}>
                  {selectedActivity.Description}
                </Text>
              </View>

              <View style={localStyles.divider} />

              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>Device</Text>
                <Text style={localStyles.detailsValue}>
                  {selectedActivity.Device}
                </Text>
              </View>

              <View style={localStyles.divider} />

              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>IP Address</Text>
                <Text
                  style={[
                    localStyles.detailsValue,
                    { fontFamily: 'monospace' },
                  ]}
                >
                  {selectedActivity.IPv4_Address}
                </Text>
              </View>

              <View style={localStyles.divider} />

              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>Timestamp</Text>
                <Text style={localStyles.detailsValue}>
                  {formatTimestamp(selectedActivity.Timestamp)}
                </Text>
              </View>

              <View style={localStyles.divider} />

              <View style={localStyles.detailsRow}>
                <Text style={localStyles.detailsLabel}>User Agent</Text>
                <Text
                  style={[
                    localStyles.detailsValueSmall,
                    { fontFamily: 'monospace' },
                  ]}
                  numberOfLines={3}
                >
                  {selectedActivity.User_Agent}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[localStyles.safeArea, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={localStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
        </TouchableOpacity>
        <Text style={localStyles.headerTitle}>Activity Log</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Filters */}
      <View style={localStyles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={localStyles.filterScroll}
        >
          <TouchableOpacity
            style={localStyles.filterButton}
            onPress={() => setShowActivityTypeMenu(true)}
          >
            <Text style={localStyles.filterButtonText}>
              Activity:{' '}
              {activityTypeFilter === 'ALL' ? 'All' : activityTypeFilter}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#F4D03F" />
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.filterButton}
            onPress={() => setShowEntityTypeMenu(true)}
          >
            <Text style={localStyles.filterButtonText}>
              Entity: {entityTypeFilter === 'ALL' ? 'All' : entityTypeFilter}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#F4D03F" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Activity List */}
      {isLoading ? (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#3D550C" />
          <Text style={localStyles.loadingText}>Loading activity logs...</Text>
        </View>
      ) : activities.length === 0 ? (
        <View style={localStyles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color="#ccc" />
          <Text style={localStyles.emptyText}>No activity records found</Text>
          <Text style={localStyles.emptySubtext}>
            Your activities will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={(item, index) => `${item?.Activity_Log_ID || index}`}
          contentContainerStyle={localStyles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#3D550C']}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            isLoadingMore ? (
              <View style={localStyles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#3D550C" />
                <Text style={localStyles.loadMoreText}>Loading more...</Text>
              </View>
            ) : currentPage === totalPages && activities.length > 0 ? (
              <View style={localStyles.endOfListContainer}>
                <Text style={localStyles.endOfListText}>
                  No more activities to load
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Filter Menus */}
      {showActivityTypeMenu &&
        renderFilterMenu(
          ACTIVITY_TYPES,
          activityTypeFilter,
          (value) => setActivityTypeFilter(value as ActivityTypeFilter),
          () => setShowActivityTypeMenu(false),
        )}

      {showEntityTypeMenu &&
        renderFilterMenu(
          ENTITY_TYPES,
          entityTypeFilter,
          (value) => setEntityTypeFilter(value as EntityTypeFilter),
          () => setShowEntityTypeMenu(false),
        )}

      {/* Details Modal */}
      {detailsModalVisible && renderDetailsModal()}
    </View>
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5DC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#F4D03F',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Styles.text.color,
    textAlign: 'center',
    flex: 1,
  },
  filterContainer: {
    backgroundColor: '#F5F5DC',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4D03F',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 5,
    backgroundColor: '#3D550C',
    borderRadius: 20,
    borderWidth: 0,
  },
  filterButtonText: {
    fontSize: 13,
    color: '#F4D03F',
    marginRight: 6,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 5,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  activityCard: {
    marginVertical: 6,
    backgroundColor: '#3D550C',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activityCardContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-start',
  },
  activityTypeIconContainer: {
    marginRight: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F4D03F',
  },
  activityDescription: {
    fontSize: 13,
    color: '#E8E8E8',
    marginTop: 4,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entityType: {
    fontSize: 11,
    color: '#3D550C',
    fontWeight: '600',
    backgroundColor: '#F4D03F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#B8B89F',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 13,
    color: '#3D550C',
    fontWeight: '500',
  },
  endOfListContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  endOfListText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  filterMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterMenuContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '70%',
    paddingVertical: 10,
  },
  filterMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterMenuItemText: {
    fontSize: 16,
    color: '#666',
  },
  filterMenuItemTextActive: {
    color: '#3D550C',
    fontWeight: '700',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#F5F5DC',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#F4D03F',
    backgroundColor: '#F5F5DC',
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Styles.text.color,
  },
  detailsContent: {
    flex: 1,
    padding: 15,
  },
  detailsCard: {
    backgroundColor: '#3D550C',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  detailsRow: {
    paddingVertical: 10,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B8B89F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  detailsValue: {
    fontSize: 15,
    color: '#F4D03F',
    fontWeight: '500',
  },
  detailsValueLarge: {
    fontSize: 14,
    color: '#F4D03F',
    lineHeight: 20,
  },
  detailsValueSmall: {
    fontSize: 12,
    color: '#E8E8E8',
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F4D03F',
    marginVertical: 5,
  },
});
