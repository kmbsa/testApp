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
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapScreenProps, RootStackNavigationProp, MapPoint, RootStackParamList } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePointsContext } from '../context/PointsContext';

type TestScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Test'>;

type TestScreenRouteProp = MapScreenProps['route']; 


const isCoordinateInArray = (coordinate: { latitude: number; longitude: number }, array: { latitude: number; longitude: number }[], epsilon = 0.00001): boolean => {
    return array.some(point =>
        Math.abs(point.latitude - coordinate.latitude) < epsilon &&
        Math.abs(point.longitude - coordinate.longitude) < epsilon
    );
};

export default function Map() { 
    const navigation = useNavigation<TestScreenNavigationProp>();
    const route = useRoute<TestScreenRouteProp>();


    const { points, redoStack, isComplete, addPoint, resetPoints, undoPoint, redoPoint, setIsComplete, closePolygon } = usePointsContext();


    const mapRef = useRef<MapView | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [placeName, setPlaceName] = useState('');
    const [locationDetails, setLocationDetails] = useState('');

    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);


    useFocusEffect(
        useCallback(() => {
            console.log('>>> Test (Map): useFocusEffect running. Current route params:', route.params);

            if (route.params?.capturedPhotoUri && route.params?.capturedLocation) {
                const uri = route.params.capturedPhotoUri;
                const loc = route.params.capturedLocation;
                console.log(">>> Test (Map): Photo and location received from camera:", { uri, loc });

                const newPhotoPoint: MapPoint = {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    photoUri: uri,
                };

                const isDuplicate = points.some(point =>
                    Math.abs(point.latitude - newPhotoPoint.latitude) < 0.00001 &&
                    Math.abs(point.longitude - newPhotoPoint.longitude) < 0.00001 &&
                    point.photoUri === newPhotoPoint.photoUri // Check photoUri too
                );

                if (isDuplicate) {
                    console.log(">>> Test (Map): Skipping duplicate photo point.");
                } else {
                    console.log(">>> Test (Map): Adding new photo point via context.");
                    addPoint(newPhotoPoint);
                }

                navigation.setParams({ capturedPhotoUri: undefined, capturedLocation: undefined });
                console.log('>>> Test (Map): Navigation params cleared.');

            } else {
                console.log('>>> Test (Map): useFocusEffect running, but no photo params found.');
            }
        }, [route.params, navigation, points, addPoint])
    );

    useEffect(() => {
        console.log('### FINAL Test (Map) Points state changed (from Context):', points);
    }, [points]);


    const handleMapReady = () => {
        setMapLoaded(true);
        if (mapRef.current && points.length === 0) {
             console.log(">>> Test (Map): Map ready, points empty. Fitting to default bounds."); // Changed log
             mapRef.current.fitToCoordinates([ { latitude: 5.0, longitude: 115.0 }, { latitude: 19.0, longitude: 127.0 }, ], { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
        } else if (mapRef.current && points.length > 0) {
             console.log(`>>> Test (Map): Map ready, ${points.length} points exist (from context). Fitting to points.`); // Changed log
             mapRef.current.fitToCoordinates(points, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
        }
    };

    const handleMapPress = (event: any) => {
         if (isComplete) { console.log(">>> Test (Map): Map press ignored: shape is complete."); return; }
        const newCoord = event.nativeEvent.coordinate;
        const newPoint: MapPoint = { latitude: newCoord.latitude, longitude: newCoord.longitude };

        console.log(">>> Test (Map): Adding new map press point via context.");
        addPoint(newPoint);
    };

    const handleMarkerPress = (index: number) => {
         if (isComplete) {
             const tappedPoint = points[index];
             console.log(">>> Test (Map): Tapped marker on completed shape:", tappedPoint);
             if (tappedPoint.photoUri) {
                  Alert.alert("Photo Available", `Photo attached to this point:\n${tappedPoint.photoUri}`);
             } else {
                  Alert.alert("Point Details", `Lat: ${tappedPoint.latitude.toFixed(4)}, Lng: ${tappedPoint.longitude.toFixed(4)}`);
             }
             return; // Exit if complete
         }

        if (points.length > 1 && index === 0) {
             console.log(">>> Test (Map): Tapped first marker to complete shape. Calling context.closePolygon()");

             closePolygon();

             setModalVisible(true);
        } else {
             console.log(`>>> Test (Map): Tapped marker at index ${index} while plotting.`);

        }
    };

    const handleUndo = () => {
         if (isComplete) return;
         undoPoint();
    };

    const handleRedo = () => {
         if (isComplete) return;
         redoPoint();
    };

    const getCurrentUserLocation = async () => {
         if (isComplete) { Alert.alert("Shape Already Completed", "Cannot add location points after completing the shape."); return; }
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert( 'Location Permission Denied', 'Please enable location services to mark your current location.', [{ text: 'OK' }]); return; }
        let location = await Location.getCurrentPositionAsync({});
        const userCoordinate: MapPoint = { latitude: location.coords.latitude, longitude: location.coords.longitude };

        setUserLocation({ latitude: userCoordinate.latitude, longitude: userCoordinate.longitude });

        console.log(">>> Test (Map): Adding new user location point via context.");
        addPoint(userCoordinate);
        mapRef.current?.animateToRegion({
            latitude: userCoordinate.latitude,
            longitude: userCoordinate.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        });
    };

    const handleCompletePlotting = () => {
         if (isComplete) { Alert.alert("Shape Already Completed", "You have already finished plotting points."); setModalVisible(true); return; }
        const uniquePointsCount = new Set(points.map(p => `${p.latitude},${p.longitude}`)).size;
        if (uniquePointsCount < 3) { Alert.alert("Not Enough Points", "Please add at least 3 unique points before completing the shape."); return; }

        console.log(">>> Test (Map): Completing shape via button press. Calling context.closePolygon()");
        closePolygon();

        setModalVisible(true);
    };

    const handleClearMap = () => {
        Alert.alert(
            "Clear Map",
            "Are you sure you want to clear all plotted points?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    onPress: () => {
                        console.log(">>> Test (Map): Clearing map via context resetPoints.");
                        resetPoints();
                        setModalVisible(false);
                        setPlaceName('');
                        setLocationDetails('');
                        setUserLocation(null);
                    },
                    style: "destructive",
                },
            ],
            { cancelable: true }
        );
    };

    const handlePhotographPosition = async () => {
        console.log(">>> Test (Map): Navigating to Camera page ('Test2').");
        navigation.navigate('Test2');
    };


    return (
        <SafeAreaView style={{ flex: 1 }}>
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

                {points.map((point, index) => (
                <Marker
                    key={`marker-${index}`}
                    coordinate={point}
                    onPress={() => handleMarkerPress(index)}
                    pinColor={Platform.OS !== 'ios' ? (point.photoUri ? 'green' : 'red') : undefined}
                >
                    {Platform.OS === 'ios' && (
                        point.photoUri ? (
                            <View style={localStyles.photoMarker}>
                                <MaterialCommunityIcons name="camera-marker" size={isComplete ? 25 : 30} color={isComplete ? "darkgreen" : "green"} />
                            </View>
                        ) : (
                             <View style={localStyles.defaultMarker}>
                                 <MaterialCommunityIcons name="map-marker" size={isComplete ? 25 : 30} color={isComplete ? "darkred" : "red"} />
                            </View>
                        )
                    )}
                </Marker>
            ))}

             {userLocation && !isCoordinateInArray(userLocation, points.map(p => ({ latitude: p.latitude, longitude: p.longitude }))) && (
                 <Marker
                    key="user-location-marker"
                    coordinate={userLocation}
                    title="My Location"
                    pinColor={Platform.OS !== 'ios' ? 'blue' : undefined}
                 >
                     {Platform.OS === 'ios' && (
                         <MaterialCommunityIcons name="crosshairs-gps" size={30} color="blue" />
                     )}
                 </Marker>
            )}

             {points.length > 1 && (
                  <Polyline coordinates={points} strokeWidth={3} strokeColor="blue" />
             )}

            </MapView>

            <SafeAreaView style={localStyles.backButtonContainer}>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Home')} // Navigate to the 'Home' screen
                    style={localStyles.backButton}
                >

                     <Ionicons name="chevron-back" size={30} color={Styles.buttonText.color} />
                </TouchableOpacity>
            </SafeAreaView>

            <SafeAreaView style={localStyles.undoRedoClearContainer}>
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={handleClearMap}
                        disabled={points.length === 0}
                        style={[
                            localStyles.clearButton, // Apply style for margin
                            {
                            backgroundColor: points.length > 0 ? Styles.button.backgroundColor : Styles.inputFields.backgroundColor,
                            padding: 8,
                            borderRadius: 20,
                            },
                        ]}
                    >
                        <Ionicons name="trash-outline" size={30} color={points.length > 0 ? 'black' : 'grey'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleUndo}
                        disabled={points.length === 0 || isComplete}
                        style={{
                            backgroundColor: (points.length > 0 && !isComplete) ? Styles.button.backgroundColor : Styles.inputFields.backgroundColor,
                            padding: 8,
                            borderRadius: 20,
                            marginRight: 10
                        }}
                    >
                        <EvilIcons name="undo" size={30} color={(points.length > 0 && !isComplete) ? 'black' : 'grey'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleRedo}
                        disabled={redoStack.length === 0 || isComplete}
                        style={{
                            backgroundColor: (redoStack.length > 0 && !isComplete) ? Styles.button.backgroundColor : Styles.inputFields.backgroundColor,
                            padding: 8,
                            borderRadius: 20
                        }}
                    >
                        <EvilIcons name="redo" size={30} color={(redoStack.length > 0 && !isComplete) ? 'black' : 'grey'} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {!isComplete && (
                 <TouchableOpacity
                     style={[ Styles.button, localStyles.photoButton ]}
                     onPress={handlePhotographPosition}
                 >
                     <Ionicons name="camera-outline" size={24} color={Styles.buttonText.color} style={{ marginRight: 5 }} />
                     <Text style={Styles.buttonText}>Photograph Position</Text>
                 </TouchableOpacity>
            )}

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
                      onPress={handleCompletePlotting}
                       disabled={new Set(points.map(p => `${p.latitude},${p.longitude}`)).size < 3}
                 >
                     <Text style={Styles.buttonText}>Complete Shape</Text>
                 </TouchableOpacity>
            )}

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
                onPress={getCurrentUserLocation}
                 disabled={isComplete}
            >
                <Text style={Styles.buttonText}>Mark My Location</Text>
            </TouchableOpacity>

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

                             {points.filter(p => p.photoUri).length > 0 ? (
                                 <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
                                     {points.filter(p => p.photoUri).map((point, idx) => (
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
                                     console.log(">>> Test (Map): Saving Polygon Data:", { points, placeName, locationDetails }); // Changed log
                                     Alert.alert("Details Submitted", `Place: ${placeName}\nDetails: ${locationDetails}\nPoints: ${points.length}\nPhotos: ${points.filter(p => p.photoUri).length}`);

                                     console.log(">>> Test (Map): Calling resetPoints from context after submit."); // Changed log
                                     resetPoints();

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

        </SafeAreaView>
    );
}

const localStyles = StyleSheet.create({
    backButtonContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
        paddingTop: 10,
        paddingLeft: 10,
    },
    backButton: {
        backgroundColor: Styles.button.backgroundColor,
        padding: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    undoRedoClearContainer: {
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 1,
        paddingTop: 10,
        paddingRight: 10,
    },
    clearButton: {
        marginRight: 10, // Add space to the right of the clear button
    },

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