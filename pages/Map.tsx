import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, View, TextInput, Modal, Text, TouchableWithoutFeedback, Keyboard, TouchableOpacity, Alert, StyleSheet, Image } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Styles from '../styles/styles';
import EvilIcons from 'react-native-vector-icons/EvilIcons';
import * as Location from 'expo-location';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

// Import types
import type { MapScreenProps, RootStackNavigationProp, MapPoint, RootStackParamList } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Import the context hook
import { usePointsContext } from '../context/PointsContext';

type MapScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Map'>;


// isCoordinateInArray helper function
// You can remove this from Map.tsx if you've copied it into PointsContext.tsx
const isCoordinateInArray = (coordinate: { latitude: number; longitude: number }, array: { latitude: number; longitude: number }[], epsilon = 0.00001): boolean => {
    return array.some(point =>
        Math.abs(point.latitude - coordinate.latitude) < epsilon &&
        Math.abs(point.longitude - coordinate.longitude) < epsilon
    );
};

export default function Map() {
    const navigation = useNavigation<MapScreenNavigationProp>();
    const route = useRoute<MapScreenProps['route']>();

    // --- Get state and update functions from Context ---
    // Removed local useState for isComplete
    const { points, redoStack, isComplete, addPoint, resetPoints, undoPoint, redoPoint, setIsComplete, closePolygon } = usePointsContext(); // Destructure closePolygon here


    const mapRef = useRef<MapView | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    // --- Local state remains local ---
    const [modalVisible, setModalVisible] = useState(false);
    const [placeName, setPlaceName] = useState('');
    const [locationDetails, setLocationDetails] = useState('');
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // --- ADD THIS STATE ---


    // Use useFocusEffect to check for params when the screen becomes focused (navigated back to)
    useFocusEffect(
        useCallback(() => {
            console.log('>>> Map: useFocusEffect running. Current route params:', route.params);

            // Check if both capturedPhotoUri AND capturedLocation parameters exist
            if (route.params?.capturedPhotoUri && route.params?.capturedLocation) {
                const uri = route.params.capturedPhotoUri;
                const loc = route.params.capturedLocation;
                console.log(">>> Map: Photo and location received from camera:", { uri, loc });

                const newPhotoPoint: MapPoint = {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    photoUri: uri,
                };

                // Use the addPoint function from context - duplicate check inside this component handler
                // This check is still needed here if you want to allow multiple photos at the same spot
                // but not add the exact same photo point multiple times from navigating back repeatedly.
                const isDuplicate = points.some(point =>
                    Math.abs(point.latitude - newPhotoPoint.latitude) < 0.00001 &&
                    Math.abs(point.longitude - newPhotoPoint.longitude) < 0.00001 &&
                    point.photoUri === newPhotoPoint.photoUri
                );

                if (isDuplicate) {
                    console.log(">>> Map: Skipping duplicate photo point.");
                } else {
                    console.log(">>> Map: Adding new photo point via context.");
                    // addPoint in context now handles the coordinate-only duplicate check
                    addPoint(newPhotoPoint); // Call the context function
                    // Redo stack is cleared inside context addPoint
                    // isComplete is set to false inside context addPoint
                }

                // *** Keep clearing params AFTER processing them ***
                navigation.setParams({ capturedPhotoUri: undefined, capturedLocation: undefined });
                console.log('>>> Map: Navigation params cleared.');

            } else {
                console.log('>>> Map: useFocusEffect running, but no photo params found.');
            }
        }, [route.params, navigation, points, addPoint]) // Dependencies
    );


    // Keep the effect to log the FINAL state of points for debugging
    useEffect(() => {
        console.log('### FINAL Points state changed (from Context):', points);
    }, [points]);


    const handleMapReady = () => {
        setMapLoaded(true);
        // Initial map fit - Use points from context
        if (mapRef.current && points.length === 0) {
             console.log(">>> Map: Map ready, points empty. Fitting to default bounds.");
             mapRef.current.fitToCoordinates([ { latitude: 5.0, longitude: 115.0 }, { latitude: 19.0, longitude: 127.0 }, ], { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
        } else if (mapRef.current && points.length > 0) {
             console.log(`>>> Map: Map ready, ${points.length} points exist (from context). Fitting to points.`);
             mapRef.current.fitToCoordinates(points, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
        }
    };

    const handleMapPress = (event: any) => {
         if (isComplete) { console.log(">>> Map: Map press ignored: shape is complete."); return; } // Use isComplete from context
        const newCoord = event.nativeEvent.coordinate;
        const newPoint: MapPoint = { latitude: newCoord.latitude, longitude: newCoord.longitude };

        // Use the addPoint function from context - duplicate check here
        if (isCoordinateInArray(newPoint, points.map(p => ({ latitude: p.latitude, longitude: p.longitude })))) { // Check against points from context
             console.log(">>> Map: Skipping duplicate map press point.");
        } else {
             console.log(">>> Map: Adding new map press point via context.");
             addPoint(newPoint); // Call the context function
             // Redo stack is cleared inside context addPoint
             // isComplete is set to false inside context addPoint
        }
    };

    const handleMarkerPress = (index: number) => {
         if (isComplete) { // Use isComplete from context
             // Handle tapping a marker on a completed shape
             const tappedPoint = points[index]; // Use points from context
             console.log(">>> Map: Tapped marker on completed shape:", tappedPoint);
             if (tappedPoint.photoUri) {
                  Alert.alert("Photo Available", `Photo attached to this point:\n${tappedPoint.photoUri}`);
                  // TODO: Implement logic to display the photo (e.g., in a modal)
             } else {
                  Alert.alert("Point Details", `Lat: ${tappedPoint.latitude.toFixed(4)}, Lng: ${tappedPoint.longitude.toFixed(4)}`);
             }
             return; // Exit if complete
         }

        // --- Handle tapping the first marker to close the shape ---
        if (points.length > 1 && index === 0) { // Use points from context
             console.log(">>> Map: Tapped first marker to complete shape. Calling context.closePolygon()");

             // --- Call the new context function to close the polygon ---
             // This replaces the old logic that created closingPoint and called addPoint
             closePolygon(); // <-- CALL THE CONTEXT FUNCTION

             // Show the modal AFTER attempting to close the polygon
             setModalVisible(true);

             // REMOVED: Old redundant calls from here
        } else {
             console.log(`>>> Map: Tapped marker at index ${index} while plotting.`);
             // Optional: Add logic for selecting/deleting a point while plotting
             // ... (delete logic example - call a context deletePoint function if you implement one) ...
        }
    };

    const handleUndo = () => {
         if (isComplete) return; // Use isComplete from context
        // --- Use undoPoint function from context ---
        undoPoint(); // Call the context function
        // isComplete state change on undo is handled inside the context undoPoint function
    };

    const handleRedo = () => {
         if (isComplete) return; // Use isComplete from context
        // --- Use redoPoint function from context ---
        redoPoint(); // Call the context function
        // isComplete state change on redo is handled inside the context redoPoint function
    };

    const getCurrentUserLocation = async () => {
         if (isComplete) { Alert.alert("Shape Already Completed", "Cannot add location points after completing the shape."); return; } // Use isComplete from context
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert( 'Location Permission Denied', 'Please enable location services to mark your current location.', [{ text: 'OK' }]); return; }
        let location = await Location.getCurrentPositionAsync({});
        const userCoordinate: MapPoint = { latitude: location.coords.latitude, longitude: location.coords.longitude };

        setUserLocation({ latitude: userCoordinate.latitude, longitude: userCoordinate.longitude }); // This is local state for temp marker

        // Use addPoint function from context - duplicate check here
        if (isCoordinateInArray(userCoordinate, points.map(p => ({ latitude: p.latitude, longitude: p.longitude })))) { // Check against points from context
             console.log(">>> Map: Skipping duplicate user location point.");
        } else {
             console.log(">>> Map: Adding new user location point via context.");
             addPoint(userCoordinate); // Call the context function
             // Redo stack is cleared inside context addPoint
             // isComplete is set to false inside context addPoint
        }

        mapRef.current?.animateToRegion({
            latitude: userCoordinate.latitude,
            longitude: userCoordinate.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        });
    };

    const handleCompletePlotting = () => {
         if (isComplete) { Alert.alert("Shape Already Completed", "You have already finished plotting points."); setModalVisible(true); return; } // Use isComplete from context
        const uniquePointsCount = new Set(points.map(p => `${p.latitude},${p.longitude}`)).size; // Use points from context
        if (uniquePointsCount < 3) { Alert.alert("Not Enough Points", "Please add at least 3 unique points before completing the shape."); return; }

        console.log(">>> Map: Completing shape via button press. Calling context.closePolygon()");

        // --- Call the new context function to close the polygon ---
        // This replaces the old logic that created closingPoint and called addPoint
        closePolygon(); // <-- CALL THE CONTEXT FUNCTION

        // Show the modal AFTER attempting to close the polygon
        setModalVisible(true);

        // REMOVED: Old redundant calls from here
    };

    // --- New function to handle clearing the map ---
    const handleClearMap = () => {
        Alert.alert(
            "Clear Map",
            "Are you sure you want to clear all plotted points?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    onPress: () => {
                        console.log(">>> Map: Clearing map via context resetPoints.");
                        resetPoints(); // Call the context function to clear state
                        // Local state related to the plotting process should also be reset
                        setModalVisible(false); // Close modal if open
                        setPlaceName('');
                        setLocationDetails('');
                        setUserLocation(null); // Clear temporary user location marker
                    },
                    style: "destructive",
                },
            ],
            { cancelable: true }
        );
    };


    const handlePhotographPosition = async () => {
        // Navigate to the Camera screen. No parameters needed here anymore.
        navigation.navigate('Test2');
    };


    return (
        <View style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                style={{ flex: 1 }}
                onMapReady={handleMapReady}
                onPress={handleMapPress}
                initialRegion={{
                    latitude: 12.8797,
                    longitude: 121.7740,
                    latitudeDelta: 10.0,
                    longitudeDelta: 10.0,
                }}
            >
                {/* Use points from context for rendering */}
                {points.map((point, index) => (
                <Marker
                    key={`marker-${index}`}
                    coordinate={point}
                    onPress={() => handleMarkerPress(index)}
                    // Set pinColor conditionally for default markers (used on Android here)
                    pinColor={Platform.OS !== 'ios' ? (point.photoUri ? 'green' : 'red') : undefined} // Set pinColor only on Android
                    // You can remove the anchor prop now if you don't need it for the default pin
                    // anchor={{ x: 0.5, y: 1 }}
                >
                    {/* --- Conditionally render the custom View ONLY on iOS --- */}
                    {/* When Platform.OS is NOT 'ios', the Marker has no children,
                        and will use the default pin with the pinColor set above. */}
                    {Platform.OS === 'ios' && (
                        point.photoUri ? (
                            <View style={localStyles.photoMarker}>
                                {/* Optional: Change icon color/style if isComplete */}
                                <MaterialCommunityIcons name="camera-marker" size={isComplete ? 25 : 30} color={isComplete ? "darkgreen" : "green"} />
                            </View>
                        ) : (
                             <View style={localStyles.defaultMarker}>
                                 {/* Optional: Change icon color/style if isComplete */}
                                <MaterialCommunityIcons name="map-marker" size={isComplete ? 25 : 30} color={isComplete ? "darkred" : "red"} />
                            </View>
                        )
                    )}
                </Marker>
            ))}

            {/* --- Corrected User Location Marker --- */}
            {/* Check points from context for duplicate calculation */}
            {userLocation && !isCoordinateInArray(userLocation, points.map(p => ({ latitude: p.latitude, longitude: p.longitude }))) && (
                 <Marker
                    key="user-location-marker"
                    coordinate={userLocation}
                    title="My Location"
                    pinColor={Platform.OS !== 'ios' ? 'blue' : undefined} // Set blue pin color on Android
                    // You can remove anchor here too
                    // anchor={{ x: 0.5, y: 1 }}
                 >
                     {/* Conditionally render the custom user icon ONLY on iOS */}
                     {Platform.OS === 'ios' && (
                         <MaterialCommunityIcons name="crosshairs-gps" size={30} color="blue" />
                     )}
                 </Marker>
            )}

             {/* Use points from context for polyline */}
             {points.length > 1 && (
                  <Polyline coordinates={points} strokeWidth={3} strokeColor="blue" />
             )}
            </MapView>

            {/* Undo/Redo Buttons - Use points and redoStack from context */}
            <View style={{ position: 'absolute', top: 50, right: 20, flexDirection: 'row', zIndex: 1 }}>
                <TouchableOpacity
                    onPress={handleUndo} // Calls context function
                    disabled={points.length === 0 || isComplete} // Use points/isComplete from context
                    style={{
                        backgroundColor: (points.length > 0 && !isComplete) ? Styles.button.backgroundColor : Styles.inputFields.backgroundColor,
                        padding: 8,
                        borderRadius: 20,
                        marginRight: 10
                    }}
                >
                    <EvilIcons
                        name="undo"
                        size={30}
                        color={(points.length > 0 && !isComplete) ? 'black' : 'grey'}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleRedo} // Calls context function
                    disabled={redoStack.length === 0 || isComplete} // Use redoStack/isComplete from context
                    style={{
                        backgroundColor: (redoStack.length > 0 && !isComplete) ? Styles.button.backgroundColor : Styles.inputFields.backgroundColor,
                        padding: 8,
                        borderRadius: 20
                    }}
                >
                    <EvilIcons
                        name="redo"
                        size={30}
                        color={(redoStack.length > 0 && !isComplete) ? 'black' : 'grey'}
                    />
                </TouchableOpacity>
            </View>

             {/* --- Clear Map Button --- */}
            <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 1 }}>
                <TouchableOpacity
                    onPress={handleClearMap} // Calls the new handler
                    disabled={points.length === 0} // Disable if there are no points to clear
                    style={{
                        backgroundColor: points.length > 0 ? Styles.button.backgroundColor : Styles.inputFields.backgroundColor,
                        padding: 8,
                        borderRadius: 20,
                    }}
                >
                    <Ionicons
                         name="trash-outline" // Use a trash can icon
                         size={30}
                         color={points.length > 0 ? 'black' : 'grey'}
                    />
                </TouchableOpacity>
            </View>

            {/* Photograph Position Button - Still local logic */}
            {!isComplete && ( // Use isComplete from context
                 <TouchableOpacity
                     style={[
                         Styles.button,
                         localStyles.photoButton
                     ]}
                     onPress={handlePhotographPosition}
                 >
                     <Ionicons name="camera-outline" size={24} color={Styles.buttonText.color} style={{ marginRight: 5 }} />
                     <Text style={Styles.buttonText}>Photograph Position</Text>
                 </TouchableOpacity>
            )}

            {/* Complete Plotting Button - Use points/isComplete from context */}
             {!isComplete && (
                 <TouchableOpacity
                      style={[
                          Styles.button,
                          {
                              position: 'absolute',
                              bottom: 80,
                              left: 20,
                              right: 20,
                              width: undefined,
                              marginTop: 0,
                              alignSelf: 'center',
                              opacity: (points.length >= 3) ? 1 : 0.5
                          },
                      ]}
                      onPress={handleCompletePlotting} // Calls local handler which updates context
                       disabled={new Set(points.map(p => `${p.latitude},${p.longitude}`)).size < 3} // Use points from context
                 >
                     <Text style={Styles.buttonText}>Complete Shape</Text>
                 </TouchableOpacity>
             )}

            {/* Button to Mark User's Location - Use isComplete from context */}
            <TouchableOpacity
                style={[
                    Styles.button,
                    {
                        position: 'absolute',
                        bottom: 30,
                        left: 20,
                        right: 20,
                        width: undefined,
                        marginTop: 0,
                        alignSelf: 'center',
                         opacity: isComplete ? 0.5 : 1
                    },
                ]}
                onPress={getCurrentUserLocation} // Calls local handler which updates context
                 disabled={isComplete} // Use isComplete from context
            >
                <Text style={Styles.buttonText}>Mark My Location</Text>
            </TouchableOpacity>

            {/* Modal for polygon details - Modal state, inputs are local. Use points from context */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <View style={[Styles.formBox, { width: '100%', minHeight: '35%', borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20 }]}>
                            <Text style={[Styles.text, { marginBottom: 15, textAlign: 'center', fontSize: 18, fontWeight: 'bold' }]}>Enter Location Details</Text>
                            <TextInput
                                style={[Styles.inputFields, { marginBottom: 15, width: '100%' }]}
                                placeholder="Place Name"
                                placeholderTextColor="#3D550C"
                                value={placeName}
                                onChangeText={setPlaceName}
                            />
                            <TextInput
                                style={[Styles.inputFields, { marginBottom: 20, width: '100%', minHeight: 80, textAlignVertical: 'top' }]}
                                placeholder="Location Details"
                                placeholderTextColor="#3D550C"
                                value={locationDetails}
                                onChangeText={setLocationDetails}
                                multiline={true}
                            />
                             {/* Show photos from points array (from context) */}
                             <Text style={[Styles.text, { marginBottom: 10, marginTop: 10 }]}>Photos Attached:</Text>
                             {points.filter(p => p.photoUri).length > 0 ? ( // Use points from context
                                 <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
                                     {points.filter(p => p.photoUri).map((point, idx) => ( // Use points from context
                                         <Image
                                              key={`modal-photo-${idx}`}
                                             source={{ uri: point.photoUri }}
                                             style={{ width: 80, height: 80, resizeMode: 'cover', borderRadius: 5, margin: 5 }}
                                         />
                                     ))}
                                 </View>
                             ) : (
                                 <Text style={[Styles.text, { color: '#888', marginBottom: 20 }]}>No photos captured for points.</Text>
                             )}


                            <TouchableOpacity
                                 style={[Styles.button, { width: '100%' }]}
                                 onPress={() => {
                                     console.log(">>> Map: Saving Polygon Data:", { points, placeName, locationDetails }); // Use points from context
                                     Alert.alert("Details Submitted", `Place: ${placeName}\nDetails: ${locationDetails}\nPoints: ${points.length}\nPhotos: ${points.filter(p => p.photoUri).length}`); // Use points from context

                                     // --- Use resetPoints from context after saving ---
                                     console.log(">>> Map: Calling resetPoints from context after submit.");
                                     resetPoints(); // Call context function to reset state

                                     // Reset local state
                                     setPlaceName('');
                                     setLocationDetails('');
                                     setModalVisible(false);
                                 }}
                            >
                                <Text style={Styles.buttonText}>Submit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                 style={{ marginTop: 10 }}
                                 onPress={() => setModalVisible(false)}
                             >
                                <Text style={[Styles.text, { color: '#555' }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const localStyles = StyleSheet.create({
    photoButton: {
        position: 'absolute',
        bottom: 130,
        left: 20,
        right: 20,
        width: undefined,
        marginTop: 0,
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    photoMarker: {
        padding: 2,
        backgroundColor: 'white',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'green',
    },
    defaultMarker: {
         padding: 2,
         backgroundColor: 'white',
         borderRadius: 15,
         borderWidth: 1,
         borderColor: 'red',
    }
});