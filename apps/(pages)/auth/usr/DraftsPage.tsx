import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SafeAreaView } from 'react-native-safe-area-context';

import * as FileSystem from 'expo-file-system/legacy';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';

import { DraftData, StoredDraftData } from './Map';

import Styles from '../../../styles/styles';

const AppColors = {
  primary: '#3D550C',
  secondary: '#F4D03F',
  background: '#F5F5DC',
  formInput: '#FFFFFF',
  textPrimary: '#3D550C',
  textSecondary: '#666666',
  danger: 'red',
  border: '#3D550C',
  shadow: '#000000',
};

// Consolidated structure
const AppConstants = {
  colors: AppColors,
  padding: { horizontal: 10 },
  shadow: {
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
};

// --- TYPE DEFINITIONS ---
type DraftListItem = {
  key: string; // The AsyncStorage key
  data: DraftData; // The actual draft content
};

// --- CONSTANTS ---
const DRAFT_KEYS_KEY = 'draft_keys'; // Key storing the array of all draft keys
const DRAFT_DIR_BASE = `${FileSystem.documentDirectory}drafts/`; // Directory for file deletion

// --- MAIN COMPONENT ---
export default function DraftsPage({ navigation }: any) {
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDraftKeys, setSelectedDraftKeys] = useState<string[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [currentDraftToRename, setCurrentDraftToRename] =
    useState<DraftListItem | null>(null);
  const [newDraftName, setNewDraftName] = useState('');

  // --- DRAFT LOADING LOGIC ---
  const loadDrafts = async () => {
    setLoading(true);
    try {
      // 1. Load all saved draft keys
      const keysRaw = await AsyncStorage.getItem(DRAFT_KEYS_KEY);
      let allKeys: string[] = [];
      if (keysRaw) {
        try {
          allKeys = JSON.parse(keysRaw);
          if (!Array.isArray(allKeys)) allKeys = [];
        } catch {
          allKeys = [];
        }
      }

      // 2. Load the drafts based on the keys
      const draftPairs = await AsyncStorage.multiGet(allKeys);

      // 3. Process loaded data
      const loadedDrafts: DraftListItem[] = draftPairs
        .map(([key, value]) => {
          if (!value) return null;
          try {
            const data: DraftData = JSON.parse(value);
            // Fallback for draftName if not present
            const name =
              data.form?.draftName ||
              key.split('_').slice(2, -1).join(' ') ||
              'Untitled Draft';
            data.form = { ...data.form, draftName: name }; // Ensure name is always set
            return {
              key,
              data,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as DraftListItem[];

      setDrafts(loadedDrafts);
    } catch (e) {
      console.error('Failed to load drafts:', e);
      Alert.alert('Error', 'Failed to load drafts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
    // Clear selection when leaving the page
    const unsubscribe = navigation.addListener('blur', () => {
      setIsEditMode(false);
      setSelectedDraftKeys([]);
    });
    return unsubscribe;
  }, [navigation]);

  // --- DRAFT ACTION HANDLERS ---

  const handleOpenDraft = (draft: DraftListItem) => {
    if (isEditMode) {
      handleToggleSelect(draft.key);
      return;
    }
    // Pass the full DraftData and key to the Map screen
    navigation.navigate('Map', { draft: draft.data, draftKey: draft.key });
  };

  const handleToggleSelect = (key: string) => {
    setSelectedDraftKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // 1. Single/Multi-Draft Deletion with Confirmation
  const handleDeleteDrafts = async (keysToDelete: string[]) => {
    if (keysToDelete.length === 0) return;

    Alert.alert(
      'Confirm Permanent Deletion',
      `Are you sure you want to permanently delete ${keysToDelete.length} draft(s)? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the draft from AsyncStorage
              await AsyncStorage.multiRemove(keysToDelete);

              // Update the list of all draft keys stored for future loads
              const updatedKeys = drafts
                .map((d) => d.key)
                .filter((key) => !keysToDelete.includes(key));

              await AsyncStorage.setItem(
                DRAFT_KEYS_KEY,
                JSON.stringify(updatedKeys),
              );

              // Remove the associated physical files
              keysToDelete.forEach(async (key) => {
                const draftDir = `${DRAFT_DIR_BASE}${key}`;
                await FileSystem.deleteAsync(draftDir, { idempotent: true });
              });

              // Update state and clear selection
              setDrafts((prev) =>
                prev.filter((d) => !keysToDelete.includes(d.key)),
              );
              setSelectedDraftKeys([]);
              setIsEditMode(false);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete draft(s).');
              console.error('Deletion error:', e);
            }
          },
        },
      ],
    );
  };

  // 2. Draft Renaming
  const handleStartRename = (draft: DraftListItem) => {
    if (!isEditMode) return;
    setCurrentDraftToRename(draft);
    setNewDraftName(draft.data.form?.draftName || '');
    setIsRenaming(true);
  };

  const handleFinishRename = async () => {
    if (!currentDraftToRename || !newDraftName.trim()) {
      setIsRenaming(false);
      return;
    }

    try {
      // 1. Get the draft data again to ensure we don't overwrite concurrent changes
      const draftRaw = await AsyncStorage.getItem(currentDraftToRename.key);
      if (!draftRaw) throw new Error('Draft not found during rename.');

      const storedData: StoredDraftData = JSON.parse(draftRaw);

      // 2. Update the draft name in the form data
      const updatedData: StoredDraftData = {
        ...storedData,
        form: { ...storedData.form, draftName: newDraftName.trim() },
      };

      // 3. Save the updated data back to AsyncStorage
      await AsyncStorage.setItem(
        currentDraftToRename.key,
        JSON.stringify(updatedData),
      );

      // 4. Update the local component state
      setDrafts((prev) =>
        prev.map((d) =>
          d.key === currentDraftToRename.key
            ? { ...d, data: { ...d.data, form: updatedData.form } }
            : d,
        ),
      );

      Alert.alert(
        'Success',
        `Draft successfully renamed to "${newDraftName.trim()}"`,
      );
    } catch (e) {
      console.error('Rename error:', e);
      Alert.alert('Error', 'Failed to rename the draft.');
    } finally {
      setIsRenaming(false);
      setCurrentDraftToRename(null);
      setNewDraftName('');
    }
  };

  // --- RENDER FUNCTIONS ---

  const renderDraftItem = ({ item }: { item: DraftListItem }) => {
    const isSelected = selectedDraftKeys.includes(item.key);

    // Check for required data (for display)
    const markerCount = item.data.markers?.length || 0;
    const photoCount = item.data.photos?.length || 0;

    return (
      <TouchableOpacity
        style={[
          localStyles.draftItem,
          isSelected && localStyles.draftItemSelected,
        ]}
        onPress={() => handleOpenDraft(item)}
        // Long press now only toggles edit mode if not already in it, otherwise it does nothing.
        onLongPress={() => !isEditMode && setIsEditMode(true)}
      >
        {/* SELECTION CHECKBOX (Only visible in edit mode) */}
        {isEditMode && (
          <TouchableOpacity
            onPress={() => handleToggleSelect(item.key)}
            style={localStyles.iconContainer}
          >
            <MaterialIcons
              name={isSelected ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={
                isSelected
                  ? AppConstants.colors.secondary
                  : AppConstants.colors.textSecondary
              }
            />
          </TouchableOpacity>
        )}

        {/* DRAFT CONTENT */}
        <View
          style={[localStyles.draftContent, !isEditMode && { paddingLeft: 0 }]}
        >
          {/* DRAFT NAME */}
          <Text style={localStyles.draftName} numberOfLines={1}>
            {item.data.form?.draftName || 'Untitled Draft'}
          </Text>

          {/* METADATA */}
          <View style={localStyles.metadataRow}>
            <Text style={localStyles.metadataText}>
              <FontAwesome5
                name="map-marker-alt"
                size={12}
                color={AppConstants.colors.textSecondary}
              />
              {` ${markerCount} Points`}
            </Text>
            <Text style={localStyles.metadataText}>
              <MaterialIcons
                name="photo"
                size={14}
                color={AppConstants.colors.textSecondary}
              />
              {/* NOTE: We check the length of the photos array from the DraftData */}
              {` ${photoCount} Photos`}
            </Text>
          </View>
        </View>

        {/* ACTIONS (Rename) */}
        {isEditMode && (
          <TouchableOpacity
            onPress={() => handleStartRename(item)}
            style={[localStyles.iconContainer, { marginLeft: 10 }]}
          >
            <MaterialIcons
              name="edit"
              size={20}
              color={AppConstants.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // --- MAIN RENDER ---

  return (
    <SafeAreaView style={localStyles.safeArea}>
      <View style={localStyles.container}>
        {/* HEADER AREA */}
        <View style={localStyles.header}>
          {/* NEW: BACK BUTTON */}
          <TouchableOpacity
            style={localStyles.backButton}
            // Navigate directly to the 'Home' screen
            onPress={() => navigation.navigate('Home')}
          >
            <MaterialIcons
              name="arrow-back"
              size={28}
              color={AppConstants.colors.primary}
            />
          </TouchableOpacity>

          {/* CENTERED TITLE */}
          <Text style={localStyles.title}>Drafts</Text>

          {/* RIGHT: EDIT/DONE BUTTON */}
          <TouchableOpacity
            style={localStyles.editButton}
            onPress={() => {
              setIsEditMode(!isEditMode);
              setSelectedDraftKeys([]);
            }}
          >
            <Text style={localStyles.editButtonText}>
              {isEditMode ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* LIST & LOADING STATE */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={AppConstants.colors.secondary}
            style={{ marginTop: 50 }}
          />
        ) : drafts.length === 0 ? (
          <View style={localStyles.emptyState}>
            <Text style={localStyles.emptyText}>No drafts found.</Text>
            <TouchableOpacity
              style={[Styles.button, localStyles.newDraftButton]}
              onPress={() => navigation.navigate('Map', { draft: null })}
            >
              <Text style={Styles.buttonText}>Start New Map Input</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={drafts}
            keyExtractor={(item) => item.key}
            renderItem={renderDraftItem}
            contentContainerStyle={localStyles.listContent}
          />
        )}

        {/* BOTTOM ACTION BAR (Multi-Delete / New Draft Button) */}
        <View style={localStyles.bottomBar}>
          {isEditMode && selectedDraftKeys.length > 0 ? (
            <TouchableOpacity
              style={[Styles.button, localStyles.deleteButton]}
              onPress={() => handleDeleteDrafts(selectedDraftKeys)}
            >
              <Text style={Styles.buttonText}>
                Delete Selected ({selectedDraftKeys.length})
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[Styles.button, localStyles.newDraftButton]}
              onPress={() => navigation.navigate('Map', { draft: null })}
            >
              <Text style={Styles.buttonText}>Start New Map Input</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* RENAME MODAL */}
        <Modal
          visible={isRenaming}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsRenaming(false)}
        >
          <View style={localStyles.modalOverlay}>
            <View style={localStyles.modalContent}>
              <Text style={localStyles.modalTitle}>Rename Draft</Text>
              <TextInput
                style={localStyles.modalInput}
                placeholder="Enter new draft name"
                placeholderTextColor={AppConstants.colors.textSecondary}
                value={newDraftName}
                onChangeText={setNewDraftName}
                autoFocus
              />
              <View style={localStyles.modalButtonContainer}>
                <TouchableOpacity
                  style={[Styles.button, localStyles.modalCancelButton]}
                  onPress={() => setIsRenaming(false)}
                >
                  <Text style={Styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[Styles.button, localStyles.modalConfirmButton]}
                  onPress={handleFinishRename}
                  disabled={!newDraftName.trim()}
                >
                  <Text style={Styles.buttonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// --- LOCAL STYLES (Updated to support the back button and centered title) ---
const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppConstants.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: AppConstants.padding.horizontal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Keeps Back/Edit buttons on edges
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: AppConstants.colors.border,
    marginBottom: 10,
    position: 'relative', // Necessary for absolute positioning of the title
  },
  backButton: {
    padding: 8,
    zIndex: 10, // Ensures the button is tappable
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppConstants.colors.primary,
    // Absolute positioning to center the title regardless of button sizes
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1, // Ensure the title doesn't cover tappable buttons
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: AppConstants.colors.formInput,
    shadowColor: AppConstants.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10, // Ensures the button is tappable
  },
  editButtonText: {
    color: AppConstants.colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 100, // Ensure space for the bottom action bar
  },
  draftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppConstants.colors.formInput,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    ...AppConstants.shadow,
  },
  draftItemSelected: {
    borderWidth: 3,
    borderColor: AppConstants.colors.secondary,
  },
  draftContent: {
    flex: 1,
    paddingHorizontal: 15,
  },
  draftName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppConstants.colors.textPrimary,
    marginBottom: 5,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 5,
  },
  metadataText: {
    fontSize: 12,
    color: AppConstants.colors.textSecondary,
    marginRight: 15,
  },
  iconContainer: {
    padding: 5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: AppConstants.colors.background,
    borderTopWidth: 1,
    borderTopColor: AppConstants.colors.border,
  },
  newDraftButton: {
    width: '100%',
    marginTop: 0,
  },
  deleteButton: {
    width: '100%',
    backgroundColor: AppConstants.colors.danger,
    marginTop: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: AppConstants.colors.textSecondary,
    marginBottom: 20,
  },
  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: AppConstants.colors.background,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    ...AppConstants.shadow,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppConstants.colors.primary,
    marginBottom: 20,
  },
  modalInput: {
    width: '100%',
    backgroundColor: AppConstants.colors.formInput,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    color: AppConstants.colors.textPrimary,
    borderWidth: 1,
    borderColor: AppConstants.colors.border,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalConfirmButton: {
    flex: 1,
    marginLeft: 10,
    marginTop: 0,
    paddingVertical: 12,
  },
  modalCancelButton: {
    flex: 1,
    marginRight: 10,
    backgroundColor: AppConstants.colors.textSecondary,
    marginTop: 0,
    paddingVertical: 12,
  },
});
