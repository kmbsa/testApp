// src/context/PhotosContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library'; // For saving to camera roll (optional)
import * as ImagePicker from 'expo-image-picker'; // New: For picking from photo library
import { Alert } from 'react-native';

// Define the type for a captured photo in the context
export type FormPhoto = {
    id: string; // Unique ID for each photo (timestamp + random for safety)
    uri: string; // Permanent URI within the app's file system
    originalUri?: string; // Optional: Original URI if picked from library
    // Add other metadata if needed (e.g., location if you capture it for camera photos)
};

interface PhotosContextType {
    formPhotos: FormPhoto[]; // Array to hold multiple photos for the current form
    addFormPhoto: (tempUri: string) => Promise<void>; // Add photo from camera or picker
    removeFormPhoto: (id: string) => void; // Remove a photo by its ID
    clearFormPhotos: () => void; // Clear all photos when a form is submitted/cancelled
    pickImageFromLibrary: () => Promise<void>; // New: Function to pick image
}

const PhotosContext = createContext<PhotosContextType | undefined>(undefined);

export const PhotoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [formPhotos, setFormPhotos] = useState<FormPhoto[]>([]);

    // Directory for permanent photo storage
    const photosDirectory = FileSystem.documentDirectory + 'form_photos/';

    // Helper to move/copy file to our permanent app storage
    const savePhotoToAppFiles = async (tempUri: string): Promise<string | null> => {
        const newFileName = photosDirectory + `form_photo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        try {
            await FileSystem.makeDirectoryAsync(photosDirectory, { intermediates: true });
            await FileSystem.copyAsync({
                from: tempUri,
                to: newFileName,
            });
            console.log('Photo copied to app files:', newFileName);
            return newFileName;
        } catch (error) {
            console.error("Failed to copy photo to app files:", error);
            Alert.alert("Error", "Failed to save photo internally.");
            return null;
        }
    };

    // Add a photo (from camera or library) to the formPhotos array
    const addFormPhoto = async (tempUri: string) => {
        const permanentUri = await savePhotoToAppFiles(tempUri);
        if (permanentUri) {
            const newPhoto: FormPhoto = {
                id: Date.now().toString() + Math.random().toString(), // Simple unique ID
                uri: permanentUri,
            };
            setFormPhotos(prevPhotos => [...prevPhotos, newPhoto]);
        }
    };

    // Remove a photo from the formPhotos array and delete its file
    const removeFormPhoto = async (id: string) => {
        const photoToRemove = formPhotos.find(p => p.id === id);
        if (photoToRemove) {
            setFormPhotos(prevPhotos => prevPhotos.filter(p => p.id !== id));
            try {
                // Delete the physical file
                await FileSystem.deleteAsync(photoToRemove.uri);
                console.log('Deleted photo file:', photoToRemove.uri);
            } catch (error) {
                console.error("Failed to delete photo file:", error);
            }
        }
    };

    const clearFormPhotos = async () => {
        // Optionally delete all physical files when clearing
        for (const photo of formPhotos) {
            try {
                await FileSystem.deleteAsync(photo.uri);
            } catch (error) {
                console.warn("Failed to delete file on clear:", photo.uri, error);
            }
        }
        setFormPhotos([]);
    };

    const pickImageFromLibrary = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please enable media library access in settings.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, // You can set this to false if you don't want editing
            aspect: [4, 3], // Or whatever aspect ratio you prefer
            quality: 1,
        });

        console.log('ImagePicker Result:', result);

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const selectedUri = result.assets[0].uri;
            await addFormPhoto(selectedUri); // Add the picked photo to context
        }
    };


    const value = {
        formPhotos,
        addFormPhoto,
        removeFormPhoto,
        clearFormPhotos,
        pickImageFromLibrary,
    };

    return <PhotosContext.Provider value={value}>{children}</PhotosContext.Provider>;
};

export const usePhotosContext = () => {
    const context = useContext(PhotosContext);
    if (context === undefined) {
        throw new Error('usePhotosContext must be used within a PhotoProvider');
    }
    return context;
};