import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../context/AuthContext';

import { Marker, Polyline, Area, DraftData } from './Map';

type DraftListItem = {
  key: string;
  data: DraftData;
};

export default function DraftsPage({ navigation }: any) {
  const { userData } = useAuth();
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const keysRaw = await AsyncStorage.getItem('draft_keys');
      let keys: string[] = [];
      if (keysRaw) {
        try {
          keys = JSON.parse(keysRaw);
          if (!Array.isArray(keys)) keys = [];
        } catch {
          keys = [];
        }
      }
      const userId = userData?.user_id ? String(userData.user_id) : null;
      // Debug log
      console.log('[DraftsPage] Loaded keys:', keys);
      console.log('[DraftsPage] userId:', userId);
      // Show all drafts if userId is not set
      let userDraftKeys: string[];
      if (userId) {
        userDraftKeys = keys.filter((k) => k.startsWith(`draft_${userId}_`));
      } else {
        userDraftKeys = keys;
      }
      console.log('[DraftsPage] Filtered userDraftKeys:', userDraftKeys);
      const draftPairs = await AsyncStorage.multiGet(userDraftKeys);
      const draftList: DraftListItem[] = draftPairs
        .map(([key, value]) => {
          if (!value) return null;
          try {
            return { key, data: JSON.parse(value) };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as DraftListItem[];
      setDrafts(draftList);
    } catch (e) {
      Alert.alert('Error', 'Failed to load drafts.');
    }
    setLoading(false);
  };

  const handleOpenDraft = (draft: DraftListItem) => {
    navigation.navigate('Map', { draft: draft.data });
  };

  const handleDeleteDraft = async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
      let keysRaw = await AsyncStorage.getItem('draft_keys');
      let keys: string[] = [];
      if (keysRaw) {
        try {
          keys = JSON.parse(keysRaw);
          if (!Array.isArray(keys)) keys = [];
        } catch {
          keys = [];
        }
      }
      keys = keys.filter((k) => k !== key);
      await AsyncStorage.setItem('draft_keys', JSON.stringify(keys));
      loadDrafts();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete draft.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Drafts</Text>
      <Button
        title="Create New Map Input"
        onPress={() => navigation.navigate('Map', { draft: null })}
      />
      <Text style={{ marginTop: 20, fontWeight: 'bold' }}>Saved Drafts</Text>
      {loading ? (
        <Text>Loading...</Text>
      ) : drafts.length === 0 ? (
        <Text>No drafts found.</Text>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <View style={styles.draftItem}>
              <TouchableOpacity onPress={() => handleOpenDraft(item)}>
                <Text style={styles.draftKey}>{item.key}</Text>
                <Text>Markers: {item.data.markers.length}</Text>
                <Text>Photos: {item.data.photos.length}</Text>
              </TouchableOpacity>
              <Button
                title="Delete"
                color="red"
                onPress={() => handleDeleteDraft(item.key)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  draftItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  draftKey: { fontWeight: 'bold' },
});
