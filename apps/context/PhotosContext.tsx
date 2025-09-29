import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type FormPhoto = {
  id: string;
  uri: string;
  base64: string;
  mimeType: string;
  filename: string;
};

interface PhotosContextType {
  formPhotos: FormPhoto[];
  addFormPhoto: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
  removeFormPhoto: (id: string) => void;
  clearFormPhotos: () => void;
  pickImageFromLibrary: () => Promise<void>;
  takePhotoWithCamera: () => Promise<void>;
}

const PhotosContext = createContext<PhotosContextType | undefined>(undefined);

export const PhotoProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [formPhotos, setFormPhotos] = useState<FormPhoto[]>([]);

  const photosDirectory = FileSystem.documentDirectory + 'form_photos/';

  const savePhotoToAppFiles = async (
    tempUri: string,
  ): Promise<string | null> => {
    if (!tempUri) {
      console.warn(
        'savePhotoToAppFiles: tempUri is null or undefined. Skipping copy.',
      );
      return null;
    }

    const newFileName =
      photosDirectory +
      `form_photo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    try {
      await FileSystem.makeDirectoryAsync(photosDirectory, {
        intermediates: true,
      });
      await FileSystem.copyAsync({
        from: tempUri,
        to: newFileName,
      });
      console.log('Photo copied to app files:', newFileName);
      return newFileName;
    } catch (error: any) {
      console.error('Failed to copy photo to app files:', error);
      if (error.message && error.message.includes("Missing option 'from'")) {
        Alert.alert(
          'Error',
          'Could not access original photo file for local save. Trying base64 directly.',
        );
      } else {
        Alert.alert(
          'Error',
          `Failed to save photo internally: ${error.message}`,
        );
      }
      return null;
    }
  };

  const addFormPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    console.log('addFormPhoto: Processing asset:', asset);

    let base64Data: string | null = null;
    let permanentUri: string | null = null;

    if (asset.base64) {
      base64Data = asset.base64;
      console.log('Base64 found directly in asset.');
    } else if (asset.uri) {
      console.log(
        'Base64 missing from asset, attempting to read from URI:',
        asset.uri,
      );
      try {
        base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log('Successfully read base64 from asset URI.');
      } catch (readError) {
        console.error('Failed to read base64 from asset URI:', readError);
        Alert.alert('Error', 'Could not read image data for upload.');
      }
    } else {
      console.warn(
        'Asset URI and base64 are both missing. Cannot process photo.',
      );
      Alert.alert('Error', 'No image data available to process.');
    }

    // 3. Attempt to save a local copy (optional for display)
    if (asset.uri) {
      permanentUri = await savePhotoToAppFiles(asset.uri);
    } else {
      console.warn('Asset URI is missing, cannot save local copy.');
    }

    // Final check before adding to state
    if (base64Data) {
      const newPhoto: FormPhoto = {
        id: Date.now().toString() + Math.random().toString(),
        uri: permanentUri || asset.uri, // Prefer copied URI, fallback to original if copy failed
        base64: base64Data, // THIS IS THE CRITICAL DATA FOR BACKEND
        mimeType: asset.mimeType || 'image/jpeg',
        filename: asset.fileName || `photo_${Date.now()}.jpg`,
      };
      console.log('Adding new photo to formPhotos:', newPhoto);
      setFormPhotos((prevPhotos) => [...prevPhotos, newPhoto]);
    } else {
      // This case should ideally not be reached if previous checks work
      console.warn(
        'Could not add photo: Base64 data is still missing after all attempts.',
      );
      Alert.alert('Error', 'Failed to process image data fully.');
    }
  };

  const removeFormPhoto = async (id: string) => {
    const photoToRemove = formPhotos.find((p: FormPhoto) => p.id === id); // Fix implicit any type
    if (photoToRemove) {
      setFormPhotos((prevPhotos) =>
        prevPhotos.filter((p: FormPhoto) => p.id !== id),
      ); // Fix typo
      try {
        if (photoToRemove.uri.startsWith(photosDirectory)) {
          await FileSystem.deleteAsync(photoToRemove.uri);
          console.log('Deleted photo file:', photoToRemove.uri);
        }
      } catch (error) {
        console.error('Failed to delete photo file:', error);
      }
    }
  };

  const clearFormPhotos = async () => {
    for (const photo of formPhotos) {
      try {
        if (photo.uri.startsWith(photosDirectory)) {
          await FileSystem.deleteAsync(photo.uri);
        }
      } catch (error) {
        console.warn('Failed to delete file on clear:', photo.uri, error);
      }
    }
    setFormPhotos([]);
  };

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable media library access in settings.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    console.log('ImagePicker Result (from library):', result);

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await addFormPhoto(result.assets[0]);
    } else if (result.canceled) {
      console.log('Image picker was cancelled.');
    } else {
      console.warn('No assets found in image picker result.');
      Alert.alert('Error', 'Could not retrieve image from library.');
    }
  };

  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable camera access in settings.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    console.log('--- RAW Camera Result (after launch) ---');
    console.log('result.canceled:', result.canceled);
    console.log('result.assets:', result.assets);
    if (result.assets && result.assets.length > 0) {
      console.log(
        'Full result.assets[0] (for detailed inspection):',
        JSON.stringify(result.assets[0], null, 2),
      ); // The full object
    } else {
      console.log('result.assets array is empty or null.');
    }
    console.log('-------------------------------------');

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await addFormPhoto(result.assets[0]);
    } else if (result.canceled) {
      console.log('Camera was cancelled.');
    } else {
      console.warn('No assets found in camera result.');
      Alert.alert('Error', 'Could not capture image from camera.');
    }
  };

  const value = {
    formPhotos,
    addFormPhoto,
    removeFormPhoto,
    clearFormPhotos,
    pickImageFromLibrary,
    takePhotoWithCamera,
  };

  return (
    <PhotosContext.Provider value={value}>{children}</PhotosContext.Provider>
  );
};

export const usePhotosContext = () => {
  const context = useContext(PhotosContext);
  if (context === undefined) {
    throw new Error('usePhotosContext must be used within a PhotoProvider');
  }
  return context;
};
