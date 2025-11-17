import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
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
import type { Position } from 'geojson';

import { API_URL } from '@env';
import { useAuth } from '../../../context/AuthContext';
import Styles from '../../../styles/styles';
import type {
  FarmPlotCoordinatesProps,
  Coordinate,
  AreaEntry,
  BackendCoordinate,
} from '../../../navigation/types';

// ============================================================================
// COORDINATE CONVERSION & VALIDATION
// ============================================================================

/**
 * Safely converts BackendCoordinate to Coordinate with strict type validation.
 * Ensures all values are numbers, not strings.
 * Returns null if conversion fails.
 */
const convertBackendCoordinateToCoordinate = (
  backendCoord: BackendCoordinate,
): Coordinate | null => {
  try {
    let lat: number;
    let lng: number;

    // Convert latitude
    if (typeof backendCoord.Latitude === 'string') {
      lat = parseFloat(backendCoord.Latitude);
    } else {
      lat = backendCoord.Latitude;
    }

    // Convert longitude
    if (typeof backendCoord.Longitude === 'string') {
      lng = parseFloat(backendCoord.Longitude);
    } else {
      lng = backendCoord.Longitude;
    }

    // Strict validation - must be finite numbers
    if (!isFinite(lat) || !isFinite(lng)) {
      console.warn(
        'Invalid coordinate values after conversion:',
        { lat, lng },
        'from:',
        backendCoord,
      );
      return null;
    }

    return {
      latitude: lat,
      longitude: lng,
    };
  } catch (error) {
    console.warn('Error converting backend coordinate:', backendCoord, error);
    return null;
  }
};

/**
 * Converts array of BackendCoordinates to Coordinates.
 * Filters out any invalid conversions.
 */
const convertBackendCoordinatesToCoordinates = (
  backendCoords: BackendCoordinate[],
): Coordinate[] => {
  return backendCoords
    .map((backendCoord) => convertBackendCoordinateToCoordinate(backendCoord))
    .filter((coord): coord is Coordinate => coord !== null);
};

// ============================================================================
// TURF.JS HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if the tap is near an existing marker (within 10 meters).
 */
const isTapNearExistingMarker = (
  tapCoord: Coordinate,
  points: Coordinate[],
): boolean => {
  const TAP_TOLERANCE_METERS = 10;

  const tapLng =
    typeof tapCoord.longitude === 'string'
      ? parseFloat(tapCoord.longitude)
      : tapCoord.longitude;
  const tapLat =
    typeof tapCoord.latitude === 'string'
      ? parseFloat(tapCoord.latitude)
      : tapCoord.latitude;

  if (!isFinite(tapLng) || !isFinite(tapLat)) {
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

/**
 * Checks if a point is inside a polygon using Turf.js
 */
const isPointInPolygon = (
  point: Coordinate,
  polygon: Coordinate[],
): boolean => {
  try {
    const pointLng =
      typeof point.longitude === 'string'
        ? parseFloat(point.longitude)
        : point.longitude;
    const pointLat =
      typeof point.latitude === 'string'
        ? parseFloat(point.latitude)
        : point.latitude;

    // Close the polygon if needed
    let polygonCoords: Position[] = polygon.map((p) => [
      typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude,
      typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude,
    ]);

    if (
      polygonCoords.length > 0 &&
      (polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] ||
        polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1])
    ) {
      polygonCoords.push(polygonCoords[0]);
    }

    const turfPolygon = turf.polygon([polygonCoords]);
    const testPoint = turf.point([pointLng, pointLat]);

    return turf.booleanPointInPolygon(testPoint, turfPolygon);
  } catch (error) {
    console.warn('Error checking point in polygon:', error);
    return false;
  }
};

/**
 * Checks if two polygons overlap using Turf.js
 */
const doPolygonsOverlap = (
  poly1: Coordinate[],
  poly2: Coordinate[],
): boolean => {
  try {
    if (poly1.length < 3 || poly2.length < 3) return false;

    // Check if any point of poly2 is inside poly1
    for (const point of poly2) {
      if (isPointInPolygon(point, poly1)) {
        return true;
      }
    }

    // Check if any point of poly1 is inside poly2
    for (const point of poly1) {
      if (isPointInPolygon(point, poly2)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn('Error checking polygon overlap:', error);
    return false;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface Farm {
  Farm_ID: number;
  Soil_Type: string;
  Soil_Suitability: string;
  Hectares: string;
  Status: string;
  coordinates: BackendCoordinate[];
}

const FarmPlotCoordinates = () => {
  const navigation = useNavigation<FarmPlotCoordinatesProps['navigation']>();
  const route = useRoute<FarmPlotCoordinatesProps['route']>();

  const { userToken, signOut } = useAuth();
  const mapRef = useRef<MapView | null>(null);

  const areaId = route.params?.areaId;
  const farmId = route.params?.farmId;

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaData, setAreaData] = useState<AreaEntry | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);

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
                'Farm Shape Incomplete',
                'The farm plot must have at least 3 points.',
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

  const validateAndSnapCoordinate = (draggedCoord: Coordinate): Coordinate => {
    // Convert area coordinates to Coordinate format for validation
    let areaCoordinatesConverted: Coordinate[] = [];
    if (areaData?.coordinates && areaData.coordinates.length > 0) {
      areaCoordinatesConverted = convertBackendCoordinatesToCoordinates(
        areaData.coordinates,
      );
    }

    let finalCoord = draggedCoord;

    // Check if point is in area polygon, snap to boundary if outside
    if (
      areaCoordinatesConverted.length >= 3 &&
      !isPointInPolygon(draggedCoord, areaCoordinatesConverted)
    ) {
      // Find the closest boundary segment to snap to
      let closestSnapPoint: Coordinate | null = null;
      let closestDistance = Infinity;

      // Check each boundary segment
      for (let i = 0; i < areaCoordinatesConverted.length; i++) {
        const p1 = areaCoordinatesConverted[i];
        const p2 =
          areaCoordinatesConverted[(i + 1) % areaCoordinatesConverted.length];

        // Ensure valid coordinates
        const p1Lng =
          typeof p1.longitude === 'string'
            ? parseFloat(p1.longitude)
            : p1.longitude;
        const p1Lat =
          typeof p1.latitude === 'string'
            ? parseFloat(p1.latitude)
            : p1.latitude;
        const p2Lng =
          typeof p2.longitude === 'string'
            ? parseFloat(p2.longitude)
            : p2.longitude;
        const p2Lat =
          typeof p2.latitude === 'string'
            ? parseFloat(p2.latitude)
            : p2.latitude;

        if (
          !isFinite(p1Lng) ||
          !isFinite(p1Lat) ||
          !isFinite(p2Lng) ||
          !isFinite(p2Lat)
        ) {
          continue;
        }

        try {
          // Create boundary segment line
          const boundarySegment = turf.lineString([
            [p1Lng, p1Lat],
            [p2Lng, p2Lat],
          ]);

          // Find nearest point on this segment
          const dragPoint = turf.point([
            draggedCoord.longitude,
            draggedCoord.latitude,
          ]);
          const nearest = turf.nearestPointOnLine(boundarySegment, dragPoint);
          const distanceMeters = nearest.properties.dist * 1000; // Convert km to meters

          // Track closest segment
          if (distanceMeters < closestDistance) {
            closestDistance = distanceMeters;
            closestSnapPoint = {
              latitude: nearest.geometry.coordinates[1],
              longitude: nearest.geometry.coordinates[0],
            };
          }
        } catch (error) {
          console.warn(`Error snapping to boundary segment ${i}:`, error);
          continue;
        }
      }

      // Use the closest snapped point found
      if (closestSnapPoint) {
        finalCoord = closestSnapPoint;
      } else {
        console.warn(
          'Could not snap to boundary. Using original coordinate.',
          draggedCoord,
        );
      }
    }

    return finalCoord;
  };

  const handleMapPress = (event: any) => {
    const newCoord: Coordinate = event.nativeEvent.coordinate;

    // Convert area coordinates to Coordinate format for validation
    let areaCoordinatesConverted: Coordinate[] = [];
    if (areaData?.coordinates && areaData.coordinates.length > 0) {
      areaCoordinatesConverted = convertBackendCoordinatesToCoordinates(
        areaData.coordinates,
      );
    }

    let finalCoord = newCoord;

    // Check if point is in area polygon, snap to boundary if outside
    if (
      areaCoordinatesConverted.length >= 3 &&
      !isPointInPolygon(newCoord, areaCoordinatesConverted)
    ) {
      // Find the closest boundary segment to snap to
      let closestSnapPoint: Coordinate | null = null;
      let closestDistance = Infinity;

      // Check each boundary segment
      for (let i = 0; i < areaCoordinatesConverted.length; i++) {
        const p1 = areaCoordinatesConverted[i];
        const p2 =
          areaCoordinatesConverted[(i + 1) % areaCoordinatesConverted.length];

        // Ensure valid coordinates
        const p1Lng =
          typeof p1.longitude === 'string'
            ? parseFloat(p1.longitude)
            : p1.longitude;
        const p1Lat =
          typeof p1.latitude === 'string'
            ? parseFloat(p1.latitude)
            : p1.latitude;
        const p2Lng =
          typeof p2.longitude === 'string'
            ? parseFloat(p2.longitude)
            : p2.longitude;
        const p2Lat =
          typeof p2.latitude === 'string'
            ? parseFloat(p2.latitude)
            : p2.latitude;

        if (
          !isFinite(p1Lng) ||
          !isFinite(p1Lat) ||
          !isFinite(p2Lng) ||
          !isFinite(p2Lat)
        ) {
          continue;
        }

        try {
          // Create boundary segment line
          const boundarySegment = turf.lineString([
            [p1Lng, p1Lat],
            [p2Lng, p2Lat],
          ]);

          // Find nearest point on this segment
          const tapPoint = turf.point([newCoord.longitude, newCoord.latitude]);
          const nearest = turf.nearestPointOnLine(boundarySegment, tapPoint);
          const distanceMeters = nearest.properties.dist * 1000; // Convert km to meters

          // Track closest segment
          if (distanceMeters < closestDistance) {
            closestDistance = distanceMeters;
            closestSnapPoint = {
              latitude: nearest.geometry.coordinates[1],
              longitude: nearest.geometry.coordinates[0],
            };
          }
        } catch (error) {
          console.warn(`Error snapping to boundary segment ${i}:`, error);
          continue;
        }
      }

      // Use the closest snapped point found
      if (closestSnapPoint) {
        finalCoord = closestSnapPoint;
      } else {
        console.warn(
          'Could not snap to boundary. Using original coordinate.',
          newCoord,
        );
      }
    }

    // Check for overlap with existing farms
    for (const farm of farms) {
      if (farm.coordinates && farm.coordinates.length > 0) {
        const farmCoordinatesConverted = convertBackendCoordinatesToCoordinates(
          farm.coordinates,
        );

        if (
          farmCoordinatesConverted.length > 0 &&
          doPolygonsOverlap([finalCoord], farmCoordinatesConverted)
        ) {
          Alert.alert(
            'Overlaps with Farm',
            `This overlaps with an existing farm plot (${farm.Soil_Type || 'Unknown'}).`,
          );
          return;
        }
      }
    }

    // Conflict resolution: If tap is near a marker, let marker handler deal with it
    if (isTapNearExistingMarker(finalCoord, points)) {
      return;
    }

    // For first 2 points, append freely to start the polygon
    if (points.length < 2) {
      handleStateChange([...points, finalCoord]);
      return;
    }

    // For 2+ points, find the nearest segment and insert on it
    // This ensures the polygon grows properly without self-intersections
    if (points.length >= 2) {
      // Find the closest segment (without strict tolerance limit)
      let closestSegmentIndex = -1;
      let closestDistance = Infinity;

      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        const p1Lng =
          typeof p1.longitude === 'string'
            ? parseFloat(p1.longitude)
            : p1.longitude;
        const p1Lat =
          typeof p1.latitude === 'string'
            ? parseFloat(p1.latitude)
            : p1.latitude;
        const p2Lng =
          typeof p2.longitude === 'string'
            ? parseFloat(p2.longitude)
            : p2.longitude;
        const p2Lat =
          typeof p2.latitude === 'string'
            ? parseFloat(p2.latitude)
            : p2.latitude;

        if (
          !isFinite(p1Lng) ||
          !isFinite(p1Lat) ||
          !isFinite(p2Lng) ||
          !isFinite(p2Lat)
        ) {
          continue;
        }

        try {
          const segmentLine = turf.lineString([
            [p1Lng, p1Lat],
            [p2Lng, p2Lat],
          ]);
          const tapPoint = turf.point([
            finalCoord.longitude,
            finalCoord.latitude,
          ]);
          const nearest = turf.nearestPointOnLine(segmentLine, tapPoint);
          const distanceMeters = nearest.properties.dist * 1000;

          if (distanceMeters < closestDistance) {
            closestDistance = distanceMeters;
            closestSegmentIndex = i;
          }
        } catch (error) {
          console.warn(`Error finding closest segment ${i}:`, error);
          continue;
        }
      }

      // Insert the marker at the tapped location (finalCoord), not the snap point
      // This breaks the nearest segment and inserts the marker between its endpoints
      if (closestSegmentIndex !== -1) {
        insertPoint(finalCoord, closestSegmentIndex + 1);
        return;
      }
    }
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

  const fetchAreaAndFarms = useCallback(async () => {
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

      // Convert farm data
      const farmsList: Farm[] = (fetchedArea.farm || []).map((f: any) => ({
        Farm_ID: f.Farm_ID,
        Soil_Type: f.Soil_Type,
        Soil_Suitability: f.Soil_Suitability,
        Hectares: f.Hectares,
        Status: f.Status,
        coordinates: f.coordinates || [],
      }));

      setFarms(farmsList);

      // If editing existing farm, load its coordinates
      if (farmId && farmsList.length > 0) {
        const farmToEdit = farmsList.find((f) => f.Farm_ID === farmId);
        if (farmToEdit && farmToEdit.coordinates.length > 0) {
          const farmCoords: Coordinate[] =
            convertBackendCoordinatesToCoordinates(farmToEdit.coordinates);
          setPoints(farmCoords);
          setIsComplete(true);
        }
      }
    } catch (err: any) {
      const error = err as AxiosError;
      const apiErrorMessage = (error.response?.data as { message?: string })
        ?.message;
      setError(
        apiErrorMessage || 'Failed to load area details. Check network or API.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [areaId, userToken, signOut, farmId]);

  useEffect(() => {
    fetchAreaAndFarms();
  }, [fetchAreaAndFarms]);

  const handleMapReady = useCallback(() => {
    if (
      mapRef.current &&
      areaData?.coordinates &&
      areaData.coordinates.length > 0
    ) {
      const areaCoords: Coordinate[] = convertBackendCoordinatesToCoordinates(
        areaData.coordinates,
      );
      if (areaCoords.length > 0) {
        mapRef.current.fitToCoordinates(areaCoords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [areaData]);

  const hasUnsavedChanges = useMemo(() => {
    return undoStack.length > 0 || redoStack.length > 0;
  }, [undoStack.length, redoStack.length]);

  const handleConfirmUpdate = () => {
    if (points.length < 3) {
      Alert.alert(
        'Farm Plot Incomplete',
        'You must have at least 3 points to save the farm plot.',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'Confirm Farm Plot',
      'Are you sure you want to save this farm plot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save Farm Plot',
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
      Alert.alert('Invalid Farm Plot', 'Cannot save with fewer than 3 points.');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // If editing existing farm
      if (farmId) {
        await axios.put(
          `${API_URL}/area/${areaId}/farm/${farmId}`,
          { coordinates: points },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userToken}`,
            },
          },
        );
        Alert.alert('Success', 'Farm plot updated successfully!');
      } else {
        // Creating new farm - this endpoint may need to be created on backend
        await axios.post(
          `${API_URL}/area/${areaId}/farm`,
          { coordinates: points },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userToken}`,
            },
          },
        );
        Alert.alert('Success', 'Farm plot created successfully!');
      }

      setUndoStack([]);
      setRedoStack([]);
      navigation.goBack();
    } catch (err) {
      const error = err as AxiosError;
      const apiErrorMessage = (error.response?.data as { message?: string })
        ?.message;

      Alert.alert(
        'Save Failed',
        apiErrorMessage ||
          error.message ||
          'There was an issue saving your farm plot.',
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
          Loading farm plot data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={localStyles.centerContainer}>
        <Text style={localStyles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={fetchAreaAndFarms}
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

  if (!areaData) {
    return (
      <SafeAreaView style={localStyles.centerContainer}>
        <Text style={localStyles.errorText}>Area data not found.</Text>
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
            {farmId ? 'Edit Farm Plot' : 'New Farm Plot'}: {areaData.Area_Name}
          </Text>
        </View>
      </View>

      {/* --- INFO PANEL --- */}
      {farms.length > 0 && (
        <ScrollView
          style={localStyles.infoPanel}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {farms.map((farm) => (
            <View key={farm.Farm_ID} style={localStyles.farmCard}>
              <Text style={localStyles.farmCardTitle}>
                {farm.Soil_Type || 'Farm'}
              </Text>
              <Text style={localStyles.farmCardText}>
                Hectares: {farm.Hectares}
              </Text>
              <Text style={localStyles.farmCardText}>
                Status: {farm.Status}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* --- MAP VIEW --- */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        onMapReady={handleMapReady}
        onPress={handleMapPress}
        mapType="hybrid"
        initialRegion={
          areaData?.coordinates && areaData.coordinates.length > 0
            ? {
                latitude:
                  typeof areaData.coordinates[0].Latitude === 'string'
                    ? parseFloat(areaData.coordinates[0].Latitude)
                    : areaData.coordinates[0].Latitude,
                longitude:
                  typeof areaData.coordinates[0].Longitude === 'string'
                    ? parseFloat(areaData.coordinates[0].Longitude)
                    : areaData.coordinates[0].Longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : undefined
        }
      >
        {/* Area boundary (blue) */}
        {areaData?.coordinates && areaData.coordinates.length > 1 && (
          <Polyline
            coordinates={convertBackendCoordinatesToCoordinates(
              areaData.coordinates,
            )}
            strokeWidth={2}
            strokeColor="blue"
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Existing farms (orange) */}
        {farms.map((farm) => {
          const farmCoordinates = convertBackendCoordinatesToCoordinates(
            farm.coordinates,
          );
          return (
            <View key={`farm-${farm.Farm_ID}`}>
              {farmCoordinates.length > 1 && (
                <Polyline
                  coordinates={farmCoordinates}
                  strokeWidth={2}
                  strokeColor="orange"
                />
              )}
              {farmCoordinates.map((coord, idx) => (
                <Marker
                  key={`farm-marker-${farm.Farm_ID}-${idx}`}
                  coordinate={coord}
                  pinColor="orange"
                  title={`Farm: ${farm.Soil_Type}`}
                />
              ))}
            </View>
          );
        })}

        {/* Current farm plot (red) */}
        {points.map((point, index) => (
          <Marker
            draggable
            onDrag={(e) => updatePoint(index, e.nativeEvent.coordinate)}
            onDragEnd={(e) => {
              const validatedCoord = validateAndSnapCoordinate(
                e.nativeEvent.coordinate,
              );
              savePointToHistory(index, validatedCoord);
            }}
            key={`marker-${index}`}
            coordinate={point}
            onPress={() => handleMarkerPress(index)}
            pinColor={Platform.OS !== 'ios' ? 'red' : undefined}
          >
            {Platform.OS === 'ios' && (
              <View>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={30}
                  color="red"
                />
              </View>
            )}
          </Marker>
        ))}

        {points.length > 1 && (
          <Polyline coordinates={points} strokeWidth={3} strokeColor="red" />
        )}

        {/* Closing line */}
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

      {/* --- SAVE BUTTON --- */}
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
          <Text style={Styles.buttonText}>
            {farmId ? 'Save Farm Plot' : 'Create Farm Plot'}
          </Text>
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
    fontSize: 16,
    fontWeight: 'bold',
    color: Styles.text.color,
    textAlign: 'center',
  },
  infoPanel: {
    maxHeight: 120,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  farmCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 150,
  },
  farmCardTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 5,
    color: Styles.text.color,
  },
  farmCardText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
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
    bottom: 60,
    left: 20,
    right: 20,
    width: undefined,
    marginTop: 0,
    alignSelf: 'center',
    zIndex: 1,
  },
});

export default FarmPlotCoordinates;
