// Test2.tsx (Camera.tsx)
import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Button, Alert, ActivityIndicator, Platform } from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
// No need for expo-location here if photos aren't tied to map points
// import * as Location from 'expo-location';

import Styles from '../styles/styles';
import { usePhotosContext } from '../context/PhotosContext'; // Import usePhotosContext

import type { Test2ScreenProps } from '../navigation/types';

export default function PhotoCaptureScreen({ navigation, route }: Test2ScreenProps) {
    const cameraRef = useRef<CameraView>(null);
    const [facing, setFacing] = useState<CameraType>('back');
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [photoUriTemp, setPhotoUriTemp] = useState<string | null>(null); // Temporary state for preview
    const [isTakingPhoto, setIsTakingPhoto] = useState(false);

    const { addFormPhoto } = usePhotosContext(); // Get addFormPhoto from context

    useEffect(() => {
        if (cameraPermission === null || !cameraPermission.granted) {
            requestCameraPermission();
        }
    }, [cameraPermission, requestCameraPermission]);

    if (cameraPermission === null) {
        return (
            <View style={styles.fullContainer}>
                <Text style={styles.permissionText}>Checking camera permissions...</Text>
                <ActivityIndicator size="large" color={Styles.buttonText.color} style={{ marginTop: 20 }} />
            </View>
        );
    }

    if (!cameraPermission.granted) {
        return (
            <View style={styles.fullContainer}>
                <Text style={[styles.permissionText, { textAlign: 'center' }]}>
                    We need your permission for Camera to use this feature.
                </Text>
                {(!cameraPermission.granted) && (
                    <Button
                        onPress={() => requestCameraPermission()}
                        title="Grant Camera Permission"
                        color={Styles.button.backgroundColor}
                    />
                )}
            </View>
        );
    }

    function toggleCameraFacing() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }

    const takePicture = async () => {
        if (cameraRef.current && !isTakingPhoto) {
            setIsTakingPhoto(true);
            try {
                console.log("Taking photo...");
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 1,
                    // You can specify other options like base64: true or exif: true if needed for metadata
                });
                setPhotoUriTemp(photo.uri); // Set temporary URI for preview
                console.log('Photo taken temporarily at:', photo.uri);

            } catch (error) {
                console.error("Failed to take picture:", error);
                setPhotoUriTemp(null);
                Alert.alert("Error", "Failed to capture photo. Please try again.");
            } finally {
                setIsTakingPhoto(false);
            }
        }
    };

    const retakePicture = () => {
        setPhotoUriTemp(null);
        console.log('Retaking picture');
    };

    const usePhoto = async () => {
        if (photoUriTemp) {
            console.log("Using photo:", photoUriTemp);
            await addFormPhoto(photoUriTemp); // Add photo to context
            navigation.goBack(); // Go back to Map screen
        } else {
            Alert.alert("No Photo", "Please take a picture first.");
        }
    };

    return (
        <SafeAreaView style={styles.fullContainer}>
            {photoUriTemp ? (
                <View style={styles.photoPreviewContent}>
                    <Image source={{ uri: photoUriTemp }} style={styles.photo}/>
                    <View style={styles.controlsContainer}>
                        <TouchableOpacity style={styles.iconButton} onPress={retakePicture} disabled={isTakingPhoto}>
                            <Ionicons name="refresh" size={35} color={Styles.buttonText.color}/>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconButton} onPress={usePhoto} disabled={isTakingPhoto}>
                            <Ionicons name="checkmark-circle-outline" size={35} color={Styles.buttonText.color}/>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.cameraContent}>
                    <CameraView style={styles.camera} facing={facing} ref={cameraRef}/>
                    <View style={styles.controlsContainer}>
                        <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing} disabled={isTakingPhoto}>
                            <Ionicons name="camera-reverse" size={35} color={Styles.buttonText.color}/>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={isTakingPhoto}>
                            {isTakingPhoto ? (
                                <ActivityIndicator size="small" color={Styles.buttonText.color}/>
                            ) : (
                                <MaterialIcons name="fiber-manual-record" size={62} color={Styles.buttonText.color}/>
                            )}
                        </TouchableOpacity>
                        <View style={{ width: 50, height: '100%' }}/>
                    </View>
                </View>
            )}
            <SafeAreaView style={styles.backButtonContainer}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={30} color={Styles.buttonText.color}/>
                </TouchableOpacity>
            </SafeAreaView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    fullContainer: {
        flex: 1,
        backgroundColor: Styles.container.backgroundColor,
    },
    backButtonContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10,
        paddingTop: Platform.OS === 'ios' ? 10 : 10,
        paddingLeft: 10,
    },
    backButton: {
        backgroundColor: Styles.button.backgroundColor,
        padding: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topRightContainer: { // Not used
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
        paddingTop: Platform.OS === 'ios' ? 10 : 10,
        paddingRight: 10,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    cameraContent: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-end',
    },
    photoPreviewContent: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    photo: {
        flex: 1,
        width: '100%',
        resizeMode: 'contain',
    },
    controlsContainer: {
        height: 100,
        backgroundColor: Styles.button.backgroundColor,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 20,
        width: '100%',
    },
    iconButton: {
        padding: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 12,
        marginTop: 2,
    },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 4,
        borderColor: Styles.buttonText.color,
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionText: {
        fontSize: 18,
        color: Styles.text.color,
        textAlign: 'center',
        marginHorizontal: 20,
    },
});