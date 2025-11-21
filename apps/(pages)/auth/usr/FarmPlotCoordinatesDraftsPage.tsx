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
import type { FarmPlotCoordinatesDraftsPageProps } from '../../../navigation/types';
import {
  loadFarmPlotCoordinatesDrafts,
  deleteFarmPlotCoordinatesDraft,
  StoredFarmPlotCoordinatesDraft,
} from './FarmPlotCoordinates';

const FarmPlotCoordinatesDraftsPage = () => {
  const navigation =
    useNavigation<FarmPlotCoordinatesDraftsPageProps['navigation']>();
  const [drafts, setDrafts] = useState<StoredFarmPlotCoordinatesDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedDrafts = await loadFarmPlotCoordinatesDrafts();
      setDrafts(loadedDrafts);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Failed to load drafts:', error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts]),
  );

  const handleDeleteDraft = (draftKey: string, areaId: number) => {
    Alert.alert(
      'Delete Draft',
      `Are you sure you want to delete this farm plot draft (Area ID: ${areaId})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteFarmPlotCoordinatesDraft(draftKey);
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

  const handleOpenDraft = (draft: StoredFarmPlotCoordinatesDraft) => {
    // Navigate to FarmPlotCoordinates with the draft data
    navigation.navigate('FarmPlotCoordinates', {
      areaId: draft.areaId,
      farmId: draft.farmId,
      draftData: {
        coordinates: draft.coordinates,
        soilType: draft.soilType,
        soilSuitability: draft.soilSuitability,
        hectares: draft.hectares,
        status: draft.status,
      },
    });
  };

  const renderDraftItem = (item: StoredFarmPlotCoordinatesDraft) => {
    const createdDate = new Date(item.createdAt).toLocaleDateString();

    return (
      <TouchableOpacity
        style={localStyles.draftCard}
        onPress={() => handleOpenDraft(item)}
      >
        <View style={localStyles.draftInfo}>
          <Text style={localStyles.draftTitle}>
            {item.farmId
              ? `Farm ID: ${item.farmId} (Editing)`
              : 'New Farm Plot'}
          </Text>
          <Text style={localStyles.draftDetail}>Area ID: {item.areaId}</Text>
          <Text style={localStyles.draftDetail}>
            Soil Type: {item.soilType}
          </Text>
          <Text style={localStyles.draftDetail}>
            Suitability: {item.soilSuitability}
          </Text>
          <Text style={localStyles.draftDetail}>
            Hectares: {item.hectares.toFixed(2)}
          </Text>
          <Text style={localStyles.draftDate}>{createdDate}</Text>
        </View>

        <TouchableOpacity
          style={localStyles.deleteButton}
          onPress={() => handleDeleteDraft(item.draftKey, item.areaId)}
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

  if (error) {
    return (
      <SafeAreaView style={localStyles.container}>
        <View style={localStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
          </TouchableOpacity>
          <Text style={localStyles.headerTitle}>
            Farm Plot Drafts
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={localStyles.centerContainer}>
          <Text style={localStyles.emptyText}>Error Loading Drafts</Text>
          <Text style={localStyles.emptySubText}>{error}</Text>
          <TouchableOpacity
            style={[localStyles.draftButton, { marginTop: 20 }]}
            onPress={() => loadDrafts()}
          >
            <Text style={localStyles.draftButtonText}>Retry</Text>
          </TouchableOpacity>
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
          <Text style={localStyles.headerTitle}>Farm Plot Drafts</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={localStyles.centerContainer}>
          <Text style={localStyles.emptyText}>No drafts saved yet.</Text>
          <Text style={localStyles.emptySubText}>
            Save a draft while creating or editing farm plots to see it here.
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
          Farm Plot Drafts ({drafts.length})
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
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  draftInfo: {
    flex: 1,
    marginRight: 10,
  },
  draftTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Styles.text.color,
    marginBottom: 5,
  },
  draftDetail: {
    fontSize: 13,
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
    marginTop: 5,
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
  draftButton: {
    backgroundColor: Styles.button.backgroundColor,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  draftButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default FarmPlotCoordinatesDraftsPage;
