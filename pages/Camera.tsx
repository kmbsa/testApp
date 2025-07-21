import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Button, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, CameraType, PermissionResponse } from 'expo-camera';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location'; // Ensure this is imported

// REMOVE FileSystem import if it was added previously
// import * as FileSystem from 'expo-file-system';


import type { Coordinate, Test2ScreenProps } from '../navigation/types';

export default function PhotoCaptureScreen({ navigation, route }: Test2ScreenProps) {
    const cameraRef = useRef<CameraView>(null);
    const [facing, setFacing] = useState<CameraType>('back');
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions(); // Use expo-location hook for permission
    const [photoUri, setPhotoUri] = useState<string | null>(null); // State to store the TEMPORARY photo URI
    const [locationAtCapture, setLocationAtCapture] = useState<Coordinate | null>(null); // State to store location
    const [isGettingLocation, setIsGettingLocation] = useState(false); // Loading state for location/capture process


    // Request permissions on mount
    useEffect(() => {
        // Check if permissions are already granted before requesting
        if (cameraPermission === null || !cameraPermission.granted) {
            requestCameraPermission();
        }
        if (locationPermission === null || !locationPermission.granted) {
            requestLocationPermission();
        }
    }, [cameraPermission, locationPermission, requestCameraPermission, requestLocationPermission]); // Add request functions to dependency array


    // Handle permission status rendering
    // Show a loading state while permission status is being determined (permission === null)
    if (cameraPermission === null || locationPermission === null) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>Checking permissions (Camera & Location)...</Text>
                <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
            </View>
        );
    }

    // Show a denied state if permissions are not granted
    if (!cameraPermission.granted || !locationPermission.granted) {
        return (
            <View style={styles.container}>
                <Text style={[styles.permissionText, { textAlign: 'center' }]}>
                    We need your permission for both Camera and Location to use this feature.
                </Text>
                {/* Button to request permissions again */}
                {/* Only show the button if at least one permission is not granted */}
                {(!cameraPermission.granted || !locationPermission.granted) && (
                     <Button
                          onPress={() => {
                              // Request both permissions again if needed
                              if (!cameraPermission.granted) requestCameraPermission();
                              if (!locationPermission.granted) requestLocationPermission();
                          }}
                          title="Grant Permissions"
                     />
                 )}
            </View>
        );
    }

    function toggleCameraFacing() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }

    const takePicture = async () => {
        // Only proceed if cameraRef is available and we are not already busy capturing
        if (cameraRef.current && !isGettingLocation) {
            setIsGettingLocation(true); // Start loading state for the capture process

            try {
                // --- Get Location BEFORE taking the photo ---
                console.log("Getting location before taking photo...");
                // Request higher accuracy for location capture
                let location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Highest, // <-- Keep requesting Highest Accuracy
                    // REMOVE the timeout property as it's not a valid option here
                    // timeout: 10000, // <-- REMOVE THIS LINE
                });
                const capturedLoc: Coordinate = { latitude: location.coords.latitude, longitude: location.coords.longitude };
                setLocationAtCapture(capturedLoc);
                console.log("Location captured:", capturedLoc);

                // --- Take the photo ---
                console.log("Taking photo...");
                const photo = await cameraRef.current.takePictureAsync({
                     quality: 1, // Optional: set quality
                });
                // Set the local state with the TEMPORARY URI provided by the camera
                setPhotoUri(photo.uri);
                console.log('Photo taken temporarily at:', photo.uri);

            } catch (error) {
                console.error("Failed to take picture or get location:", error);
                setPhotoUri(null);
                setLocationAtCapture(null);
                Alert.alert("Error", "Failed to capture photo or location. Please try again.");
            } finally {
                setIsGettingLocation(false); // End loading state
            }
        }
    };

    const retakePicture = () => {
        // Clear both photo URI and location when retaking
        setPhotoUri(null);
        setLocationAtCapture(null);
        console.log('Retaking picture');
    };

    // Function to confirm and use the photo - Pass the TEMPORARY URI back
    const usePhoto = () => {
        // Ensure we have both the temporary photo URI and the captured location
        if (photoUri && locationAtCapture) {
            console.log("Using photo (temporary URI) and location:", photoUri, locationAtCapture);
            // Navigate back to the Map screen, passing the temporary URI and location
            // Ensure 'Test' is the correct screen name for your Map screen in navigation setup
            navigation.navigate('Test', {
                capturedPhotoUri: photoUri, // Pass the TEMPORARY URI
                capturedLocation: locationAtCapture,
            });

        } else if (!photoUri) {
            Alert.alert("No Photo", "Please take a picture first.");
        } else if (!locationAtCapture) {
            // This case should ideally not happen if location is fetched before photo, but good to handle
            Alert.alert("No Location Data", "Could not capture location data with the photo. Please retake.");
        } else {
            // Should not happen in a normal flow
            console.warn("Attempted to use photo, but missing photoUri or locationAtCapture.");
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };


    return (
        <View style={styles.container}>
            {photoUri ? (
                // Photo preview section - Display using the temporary URI
                <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photoUri }} style={styles.photo} />
                    {/* Optional: Display captured location on preview */}
                    {locationAtCapture && (
                        <View style={styles.locationOverlay}>
                            <Text style={styles.locationText}>
                                Lat: {locationAtCapture.latitude.toFixed(4)}, Lng: {locationAtCapture.longitude.toFixed(4)}
                            </Text>
                        </View>
                    )}
                    <View style={styles.controlsContainer}>
                        {/* Retake Button */}
                        <TouchableOpacity style={styles.iconButton} onPress={retakePicture} disabled={isGettingLocation}>
                            <Ionicons name="refresh" size={35} color="white" />
                        </TouchableOpacity>
                        {/* Use Photo Button - Calls usePhoto which passes the temporary URI */}
                        <TouchableOpacity style={styles.iconButton} onPress={usePhoto} disabled={isGettingLocation}>
                            <Ionicons name="checkmark-circle-outline" size={35} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                // Camera view section
                <View style={styles.cameraAndControlsContainer}>
                    {/* Ensure cameraRef is assigned */}
                    <CameraView style={styles.camera} facing={facing} ref={cameraRef} />

                    <View style={styles.controlsContainer}>
                        {/* Flip Camera Button */}
                        <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing} disabled={isGettingLocation}>
                            <Ionicons name="camera-reverse" size={35} color="white" />
                        </TouchableOpacity>
                        {/* Capture Button - Calls takePicture */}
                        <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={isGettingLocation}>
                             {isGettingLocation ? (
                                 <ActivityIndicator size="small" color="#2E8B57" /> // Show loading inside button while capturing
                             ) : (
                                 <MaterialIcons name="fiber-manual-record" size={62} color="white" />
                             )}
                        </TouchableOpacity>
                        {/* Placeholder for alignment */}
                        <View style={{ width: 50, height: '100%' }} />
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    cameraAndControlsContainer: {
        flex: 1,
        flexDirection: 'column',
    },
    camera: {
        flex: 1,
    },
    photoPreviewContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'black',
    },
      photo: {
        flex: 1,
        width: '100%',
        resizeMode: 'contain',
      },
    controlsContainer: {
        height: 100,
        backgroundColor: '#2E8B57',
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
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionText: {
        fontSize: 18,
        color: 'white',
        textAlign: 'center',
        marginHorizontal: 20,
    },
    locationOverlay: { // Style for location display on photo preview
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 5,
    },
    locationText: { // Style for location text
        color: 'white',
        fontSize: 14,
    }
});