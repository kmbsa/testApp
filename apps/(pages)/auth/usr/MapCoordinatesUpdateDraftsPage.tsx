import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/build/Ionicons';

import Styles from '../../../styles/styles';
import type { MapCoordinatesUpdateDraftsPageProps } from '../../../navigation/types';
import {
  loadMapCoordinatesUpdateDrafts,
  deleteMapCoordinatesUpdateDraft,
  StoredMapCoordinatesUpdateDraft,
} from './MapCoordinatesUpdate';

const MapCoordinatesUpdateDraftsPage = () => {
  const navigation =
    useNavigation<MapCoordinatesUpdateDraftsPageProps['navigation']>();
  const [drafts, setDrafts] = useState<StoredMapCoordinatesUpdateDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedDrafts = await loadMapCoordinatesUpdateDrafts();
      setDrafts(loadedDrafts);
    } catch (error) {
      console.error('Failed to load drafts:', error);
      Alert.alert('Error', 'Failed to load drafts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts]),
  );

  const handleDeleteDraft = (draftKey: string, areaName: string) => {
    Alert.alert(
      'Delete Draft',
      `Are you sure you want to delete the draft for "${areaName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteMapCoordinatesUpdateDraft(draftKey);
              loadDrafts();
            } catch (error) {
              console.error('Failed to delete draft:', error);
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  const handleOpenDraft = (draft: StoredMapCoordinatesUpdateDraft) => {
    // Navigate to MapCoordinatesUpdate with the draft data
    navigation.navigate('MapCoordinatesUpdate', {
      areaId: draft.areaId,
      draftData: {
        coordinates: draft.coordinates,
        areaName: draft.areaName,
        hectares: draft.hectares,
        province: draft.province,
        region: draft.region,
      },
    });
  };

  const renderDraftItem = (item: StoredMapCoordinatesUpdateDraft) => {
    const createdDate = new Date(item.createdAt).toLocaleDateString();

    return (
      <TouchableOpacity
        style={localStyles.draftCard}
        onPress={() => handleOpenDraft(item)}
      >
        <View style={localStyles.draftInfo}>
          <Text style={localStyles.draftAreaName}>{item.areaName}</Text>
          <Text style={localStyles.draftDetail}>
            Hectares: {item.hectares.toFixed(2)}
          </Text>
          <Text style={localStyles.draftDetail}>
            Points: {item.coordinates.length}
          </Text>
          <Text style={localStyles.draftDate}>{createdDate}</Text>
        </View>

        <TouchableOpacity
          style={localStyles.deleteButton}
          onPress={() => handleDeleteDraft(item.draftKey, item.areaName)}
        >
          <Ionicons name="trash" size={24} color="red" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={localStyles.container}>
        <View style={localStyles.centerContainer}>
          <ActivityIndicator
            size="large"
            color={Styles.button.backgroundColor}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (drafts.length === 0) {
    return (
      <SafeAreaView style={localStyles.container}>
        <View style={localStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
          </TouchableOpacity>
          <Text style={localStyles.headerTitle}>
            Map Coordinate Update Drafts
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={localStyles.centerContainer}>
          <Text style={localStyles.emptyText}>No drafts saved yet.</Text>
          <Text style={localStyles.emptySubText}>
            Save a draft while editing map coordinates to see it here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={localStyles.container}>
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
        </TouchableOpacity>
        <Text style={localStyles.headerTitle}>
          Map Coordinate Update Drafts ({drafts.length})
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={drafts}
        renderItem={({ item }) => renderDraftItem(item)}
        keyExtractor={(item) => item.draftKey}
        contentContainerStyle={localStyles.listContainer}
      />
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Styles.background.backgroundColor,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Styles.text.color,
  },
  listContainer: {
    padding: 15,
  },
  draftCard: {
    flexDirection: 'row',
    backgroundColor: Styles.formBox.backgroundColor,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  draftInfo: {
    flex: 1,
    marginRight: 10,
  },
  draftAreaName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Styles.text.color,
    marginBottom: 5,
  },
  draftDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  draftDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  deleteButton: {
    padding: 10,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Styles.text.color,
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 20,
  },
});

export default MapCoordinatesUpdateDraftsPage;
