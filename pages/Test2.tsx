import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Button, Alert, ActivityIndicator, Platform } from 'react-native';
import { CameraView, useCameraPermissions, CameraType, PermissionResponse } from 'expo-camera';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

import Styles from '../styles/styles';

import type { Coordinate, Test2ScreenProps } from '../navigation/types';

export default function PhotoCaptureScreen({ navigation, route }: Test2ScreenProps) {
    const cameraRef = useRef<CameraView>(null);
    const [facing, setFacing] = useState<CameraType>('back');
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [locationAtCapture, setLocationAtCapture] = useState<Coordinate | null>(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    useEffect(() => {
        if (cameraPermission === null || !cameraPermission.granted) {
            requestCameraPermission();
        }
        if (locationPermission === null || !locationPermission.granted) {
            requestLocationPermission();
        }
    }, [cameraPermission, locationPermission, requestCameraPermission, requestLocationPermission]);


    if (cameraPermission === null || locationPermission === null) {
        return (
            <View style={styles.fullContainer}>
                <Text style={styles.permissionText}>Checking permissions (Camera & Location)...</Text>
                <ActivityIndicator size="large" color={Styles.buttonText.color} style={{ marginTop: 20 }} />
            </View>
        );
    }

    if (!cameraPermission.granted || !locationPermission.granted) {
        return (
            <View style={styles.fullContainer}>
                <Text style={[styles.permissionText, { textAlign: 'center' }]}>
                    We need your permission for both Camera and Location to use this feature.
                </Text>
                {(!cameraPermission.granted || !locationPermission.granted) && (
                    <Button
                        onPress={() => {
                            if (!cameraPermission.granted) requestCameraPermission();
                            if (!locationPermission.granted) requestLocationPermission();
                        }}
                        title="Grant Permissions"
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
        if (cameraRef.current && !isGettingLocation) {
            setIsGettingLocation(true);

            try {
                console.log("Getting location before taking photo...");
                let location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Highest,
                });
                const capturedLoc: Coordinate = { latitude: location.coords.latitude, longitude: location.coords.longitude };
                setLocationAtCapture(capturedLoc);
                console.log("Location captured:", capturedLoc);

                console.log("Taking photo...");
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 1,
                });
                setPhotoUri(photo.uri);
                console.log('Photo taken temporarily at:', photo.uri);

            } catch (error) {
                console.error("Failed to take picture or get location:", error);
                setPhotoUri(null);
                setLocationAtCapture(null);
                Alert.alert("Error", "Failed to capture photo or location. Please try again.");
            } finally {
                setIsGettingLocation(false);
            }
        }
    };

    const retakePicture = () => {
        setPhotoUri(null);
        setLocationAtCapture(null);
        console.log('Retaking picture');
    };

    const usePhoto = () => {
        if (photoUri && locationAtCapture) {
            console.log("Using photo (temporary URI) and location:", photoUri, locationAtCapture);
            navigation.navigate('Test', {
                capturedPhotoUri: photoUri,
                capturedLocation: locationAtCapture,
            });

        } else if (!photoUri) {
            Alert.alert("No Photo", "Please take a picture first.");
        } else if (!locationAtCapture) {
            console.warn("Attempted to use photo, but missing locationAtCapture.");
            Alert.alert("No Location Data", "Could not capture location data with the photo. Please retake.");
        } else {
            console.warn("Attempted to use photo, but missing photoUri or locationAtCapture.");
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };


    return (
        <SafeAreaView style={styles.fullContainer}>
            {photoUri ? (
                <View style={styles.photoPreviewContent}>
                    <Image source={{ uri: photoUri }} style={styles.photo}/>
                    {locationAtCapture && (
                        <View style={styles.locationOverlay}>
                            <Text style={styles.locationText}>
                                Lat: {locationAtCapture.latitude.toFixed(4)}, Lng: {locationAtCapture.longitude.toFixed(4)}
                            </Text>
                        </View>
                    )}
                    <View style={styles.controlsContainer}>
                        <TouchableOpacity style={styles.iconButton} onPress={retakePicture} disabled={isGettingLocation}>
                            <Ionicons name="refresh" size={35} color={Styles.buttonText.color}/>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconButton} onPress={usePhoto} disabled={isGettingLocation}>
                            <Ionicons name="checkmark-circle-outline" size={35} color={Styles.buttonText.color}/>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.cameraContent}>
                    <CameraView style={styles.camera} facing={facing} ref={cameraRef}/>
                    <View style={styles.controlsContainer}>
                        <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing} disabled={isGettingLocation}>
                            <Ionicons name="camera-reverse" size={35} color={Styles.buttonText.color}/>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={isGettingLocation}>
                            {isGettingLocation ? (
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
    topRightContainer: {
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
    buttonText: { // This style doesn't seem used on any visible text elements currently
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
    locationOverlay: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 70 : 40,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 5,
        zIndex: 1,
    },
    locationText: {
        color: 'white',
        fontSize: 14,
    }
});