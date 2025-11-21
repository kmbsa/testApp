import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Draft data types for MapCoordinatesUpdate
export type MapCoordinatesUpdateDraftData = {
  areaId: number;
  areaName: string;
  coordinates: Coordinate[];
  province: string | null;
  region: string | null;
  hectares: number;
  createdAt: number;
};

export type StoredMapCoordinatesUpdateDraft = MapCoordinatesUpdateDraftData & {
  draftKey: string;
};

const DRAFT_KEY_PREFIX = 'mapCoordinatesUpdate_draft_';

/**
 * Save a draft for MapCoordinatesUpdate
 */
export const saveMapCoordinatesUpdateDraft = async (
  draftData: MapCoordinatesUpdateDraftData,
): Promise<string> => {
  try {
    const draftKey = `${DRAFT_KEY_PREFIX}${draftData.areaId}_${Date.now()}`;

    const finalDraft: StoredMapCoordinatesUpdateDraft = {
      ...draftData,
      draftKey,
    };

    // Save the draft
    await AsyncStorage.setItem(draftKey, JSON.stringify(finalDraft));

    // Keep a list of all MapCoordinatesUpdate drafts
    let draftKeys = await AsyncStorage.getItem(
      'mapCoordinatesUpdate_draft_keys',
    );
    let keys: string[] = [];
    if (draftKeys) {
      keys = JSON.parse(draftKeys);
    }
    if (!keys.includes(draftKey)) {
      keys.push(draftKey);
    }
    await AsyncStorage.setItem(
      'mapCoordinatesUpdate_draft_keys',
      JSON.stringify(keys),
    );

    Alert.alert('Draft Saved', 'Map coordinates draft saved locally.');
    return draftKey;
  } catch (error) {
    console.error('Failed to save MapCoordinatesUpdate draft:', error);
    Alert.alert('Error', `Failed to save draft.\n${error}`);
    throw error;
  }
};

/**
 * Load all MapCoordinatesUpdate drafts
 */
export const loadMapCoordinatesUpdateDrafts = async (): Promise<
  StoredMapCoordinatesUpdateDraft[]
> => {
  try {
    let draftKeys = await AsyncStorage.getItem(
      'mapCoordinatesUpdate_draft_keys',
    );
    if (!draftKeys) {
      return [];
    }

    const keys: string[] = JSON.parse(draftKeys);
    const drafts: StoredMapCoordinatesUpdateDraft[] = [];

    for (const key of keys) {
      const draftData = await AsyncStorage.getItem(key);
      if (draftData) {
        const parsedDraft = JSON.parse(draftData);
        drafts.push(parsedDraft);
      }
    }

    return drafts.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Failed to load MapCoordinatesUpdate drafts:', error);
    return [];
  }
};

/**
 * Delete a MapCoordinatesUpdate draft
 */
export const deleteMapCoordinatesUpdateDraft = async (draftKey: string) => {
  try {
    await AsyncStorage.removeItem(draftKey);

    // Remove from draft keys list
    let draftKeys = await AsyncStorage.getItem(
      'mapCoordinatesUpdate_draft_keys',
    );
    if (draftKeys) {
      let keys: string[] = JSON.parse(draftKeys);
      keys = keys.filter((k) => k !== draftKey);
      await AsyncStorage.setItem(
        'mapCoordinatesUpdate_draft_keys',
        JSON.stringify(keys),
      );
    }

    Alert.alert('Success', 'Draft deleted.');
  } catch (error) {
    console.error('Failed to delete draft:', error);
    Alert.alert('Error', 'Failed to delete draft.');
  }
};

/**
 * Finds which line segment the tap point is closest to.
 * Uses Turf.js nearestPointOnLine for accurate detection.
 * Returns the segment for insertion if within tolerance.
 */
const findSegmentAtTap = (
  tapCoord: Coordinate,
  points: Coordinate[],
  toleranceInMeters: number = 50, // 50 meters
): {
  insertionIndex: number;
  segmentIndex: number;
  distance: number;
} | null => {
  if (points.length < 2) return null;

  // Ensure tap coordinate has valid numbers
  const tapLng =
    typeof tapCoord.longitude === 'string'
      ? parseFloat(tapCoord.longitude)
      : tapCoord.longitude;
  const tapLat =
    typeof tapCoord.latitude === 'string'
      ? parseFloat(tapCoord.latitude)
      : tapCoord.latitude;

  if (!isFinite(tapLng) || !isFinite(tapLat)) {
    console.warn('Invalid tap coordinate:', tapCoord);
    return null;
  }

  let closestSegmentIndex = -1;
  let closestDistance = Infinity;

  // Check each segment
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length]; // Circular: last → first

    // Ensure segment points have valid numbers
    const p1Lng =
      typeof p1.longitude === 'string'
        ? parseFloat(p1.longitude)
        : p1.longitude;
    const p1Lat =
      typeof p1.latitude === 'string' ? parseFloat(p1.latitude) : p1.latitude;
    const p2Lng =
      typeof p2.longitude === 'string'
        ? parseFloat(p2.longitude)
        : p2.longitude;
    const p2Lat =
      typeof p2.latitude === 'string' ? parseFloat(p2.latitude) : p2.latitude;

    if (
      !isFinite(p1Lng) ||
      !isFinite(p1Lat) ||
      !isFinite(p2Lng) ||
      !isFinite(p2Lat)
    ) {
      console.warn(`Invalid segment ${i} coordinates:`, {
        p1: { p1Lng, p1Lat },
        p2: { p2Lng, p2Lat },
      });
      continue; // Skip invalid segments
    }

    try {
      // Create a Turf line from p1 to p2
      const line = turf.lineString([
        [p1Lng, p1Lat],
        [p2Lng, p2Lat],
      ]);

      // Find nearest point on this line to the tap
      const tapPoint = turf.point([tapLng, tapLat]);
      const nearest = turf.nearestPointOnLine(line, tapPoint);
      const distanceMeters = nearest.properties.dist * 1000; // Convert km to meters

      console.log(
        `Segment ${i} (${i}→${(i + 1) % points.length}): distance = ${distanceMeters.toFixed(1)}m`,
      );

      // Track closest segment
      if (distanceMeters < closestDistance) {
        closestDistance = distanceMeters;
        closestSegmentIndex = i;
      }
    } catch (error) {
      console.warn(`Error processing segment ${i}:`, error);
      continue; // Skip segments that cause errors
    }
  }

  // If closest segment is within tolerance, return it
  if (closestDistance <= toleranceInMeters && closestSegmentIndex !== -1) {
    console.log(
      `✓ SELECTED Segment ${closestSegmentIndex}: distance = ${closestDistance.toFixed(1)}m`,
    );
    return {
      segmentIndex: closestSegmentIndex,
      insertionIndex: closestSegmentIndex + 1, // Insert AFTER p1, BEFORE p2
      distance: closestDistance,
    };
  }

  console.log(
    closestDistance === Infinity
      ? `✗ No segments processed`
      : `✗ No segment within ${toleranceInMeters}m. Closest was ${closestDistance.toFixed(1)}m`,
  );
  return null;
};

/**
 * Checks if the tap is near an existing marker (within 10 meters).
 * This prevents map press from firing when marker press is intended.
 */
const isTapNearExistingMarker = (
  tapCoord: Coordinate,
  points: Coordinate[],
): boolean => {
  const TAP_TOLERANCE_METERS = 10;

  // Ensure tap coordinate has valid numbers
  const tapLng =
    typeof tapCoord.longitude === 'string'
      ? parseFloat(tapCoord.longitude)
      : tapCoord.longitude;
  const tapLat =
    typeof tapCoord.latitude === 'string'
      ? parseFloat(tapCoord.latitude)
      : tapCoord.latitude;

  if (!isFinite(tapLng) || !isFinite(tapLat)) {
    console.warn(
      'Invalid tap coordinate in isTapNearExistingMarker:',
      tapCoord,
    );
    return false;
  }

  try {
    const tapPoint = turf.point([tapLng, tapLat]);

    for (const point of points) {
      const pLng =
        typeof point.longitude === 'string'
          ? parseFloat(point.longitude)
          : point.longitude;
      const pLat =
        typeof point.latitude === 'string'
          ? parseFloat(point.latitude)
          : point.latitude;

      if (!isFinite(pLng) || !isFinite(pLat)) {
        console.warn('Invalid point coordinate:', point);
        continue;
      }

      const existingPoint = turf.point([pLng, pLat]);
      const distance = turf.distance(tapPoint, existingPoint, {
        units: 'meters',
      });
      if (distance < TAP_TOLERANCE_METERS) {
        return true;
      }
    }
  } catch (error) {
    console.warn('Error in isTapNearExistingMarker:', error);
    return false;
  }

  return false;
};

// Helper function from Map.tsx to calculate area
const calculateAreaInHectares = (coordinates: Coordinate[]): number => {
  if (coordinates.length < 3) {
    return 0;
  }

  // Ensure all coordinates are numbers (API might return strings)
  let geojsonCoords = coordinates.map((c) => [
    typeof c.longitude === 'string' ? parseFloat(c.longitude) : c.longitude,
    typeof c.latitude === 'string' ? parseFloat(c.latitude) : c.latitude,
  ]);

  // Validate that we have valid numbers
  if (
    !geojsonCoords.every(
      (coord) =>
        !isNaN(coord[0]) &&
        !isNaN(coord[1]) &&
        isFinite(coord[0]) &&
        isFinite(coord[1]),
    )
  ) {
    console.warn('Invalid coordinates detected:', geojsonCoords);
    return 0;
  }

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
    typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude,
    typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude,
  ]);

  // Validate that we have valid numbers
  if (
    !coords.every(
      (c) => !isNaN(c[0]) && !isNaN(c[1]) && isFinite(c[0]) && isFinite(c[1]),
    )
  ) {
    console.warn('Invalid coordinates in lookup:', coords);
    return { province: null, region: null };
  }

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

  // Use a ref to always have the current points value
  const pointsRef = useRef<Coordinate[]>([]);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

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
    setPoints(points.map((p, i) => (i === index ? newCoord : p)));
  };

  const savePointToHistory = (index: number, newCoord: Coordinate) => {
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
    console.log(
      `Inserting at index ${insertionIndex}. New total points: ${newPoints.length}`,
    );
    handleStateChange(newPoints);
    if (newPoints.length >= 3 && !isComplete) {
      setIsComplete(true);
    }
  };

  const handleMapPress = (event: any) => {
    const newCoord: Coordinate = event.nativeEvent.coordinate;

    // Conflict resolution: If tap is near a marker, let marker handler deal with it
    if (isTapNearExistingMarker(newCoord, points)) {
      return;
    }

    // Check if tap is on a polyline segment (using Turf.js for accurate detection)
    if (points.length >= 2) {
      const SEGMENT_TOLERANCE_METERS = 50; // 50 meters from line
      const segmentData = findSegmentAtTap(
        newCoord,
        points,
        SEGMENT_TOLERANCE_METERS,
      );

      if (segmentData) {
        // Insert point directly without alert
        insertPoint(newCoord, segmentData.insertionIndex);
        return;
      }
    }

    // No segment found nearby - silently ignore
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
        latitude:
          typeof bc.Latitude === 'string'
            ? parseFloat(bc.Latitude)
            : bc.Latitude,
        longitude:
          typeof bc.Longitude === 'string'
            ? parseFloat(bc.Longitude)
            : bc.Longitude,
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

  // Load draft data if provided via route params
  useEffect(() => {
    const draftData = route.params?.draftData;
    if (draftData) {
      setPoints(draftData.coordinates || []);
      if (draftData.coordinates && draftData.coordinates.length >= 3) {
        setIsComplete(true);
      }
    }
  }, [route.params?.draftData]);

  const handleMapReady = useCallback(() => {
    if (mapRef.current && points.length > 0) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [points]);

  // Track unsaved changes whenever points or state updates
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [points]);

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

    console.log(`Points: ${points}`);
    console.log(`Region: ${region}, Province: ${province}`);

    const updatedData = {
      Area_Name: areaData?.Area_Name,
      Region: region,
      Province: province,
      Hectares: newHectares.toFixed(4),
      coordinates: points,
    };

    try {
      const response = await axios.put(
        `${API_URL}/area/${areaId}/coordinates`,
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

  const handleSaveDraft = async () => {
    if (!areaData) {
      Alert.alert('Error', 'Area data is missing.');
      return;
    }

    // Use the ref to get the actual current points value (not stale closure)
    const currentPoints = pointsRef.current;

    // Allow saving at any point, even with partial coordinates
    let newHectares = 0;
    let province: string | null = null;
    let region: string | null = null;

    // Only calculate these if we have at least 3 points (complete polygon)
    if (currentPoints.length >= 3) {
      newHectares = calculateAreaInHectares(currentPoints);
      const locationData = lookupAreaLocation(currentPoints);
      province = locationData.province;
      region = locationData.region;
    }

    const draftData: MapCoordinatesUpdateDraftData = {
      areaId: areaData.Area_ID,
      areaName: areaData.Area_Name,
      coordinates: currentPoints,
      province: province,
      region: region,
      hectares: newHectares,
      createdAt: Date.now(),
    };

    try {
      await saveMapCoordinatesUpdateDraft(draftData);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving draft:', error);
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
            Updating: {areaData?.Area_Name || 'Area Coordinates'}
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
            onDragEnd={(e) =>
              savePointToHistory(index, e.nativeEvent.coordinate)
            }
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

      {/* --- MAP OVERLAY CONTROLS (Save Draft + Undo/Redo) --- */}
      <View style={localStyles.mapControlsContainer}>
        {/* Save Draft Button */}
        <TouchableOpacity
          onPress={handleSaveDraft}
          style={[
            localStyles.actionButton,
            {
              backgroundColor: hasUnsavedChanges
                ? '#F4D03F'
                : Styles.inputFields.backgroundColor,
              marginRight: 10,
            },
          ]}
          disabled={!areaData}
        >
          <Ionicons
            name="save"
            size={24}
            color={hasUnsavedChanges ? 'black' : 'grey'}
          />
        </TouchableOpacity>

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
  mapControlsContainer: {
    position: 'absolute',
    top: 120,
    left: 15,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButton: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    width: undefined,
    marginTop: 0,
    alignSelf: 'center',
    zIndex: 1,
  },
});

export default MapCoordinatesUpdate;
