import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import EvilIcons from '@expo/vector-icons/build/EvilIcons';
import MaterialCommunityIcons from '@expo/vector-icons/build/MaterialCommunityIcons';
import axios, { AxiosError } from 'axios';
import * as turf from '@turf/turf';
import type {
  FeatureCollection,
  Polygon,
  MultiPolygon,
  Position,
} from 'geojson';

import { API_URL } from '@env';
import { useAuth } from '../../../context/AuthContext';
import Styles from '../../../styles/styles';
import type {
  MapCoordinatesUpdateProps,
  Coordinate,
  AreaEntry,
  BackendCoordinate,
} from '../../../navigation/types';

import gadm41_PHL_1 from '../../../../assets/data/gadm41_PHL_1.json';
import { findClosestSegmentForInsertion } from '../../../context/PointsContext';

// Helper function from Map.tsx to calculate area
const calculateAreaInHectares = (coordinates: Coordinate[]): number => {
  if (coordinates.length < 3) {
    return 0;
  }

  let geojsonCoords = coordinates.map((c) => [c.longitude, c.latitude]);
  const firstPoint = geojsonCoords[0];
  const lastPoint = geojsonCoords[geojsonCoords.length - 1];

  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    geojsonCoords = [...geojsonCoords, firstPoint];
  }

  try {
    const polygon = turf.polygon([geojsonCoords]);
    const areaSqMeters = turf.area(polygon);
    const areaHectares = areaSqMeters / 10000;
    return areaHectares;
  } catch (error) {
    console.error('Turf.js Calculation Error:', error);
    return 0;
  }
};

const lookupAreaLocation = (
  polygonPoints: { latitude: number; longitude: number }[],
): { province: string | null; region: string | null } => {
  if (polygonPoints.length < 3) return { province: null, region: null };

  const coords: Position[] = polygonPoints.map((p) => [
    p.longitude,
    p.latitude,
  ]);
  if (
    coords.length > 0 &&
    (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])
  ) {
    coords.push(coords[0]);
  }
  const turfPolygon = turf.polygon([coords]);

  const centerPoint = turf.centroid(turfPolygon);

  const geojsonFeatures = (
    gadm41_PHL_1 as FeatureCollection<Polygon | MultiPolygon>
  ).features;

  let provinceGadmLabel: string | null = null;
  for (const feature of geojsonFeatures) {
    if (turf.booleanPointInPolygon(centerPoint, feature)) {
      provinceGadmLabel = feature.properties?.NAME_1 as string;
      break;
    }
  }

  return { province: provinceGadmLabel, region: null };
};

/**
 * FIX 1: Checks if the tap is near an existing marker, to prevent map tap (insertion)
 * from firing when marker tap (delete/options) is intended.
 * @param tapCoord The coordinate of the map press event.
 * @param points The array of existing markers.
 * @returns boolean
 */
const isTapNearExistingMarker = (
  tapCoord: Coordinate,
  points: Coordinate[],
): boolean => {
  // Set a tolerance of 10 meters radius for marker tap detection
  const TAP_TOLERANCE_METERS = 10;
  const tapPoint = turf.point([tapCoord.longitude, tapCoord.latitude]);

  for (const point of points) {
    const existingPoint = turf.point([point.longitude, point.latitude]);
    const distance = turf.distance(tapPoint, existingPoint, {
      units: 'meters',
    });
    if (distance < TAP_TOLERANCE_METERS) {
      return true; // The tap is likely intended for a marker
    }
  }
  return false;
};

const MapCoordinatesUpdate = () => {
  const navigation = useNavigation<MapCoordinatesUpdateProps['navigation']>();
  const route = useRoute<MapCoordinatesUpdateProps['route']>();

  const { userToken, signOut } = useAuth();
  const mapRef = useRef<MapView | null>(null);

  const areaId = route.params?.areaId;

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaData, setAreaData] = useState<AreaEntry | null>(null);

  const [points, setPoints] = useState<Coordinate[]>([]);
  const [undoStack, setUndoStack] = useState<Coordinate[][]>([]);
  const [redoStack, setRedoStack] = useState<Coordinate[][]>([]);

  const [isComplete, setIsComplete] = useState(true);

  const handleStateChange = (newPoints: Coordinate[]) => {
    setUndoStack((prev) => [points, ...prev]);
    setRedoStack([]);
    setPoints(newPoints);
  };

  const undoPoint = () => {
    if (undoStack.length === 0) return;
    const previousPoints = undoStack[0];
    setRedoStack((prev) => [points, ...prev]);
    setUndoStack((prev) => prev.slice(1));
    setPoints(previousPoints);
  };

  const redoPoint = () => {
    if (redoStack.length === 0) return;
    const nextPoints = redoStack[0];
    setUndoStack((prev) => [points, ...prev]);
    setRedoStack((prev) => prev.slice(1));
    setPoints(nextPoints);
  };

  const updatePoint = (index: number, newCoord: Coordinate) => {
    handleStateChange(points.map((p, i) => (i === index ? newCoord : p)));
  };

  const deletePoint = (index: number) => {
    Alert.alert(
      'Delete Point',
      'Are you sure you want to remove this marker?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => {
            const newPoints = points.filter((_, i) => i !== index);
            if (newPoints.length < 3) {
              Alert.alert(
                'Shape Incomplete',
                'The area must have at least 3 points. The shape will be considered incomplete if you delete this.',
              );
              setIsComplete(false);
            }
            handleStateChange(newPoints);
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  const insertPoint = (newCoord: Coordinate, insertionIndex: number) => {
    const newPoints = [
      ...points.slice(0, insertionIndex),
      newCoord,
      ...points.slice(insertionIndex),
    ];
    handleStateChange(newPoints);
    if (newPoints.length >= 3 && !isComplete) {
      setIsComplete(true);
    }
  };

  const handleMapPress = (event: any) => {
    const newCoord: Coordinate = event.nativeEvent.coordinate;

    // FIX 3: Event conflict resolution. If the tap is near a marker,
    // we rely on the Marker's onPress handler to deal with it and ignore the map press.
    if (isTapNearExistingMarker(newCoord, points)) {
      return;
    }

    // 1. Check if the press is near an existing polyline segment
    if (points.length >= 2) {
      // FIX 2: Increased tolerance for easier tapping (0.0005 degrees is approx. 50 meters)
      const SEGMENT_TOLERANCE = 0.0005;
      const segmentData = findClosestSegmentForInsertion(
        newCoord,
        points,
        SEGMENT_TOLERANCE,
      );

      if (segmentData) {
        Alert.alert(
          'Insert Point',
          'A new point will be inserted on the closest line segment.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Insert',
              onPress: () => insertPoint(newCoord, segmentData.insertionIndex),
            },
          ],
        );
        return;
      }
    }

    // 2. Fallback if not near a segment
    Alert.alert(
      'Point Insertion',
      'Please tap near an existing line segment to insert a new point.',
      [{ text: 'OK' }],
    );
  };

  const handleMarkerPress = (index: number) => {
    const tappedPoint = points[index];
    Alert.alert(
      'Marker Options',
      `Lat: ${tappedPoint.latitude.toFixed(4)}, Lng: ${tappedPoint.longitude.toFixed(4)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Marker',
          onPress: () => deletePoint(index),
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  const fetchAreaDetails = useCallback(async () => {
    if (!areaId) {
      setError('Area ID is missing.');
      setIsLoading(false);
      return;
    }
    if (!userToken) {
      setError('Authentication token is missing. Please log in.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/area/${areaId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        Alert.alert('Session Expired', 'Please log in again.');
        await signOut();
        return;
      }

      const data: { area: AreaEntry } = response.data;
      const fetchedArea = data.area;

      setAreaData(fetchedArea);

      // Map BackendCoordinate {Latitude, Longitude} to Coordinate {latitude, longitude}
      const fetchedCoordinates: BackendCoordinate[] =
        fetchedArea.coordinates || [];
      const initialCoordinates: Coordinate[] = fetchedCoordinates.map((bc) => ({
        latitude: bc.Latitude,
        longitude: bc.Longitude,
      }));
      // -------------------------------------------------------------------

      if (initialCoordinates.length < 3) {
        setIsComplete(false);
      } else {
        setIsComplete(true);
      }

      setPoints(initialCoordinates);
    } catch (err: any) {
      const error = err as AxiosError;
      const apiErrorMessage = (error.response?.data as { message?: string })
        ?.message;
      setError(
        apiErrorMessage || 'Failed to load details. Check network or API.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [areaId, userToken, signOut]);

  useEffect(() => {
    fetchAreaDetails();
  }, [fetchAreaDetails]);

  const handleMapReady = useCallback(() => {
    if (mapRef.current && points.length > 0) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [points]);

  const hasUnsavedChanges = useMemo(() => {
    return undoStack.length > 0 || redoStack.length > 0;
  }, [undoStack.length, redoStack.length]);

  const handleConfirmUpdate = () => {
    if (points.length < 3) {
      Alert.alert(
        'Shape Incomplete',
        'You must have at least 3 points to update the area.',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'Confirm Update',
      'Are you sure you want to update the area coordinates?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Coordinates',
          onPress: handleSubmitUpdate,
          style: 'default',
        },
      ],
      { cancelable: true },
    );
  };

  const handleSubmitUpdate = async () => {
    if (isUpdating || !areaId || !userToken) return;

    if (points.length < 3) {
      Alert.alert('Invalid Shape', 'Cannot update with fewer than 3 points.');
      return;
    }

    setIsUpdating(true);
    setError(null);

    const newHectares = calculateAreaInHectares(points);
    const { province, region } = lookupAreaLocation(points);

    const updatedData = {
      Area_Name: areaData?.Area_Name,
      Region: areaData?.Region,
      Province: areaData?.Province,
      Organization: areaData?.Organization,
      Hectares: newHectares.toFixed(4),
      coordinates: points,
      geo_region: region,
      geo_province: province,
    };

    try {
      const response = await axios.put(
        `${API_URL}/area/${areaId}`,
        updatedData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
        },
      );

      if (response.status === 200) {
        Alert.alert('Success', 'Area coordinates updated successfully!');
        setUndoStack([]);
        setRedoStack([]);
        navigation.goBack();
      } else {
        throw new Error(response.data?.message || 'Update failed.');
      }
    } catch (err) {
      const error = err as AxiosError;
      const apiErrorMessage = (error.response?.data as { message?: string })
        ?.message;

      Alert.alert(
        'Update Failed',
        apiErrorMessage ||
          error.message ||
          'There was an issue saving your changes.',
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={localStyles.centerContainer}>
        <ActivityIndicator size="large" color={Styles.button.backgroundColor} />
        <Text style={[Styles.text, { marginTop: 10, color: '#888' }]}>
          Loading map coordinates...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={localStyles.centerContainer}>
        <Text style={localStyles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={fetchAreaDetails}
          style={localStyles.retryButton}
        >
          <Text style={Styles.buttonText}>Retry Load</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={localStyles.goBackButton}
        >
          <Text style={Styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Styles.background.backgroundColor }}
    >
      {/* --- HEADER --- */}
      <View style={localStyles.headerContainer}>
        <TouchableOpacity
          onPress={() => {
            if (hasUnsavedChanges) {
              Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Discard and go back?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () => {
                      navigation.goBack();
                    },
                  },
                ],
              );
            } else {
              navigation.goBack();
            }
          }}
          style={localStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
        </TouchableOpacity>
        <View style={localStyles.headerTitleContainer}>
          <Text style={localStyles.title} numberOfLines={1}>
            Updating: **{areaData?.Area_Name || 'Area Coordinates'}**
          </Text>
        </View>
      </View>

      {/* --- MAP VIEW --- */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        onMapReady={handleMapReady}
        onPress={handleMapPress} // Map press handles insertion, now with conflict resolution
        mapType="hybrid"
        initialRegion={
          points.length > 0
            ? {
                latitude: points[0].latitude,
                longitude: points[0].longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : undefined
        }
      >
        {points.map((point, index) => (
          <Marker
            draggable
            onDrag={(e) => updatePoint(index, e.nativeEvent.coordinate)}
            onDragEnd={(e) => updatePoint(index, e.nativeEvent.coordinate)}
            key={`marker-${index}`}
            coordinate={point}
            onPress={() => handleMarkerPress(index)} // Marker press handles delete/options
            pinColor={Platform.OS !== 'ios' ? 'red' : undefined}
          >
            {Platform.OS === 'ios' && (
              <View>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={30}
                  color={'red'}
                />
              </View>
            )}
          </Marker>
        ))}

        {points.length > 1 && (
          <Polyline coordinates={points} strokeWidth={3} strokeColor="blue" />
        )}

        {/* Closing line for completed/closed shape */}
        {points.length >= 3 && isComplete && (
          <Polyline
            coordinates={[points[points.length - 1], points[0]]}
            strokeWidth={3}
            strokeColor="red"
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* --- FLOATING CONTROLS --- */}
      <View style={localStyles.floatingControlsContainer}>
        {/* Undo/Redo */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={undoPoint}
            disabled={undoStack.length === 0}
            style={[
              localStyles.actionButton,
              {
                backgroundColor:
                  undoStack.length > 0
                    ? Styles.button.backgroundColor
                    : Styles.inputFields.backgroundColor,
                marginRight: 10,
              },
            ]}
          >
            <EvilIcons
              name="undo"
              size={30}
              color={undoStack.length > 0 ? 'black' : 'grey'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={redoPoint}
            disabled={redoStack.length === 0}
            style={[
              localStyles.actionButton,
              {
                backgroundColor:
                  redoStack.length > 0
                    ? Styles.button.backgroundColor
                    : Styles.inputFields.backgroundColor,
              },
            ]}
          >
            <EvilIcons
              name="redo"
              size={30}
              color={redoStack.length > 0 ? 'black' : 'grey'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- UPDATE BUTTON --- */}
      <TouchableOpacity
        style={[
          Styles.button,
          localStyles.updateButton,
          {
            opacity:
              points.length >= 3 && hasUnsavedChanges && !isUpdating ? 1 : 0.5,
          },
        ]}
        onPress={handleConfirmUpdate}
        disabled={points.length < 3 || isUpdating || !hasUnsavedChanges}
      >
        {isUpdating ? (
          <ActivityIndicator color={Styles.buttonText.color} />
        ) : (
          <Text style={Styles.buttonText}>Confirm Coordinate Update</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Styles.background.backgroundColor,
  },
  errorText: {
    color: '#d9534f',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  retryButton: {
    ...Styles.button,
    backgroundColor: '#3D550C',
    width: 150,
    marginTop: 20,
  },
  goBackButton: {
    ...Styles.button,
    backgroundColor: '#3D550C',
    width: 150,
    marginTop: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: Styles.background.backgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Styles.text.color,
    textAlign: 'center',
  },
  floatingControlsContainer: {
    position: 'absolute',
    top: 110,
    right: 10,
    zIndex: 1,
    paddingTop: 10,
    paddingRight: 10,
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
  },
  updateButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    width: undefined,
    marginTop: 0,
    alignSelf: 'center',
    zIndex: 1,
  },
});

export default MapCoordinatesUpdate;
