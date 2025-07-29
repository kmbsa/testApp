import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library'; 
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type FormPhoto = {
    id: string;
    uri: string;
    originalUri?: string; // Optional: Original URI if picked from library
};

interface PhotosContextType {
    formPhotos: FormPhoto[];
    addFormPhoto: (tempUri: string) => Promise<void>;
    removeFormPhoto: (id: string) => void;
    clearFormPhotos: () => void;
    pickImageFromLibrary: () => Promise<void>;
}

const PhotosContext = createContext<PhotosContextType | undefined>(undefined);

export const PhotoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [formPhotos, setFormPhotos] = useState<FormPhoto[]>([]);

    const photosDirectory = FileSystem.documentDirectory + 'form_photos/';

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

    const addFormPhoto = async (tempUri: string) => {
        const permanentUri = await savePhotoToAppFiles(tempUri);
        if (permanentUri) {
            const newPhoto: FormPhoto = {
                id: Date.now().toString() + Math.random().toString(),
                uri: permanentUri,
            };
            setFormPhotos(prevPhotos => [...prevPhotos, newPhoto]);
        }
    };

    const removeFormPhoto = async (id: string) => {
        const photoToRemove = formPhotos.find(p => p.id === id);
        if (photoToRemove) {
            setFormPhotos(prevPhotos => prevPhotos.filter(p => p.id !== id));
            try {
                await FileSystem.deleteAsync(photoToRemove.uri);
                console.log('Deleted photo file:', photoToRemove.uri);
            } catch (error) {
                console.error("Failed to delete photo file:", error);
            }
        }
    };

    const clearFormPhotos = async () => {
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
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        console.log('ImagePicker Result:', result);

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const selectedUri = result.assets[0].uri;
            await addFormPhoto(selectedUri);
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