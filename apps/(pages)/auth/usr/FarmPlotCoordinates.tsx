import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput,
  PanResponder,
  Animated,
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
import FormDropdown from '../../../components/FormDropdown';
import { SoilTypeData } from '../../../../assets/data/SoilType';
import { SoilSuitabilityData } from '../../../../assets/data/SoilSuitability';
import type {
  FarmPlotCoordinatesProps,
  Coordinate,
  AreaEntry,
  BackendCoordinate,
} from '../../../navigation/types';
import {
  saveOfflineSubmission,
  isNetworkError,
} from '../../../utils/OfflineSubmissionManager';

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

/**
 * Checks if a polygon is completely within a boundary polygon
 * All vertices of the polygon must be inside the boundary
 */
const isPolygonWithinBoundary = (
  polygon: Coordinate[],
  boundary: Coordinate[],
): boolean => {
  try {
    if (polygon.length < 3 || boundary.length < 3) return false;

    // Check if all points of the polygon are inside the boundary
    for (const point of polygon) {
      if (!isPointInPolygon(point, boundary)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn('Error checking if polygon is within boundary:', error);
    return false;
  }
};

/**
 * Find which boundary segment of a polygon a point is closest to
 * Returns the segment index and the snapped coordinate on that boundary
 */
const findClosestBoundarySegment = (
  point: Coordinate,
  polygon: Coordinate[],
): { segmentIndex: number; snappedPoint: Coordinate } | null => {
  try {
    let closestSegmentIndex = -1;
    let closestSnappedPoint: Coordinate | null = null;
    let closestDistance = Infinity;

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];

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
        continue;
      }

      try {
        const boundarySegment = turf.lineString([
          [p1Lng, p1Lat],
          [p2Lng, p2Lat],
        ]);
        const dragPoint = turf.point([point.longitude, point.latitude]);
        const nearest = turf.nearestPointOnLine(boundarySegment, dragPoint);
        const distanceMeters = nearest.properties.dist * 1000;

        if (distanceMeters < closestDistance) {
          closestDistance = distanceMeters;
          closestSegmentIndex = i;
          closestSnappedPoint = {
            latitude: nearest.geometry.coordinates[1],
            longitude: nearest.geometry.coordinates[0],
          };
        }
      } catch (error) {
        console.warn(`Error finding closest segment ${i}:`, error);
        continue;
      }
    }

    if (closestSegmentIndex !== -1 && closestSnappedPoint) {
      return {
        segmentIndex: closestSegmentIndex,
        snappedPoint: closestSnappedPoint,
      };
    }

    return null;
  } catch (error) {
    console.warn('Error in findClosestBoundarySegment:', error);
    return null;
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

  // Modal and form state
  const [modalVisible, setModalVisible] = useState(false);
  const [soilType, setSoilType] = useState<string>('');
  const [soilSuitability, setSoilSuitability] = useState<string>('');
  const [hectares, setHectares] = useState<string>('0.00');

  // Farm details and edit mode state
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [farmDetailsVisible, setFarmDetailsVisible] = useState(false);
  const [isEditingCoordinates, setIsEditingCoordinates] = useState(false);
  const [editingFarmCoordinates, setEditingFarmCoordinates] = useState<
    Coordinate[]
  >([]);
  const [editingUndoStack, setEditingUndoStack] = useState<Coordinate[][]>([]);
  const [editingRedoStack, setEditingRedoStack] = useState<Coordinate[][]>([]);
  const [isEditingFarmData, setIsEditingFarmData] = useState(false);
  const [originalEditingCoordinates, setOriginalEditingCoordinates] = useState<
    Coordinate[]
  >([]);
  const [isInsertingCoordinates, setIsInsertingCoordinates] = useState(false);

  // New farm creation mode (distinct from edit mode)
  const [isCreatingNewFarmPlot, setIsCreatingNewFarmPlot] = useState(false);

  // Pan responder for draggable modal
  const panY = useRef(new Animated.Value(0)).current;
  const initialModalHeight = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (event, gestureState) => {
        if (
          gestureState.dy > initialModalHeight.current * 0.3 ||
          gestureState.vy > 0.5
        ) {
          Animated.timing(panY, {
            toValue: initialModalHeight.current,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setModalVisible(false);
            panY.setValue(0);
          });
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

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

  /**
   * Update editing farm coordinates with undo/redo history
   */
  const handleEditingStateChange = (newCoords: Coordinate[]) => {
    setEditingUndoStack((prev) => [editingFarmCoordinates, ...prev]);
    setEditingRedoStack([]);
    setEditingFarmCoordinates(newCoords);
  };

  /**
   * Undo the last change in editing farm coordinates
   */
  const undoEditingPoint = () => {
    if (editingUndoStack.length === 0) return;
    const previousCoords = editingUndoStack[0];
    setEditingRedoStack((prev) => [editingFarmCoordinates, ...prev]);
    setEditingUndoStack((prev) => prev.slice(1));
    setEditingFarmCoordinates(previousCoords);
  };

  /**
   * Redo the last change in editing farm coordinates
   */
  const redoEditingPoint = () => {
    if (editingRedoStack.length === 0) return;
    const nextCoords = editingRedoStack[0];
    setEditingUndoStack((prev) => [editingFarmCoordinates, ...prev]);
    setEditingRedoStack((prev) => prev.slice(1));
    setEditingFarmCoordinates(nextCoords);
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

  /**
   * Insert point into editing farm coordinates with proper segment insertion
   * Used for inserting markers when editing existing farm coordinates
   */
  const insertEditingFarmPoint = (
    newCoord: Coordinate,
    insertionIndex: number,
  ) => {
    const newCoordinates = [
      ...editingFarmCoordinates.slice(0, insertionIndex),
      newCoord,
      ...editingFarmCoordinates.slice(insertionIndex),
    ];
    handleEditingStateChange(newCoordinates);
  };

  /**
   * Calculate hectares from polygon area using Turf.js
   * Returns area in hectares with 2 decimal places
   */
  const calculateHectares = useCallback((coords: Coordinate[]): string => {
    if (coords.length < 3) return '0.00';

    try {
      // Convert to turf polygon format
      let polygonCoords: Position[] = coords.map((p) => [
        typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude,
        typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude,
      ]);

      // Close the polygon
      if (
        polygonCoords.length > 0 &&
        (polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] ||
          polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1])
      ) {
        polygonCoords.push(polygonCoords[0]);
      }

      const polygon = turf.polygon([polygonCoords]);
      const areaSquareMeters = turf.area(polygon); // Returns area in square meters
      const areaHectares = areaSquareMeters / 10000; // Convert to hectares

      return areaHectares.toFixed(2);
    } catch (error) {
      console.warn('Error calculating hectares:', error);
      return '0.00';
    }
  }, []);

  // Update hectares when points change
  useEffect(() => {
    if (points.length >= 3) {
      const newHectares = calculateHectares(points);
      setHectares(newHectares);
    } else {
      setHectares('0.00');
    }
  }, [points, calculateHectares]);

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

  /**
   * Check which farm polygon was tapped
   * Returns the Farm_ID if a tap is inside a farm polygon, null otherwise
   */
  const getFarmAtTapPoint = (tapCoord: Coordinate): number | null => {
    for (const farm of farms) {
      if (farm.coordinates && farm.coordinates.length >= 3) {
        const farmCoordinates = convertBackendCoordinatesToCoordinates(
          farm.coordinates,
        );
        if (
          farmCoordinates.length >= 3 &&
          isPointInPolygon(tapCoord, farmCoordinates)
        ) {
          return farm.Farm_ID;
        }
      }
    }
    return null;
  };

  /**
   * Open farm details when user taps inside a farm polygon
   */
  const handleFarmTap = (farmId: number) => {
    const farm = farms.find((f) => f.Farm_ID === farmId);
    if (farm) {
      setSelectedFarmId(farmId);
      setSoilType(farm.Soil_Type);
      setSoilSuitability(farm.Soil_Suitability);
      setHectares(farm.Hectares);
      const farmCoordinates = convertBackendCoordinatesToCoordinates(
        farm.coordinates,
      );
      setEditingFarmCoordinates(farmCoordinates);
      setFarmDetailsVisible(true);
    }
  };

  const handleMapPress = (event: any) => {
    const newCoord: Coordinate = event.nativeEvent.coordinate;

    // If in coordinate editing mode AND inserting mode, add/move markers
    if (isEditingCoordinates && selectedFarmId && isInsertingCoordinates) {
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
            const tapPoint = turf.point([
              newCoord.longitude,
              newCoord.latitude,
            ]);
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

      // Check for overlap with existing farms (excluding the one being edited)
      for (const farm of farms) {
        if (farm.Farm_ID === selectedFarmId) {
          continue; // Skip the farm being edited
        }

        if (farm.coordinates && farm.coordinates.length > 0) {
          const farmCoordinatesConverted =
            convertBackendCoordinatesToCoordinates(farm.coordinates);

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

      // For first 2 points, append freely to start the polygon
      if (editingFarmCoordinates.length < 2) {
        setEditingFarmCoordinates([...editingFarmCoordinates, finalCoord]);
        return;
      }

      // For 2+ points, find the nearest segment and insert on it
      // This ensures the polygon grows properly without self-intersections
      if (editingFarmCoordinates.length >= 2) {
        // Find the closest segment (without strict tolerance limit)
        let closestSegmentIndex = -1;
        let closestDistance = Infinity;

        for (let i = 0; i < editingFarmCoordinates.length; i++) {
          const p1 = editingFarmCoordinates[i];
          const p2 =
            editingFarmCoordinates[(i + 1) % editingFarmCoordinates.length];

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
          insertEditingFarmPoint(finalCoord, closestSegmentIndex + 1);
          return;
        }
      }

      return;
    }

    // Check if tap is inside any farm polygon (only if not editing and not creating new)
    if (
      !isEditingCoordinates &&
      !isCreatingNewFarmPlot &&
      !isInsertingCoordinates
    ) {
      const tappedFarmId = getFarmAtTapPoint(newCoord);
      if (tappedFarmId) {
        handleFarmTap(tappedFarmId);
        return;
      }
    }

    // Normal farm creation logic (only when explicitly enabled via button)
    if (
      isCreatingNewFarmPlot &&
      !isEditingCoordinates &&
      !selectedFarmId &&
      !isInsertingCoordinates
    ) {
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
            const tapPoint = turf.point([
              newCoord.longitude,
              newCoord.latitude,
            ]);
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
          const farmCoordinatesConverted =
            convertBackendCoordinatesToCoordinates(farm.coordinates);

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
    if (!isCreatingNewFarmPlot && !farmId) {
      Alert.alert(
        'Not in Creation Mode',
        'Please click the "New Farm Plot" button to create a new farm.',
        [{ text: 'OK' }],
      );
      return;
    }

    if (points.length < 3) {
      Alert.alert(
        'Farm Plot Incomplete',
        'You must have at least 3 points to save the farm plot.',
        [{ text: 'OK' }],
      );
      return;
    }

    // Open modal to collect farm details
    setModalVisible(true);
  };

  const handleSubmitUpdate = async () => {
    if (isUpdating || !areaId || !userToken) return;

    if (points.length < 3) {
      Alert.alert('Invalid Farm Plot', 'Cannot save with fewer than 3 points.');
      return;
    }

    if (!soilType) {
      Alert.alert('Missing Field', 'Please select a soil type.');
      return;
    }

    if (!soilSuitability) {
      Alert.alert('Missing Field', 'Please select soil suitability.');
      return;
    }

    // Validate polygon is within area boundary
    if (areaData?.coordinates && areaData.coordinates.length > 0) {
      const areaCoordinatesConverted = convertBackendCoordinatesToCoordinates(
        areaData.coordinates,
      );
      if (
        areaCoordinatesConverted.length >= 3 &&
        points.length >= 3 &&
        !isPolygonWithinBoundary(points, areaCoordinatesConverted)
      ) {
        Alert.alert(
          'Farm Plot Outside Area',
          'The farm plot boundary exceeds the land claim area. Please adjust the markers so the entire farm stays within the land claim area.',
        );
        return;
      }
    }

    setIsUpdating(true);
    setError(null);

    try {
      // If editing existing farm, use separate routes for coordinates and data
      if (farmId) {
        // First update coordinates (this is independent)
        await axios.put(
          `${API_URL}/area/${areaId}/farm/${farmId}/coordinates`,
          { coordinates: points },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userToken}`,
            },
            timeout: 10000,
          },
        );

        // Then update farm data (soil type, suitability, status, hectares)
        await axios.put(
          `${API_URL}/area/${areaId}/farm/${farmId}/data`,
          {
            Soil_Type: soilType,
            Soil_Suitability: soilSuitability,
            Hectares: hectares,
            Status: 'Inactive',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userToken}`,
            },
            timeout: 10000,
          },
        );

        Alert.alert('Success', 'Farm plot updated successfully!');
      } else {
        // Creating new farm
        const farmData = {
          coordinates: points,
          Soil_Type: soilType,
          Soil_Suitability: soilSuitability,
          Hectares: hectares,
          Status: 'Inactive',
        };

        await axios.post(`${API_URL}/area/${areaId}/farm`, farmData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          timeout: 10000,
        });
        Alert.alert('Success', 'Farm plot created successfully!');
      }

      setUndoStack([]);
      setRedoStack([]);
      setIsCreatingNewFarmPlot(false);
      navigation.goBack();
    } catch (err) {
      const error = err as AxiosError;
      const apiErrorMessage = (error.response?.data as { message?: string })
        ?.message;

      // Check if this is a network error (offline scenario)
      if (isNetworkError(error)) {
        const endpoint = farmId
          ? `/area/${areaId}/farm/${farmId}`
          : `/area/${areaId}/farm`;
        const method = farmId ? 'PUT' : 'POST';

        try {
          // Save the farm data for offline sync
          await saveOfflineSubmission('farm', endpoint, method, {
            coordinates: points,
            Soil_Type: soilType,
            Soil_Suitability: soilSuitability,
            Hectares: hectares,
            Status: 'Inactive',
          });

          Alert.alert(
            'Offline Mode',
            'You are currently offline. Your farm plot data has been saved locally and will be submitted automatically when your connection is restored.',
            [{ text: 'OK' }],
          );

          // Clear the form and go back
          setUndoStack([]);
          setRedoStack([]);
          setIsCreatingNewFarmPlot(false);
          navigation.goBack();
        } catch (offlineError) {
          console.error('Failed to save farm offline:', offlineError);
          Alert.alert(
            'Error',
            'Could not save your farm plot offline. Please check your storage.',
          );
        }
      } else {
        // Handle other types of errors
        Alert.alert(
          'Save Failed',
          apiErrorMessage ||
            error.message ||
            'There was an issue saving your farm plot.',
        );
      }
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
          />
        )}

        {/* Existing farms (orange) */}
        {farms.map((farm) => {
          const farmCoordinates = convertBackendCoordinatesToCoordinates(
            farm.coordinates,
          );
          const isSelectedFarm = selectedFarmId === farm.Farm_ID;
          const isEditingThisFarm =
            isEditingCoordinates && selectedFarmId === farm.Farm_ID;
          const coordsToDisplay = isEditingThisFarm
            ? editingFarmCoordinates
            : farmCoordinates;
          const polylineColor = isEditingThisFarm
            ? 'yellow'
            : isSelectedFarm
              ? 'red'
              : 'orange';
          const markerColor = isEditingThisFarm
            ? 'yellow'
            : isSelectedFarm
              ? 'red'
              : 'orange';

          return (
            <View key={`farm-${farm.Farm_ID}`}>
              {coordsToDisplay.length > 1 && (
                <Polyline
                  coordinates={coordsToDisplay}
                  strokeWidth={isEditingThisFarm ? 4 : 2}
                  strokeColor={polylineColor}
                />
              )}
              {coordsToDisplay.length >= 3 && (
                <Polyline
                  coordinates={[
                    coordsToDisplay[coordsToDisplay.length - 1],
                    coordsToDisplay[0],
                  ]}
                  strokeWidth={isEditingThisFarm ? 4 : 2}
                  strokeColor={polylineColor}
                />
              )}
              {coordsToDisplay.map((coord, idx) => (
                <Marker
                  key={`farm-marker-${farm.Farm_ID}-${idx}`}
                  coordinate={coord}
                  pinColor={Platform.OS !== 'ios' ? markerColor : undefined}
                  title={`Farm: ${farm.Soil_Type}`}
                  draggable={isEditingThisFarm}
                  onDrag={
                    isEditingThisFarm
                      ? (e) => {
                          let draggedCoord = e.nativeEvent.coordinate;

                          // Get area boundary for validation
                          let areaCoordinatesConverted: Coordinate[] = [];
                          if (
                            areaData?.coordinates &&
                            areaData.coordinates.length > 0
                          ) {
                            areaCoordinatesConverted =
                              convertBackendCoordinatesToCoordinates(
                                areaData.coordinates,
                              );
                          }

                          // If outside area boundary, snap to it
                          if (
                            areaCoordinatesConverted.length >= 3 &&
                            !isPointInPolygon(
                              draggedCoord,
                              areaCoordinatesConverted,
                            )
                          ) {
                            const boundaryInfo = findClosestBoundarySegment(
                              draggedCoord,
                              areaCoordinatesConverted,
                            );
                            if (boundaryInfo) {
                              draggedCoord = boundaryInfo.snappedPoint;
                            }
                          }

                          let finalCoords = editingFarmCoordinates.map(
                            (c, i) => (i === idx ? draggedCoord : c),
                          );

                          // Check for overlaps with other farms and snap to their boundary
                          for (const otherFarm of farms) {
                            if (
                              otherFarm.Farm_ID !== selectedFarmId &&
                              otherFarm.coordinates
                            ) {
                              const otherFarmCoords =
                                convertBackendCoordinatesToCoordinates(
                                  otherFarm.coordinates,
                                );

                              // If the dragged marker is inside another farm's polygon
                              if (
                                otherFarmCoords.length >= 3 &&
                                isPointInPolygon(draggedCoord, otherFarmCoords)
                              ) {
                                // Find the nearest boundary segment of the other farm
                                const boundaryInfo = findClosestBoundarySegment(
                                  draggedCoord,
                                  otherFarmCoords,
                                );

                                if (boundaryInfo) {
                                  // Snap the dragged marker to the boundary
                                  finalCoords = finalCoords.map((c, i) =>
                                    i === idx ? boundaryInfo.snappedPoint : c,
                                  );
                                }
                              }
                            }
                          }

                          handleEditingStateChange(finalCoords);
                        }
                      : undefined
                  }
                >
                  {Platform.OS === 'ios' && (
                    <View>
                      <MaterialCommunityIcons
                        name="map-marker"
                        size={isEditingThisFarm ? 40 : 30}
                        color={markerColor}
                      />
                    </View>
                  )}
                </Marker>
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
          />
        )}
      </MapView>

      {/* --- FLOATING CONTROLS --- */}
      <View style={localStyles.floatingControlsContainer}>
        {!isEditingCoordinates && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setIsCreatingNewFarmPlot(!isCreatingNewFarmPlot)}
              style={[
                localStyles.actionButton,
                {
                  backgroundColor: isCreatingNewFarmPlot
                    ? '#d9534f'
                    : '#28a745',
                  marginRight: 10,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={30}
                color={isCreatingNewFarmPlot ? 'white' : 'white'}
              />
            </TouchableOpacity>

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
        )}

        {isEditingCoordinates && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setIsInsertingCoordinates(!isInsertingCoordinates)}
              style={[
                localStyles.actionButton,
                {
                  backgroundColor: isInsertingCoordinates
                    ? '#28a745'
                    : '#6c757d',
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 10,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={isInsertingCoordinates ? 'check-circle' : 'plus-circle'}
                size={28}
                color="white"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={undoEditingPoint}
              disabled={editingUndoStack.length === 0}
              style={[
                localStyles.actionButton,
                {
                  backgroundColor:
                    editingUndoStack.length > 0
                      ? Styles.button.backgroundColor
                      : Styles.inputFields.backgroundColor,
                  marginRight: 10,
                },
              ]}
            >
              <EvilIcons
                name="undo"
                size={30}
                color={editingUndoStack.length > 0 ? 'black' : 'grey'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={redoEditingPoint}
              disabled={editingRedoStack.length === 0}
              style={[
                localStyles.actionButton,
                {
                  backgroundColor:
                    editingRedoStack.length > 0
                      ? Styles.button.backgroundColor
                      : Styles.inputFields.backgroundColor,
                },
              ]}
            >
              <EvilIcons
                name="redo"
                size={30}
                color={editingRedoStack.length > 0 ? 'black' : 'grey'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* --- FARM DETAILS MODAL --- */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Animated.View
              style={[
                Styles.formBox,
                {
                  width: '100%',
                  minHeight: '60%',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingHorizontal: 20,
                  paddingVertical: 20,
                  transform: [{ translateY: panY }],
                },
              ]}
              onLayout={(event) => {
                if (initialModalHeight.current === 0) {
                  initialModalHeight.current = event.nativeEvent.layout.height;
                }
              }}
            >
              {/* Draggable indicator/header */}
              <View
                style={localStyles.modalHandle}
                {...panResponder.panHandlers}
              >
                <View style={localStyles.modalHandleBar} />
              </View>

              {/* Title Header */}
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Farm Details</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={localStyles.closeButton}
                >
                  <Ionicons
                    name="chevron-down"
                    size={28}
                    color={Styles.buttonText.color}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={localStyles.formContainer}
              >
                {/* Hectares Display */}
                <View style={localStyles.formGroup}>
                  <Text style={localStyles.label}>Hectares</Text>
                  <TextInput
                    style={[
                      Styles.inputFields,
                      { marginBottom: 15, width: '100%' },
                    ]}
                    value={`${hectares} ha`}
                    editable={false}
                    placeholderTextColor="#8b8b8bff"
                  />
                </View>

                {/* Soil Type Dropdown */}
                <View style={localStyles.formGroup}>
                  <Text style={localStyles.label}>Soil Type</Text>
                  <FormDropdown
                    data={SoilTypeData}
                    value={soilType}
                    onValueChange={setSoilType}
                    placeholder="Select soil type"
                  />
                </View>

                {/* Soil Suitability Dropdown */}
                <View style={localStyles.formGroup}>
                  <Text style={localStyles.label}>Soil Suitability</Text>
                  <FormDropdown
                    data={SoilSuitabilityData}
                    value={soilSuitability}
                    onValueChange={setSoilSuitability}
                    placeholder="Select suitability"
                  />
                </View>
              </ScrollView>

              {/* Modal Buttons */}
              <View style={localStyles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    Styles.button,
                    localStyles.submitButton,
                    {
                      opacity:
                        soilType && soilSuitability && !isUpdating ? 1 : 0.5,
                    },
                  ]}
                  onPress={handleSubmitUpdate}
                  disabled={!soilType || !soilSuitability || isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator color={Styles.buttonText.color} />
                  ) : (
                    <Text style={Styles.buttonText}>
                      {farmId ? 'Update Farm' : 'Create Farm'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={localStyles.cancelButton}
                  onPress={() => setModalVisible(false)}
                  disabled={isUpdating}
                >
                  <Text style={localStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* --- FARM DETAILS MODAL --- */}
      <Modal
        visible={farmDetailsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setFarmDetailsVisible(false);
          setIsEditingCoordinates(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Animated.View
              style={[
                Styles.formBox,
                {
                  width: '100%',
                  minHeight: '50%',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingHorizontal: 20,
                  paddingVertical: 20,
                  transform: [{ translateY: panY }],
                },
              ]}
            >
              {/* Title Header */}
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Farm Details</Text>
                <TouchableOpacity
                  onPress={() => {
                    setFarmDetailsVisible(false);
                    setIsEditingCoordinates(false);
                  }}
                  style={localStyles.closeButton}
                >
                  <Ionicons
                    name="chevron-down"
                    size={28}
                    color={Styles.buttonText.color}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={localStyles.formContainer}
              >
                {/* Soil Type Display */}
                <View style={localStyles.detailGroup}>
                  <Text style={localStyles.detailLabel}>Soil Type</Text>
                  <Text style={localStyles.detailValue}>{soilType}</Text>
                </View>

                {/* Soil Suitability Display */}
                <View style={localStyles.detailGroup}>
                  <Text style={localStyles.detailLabel}>Soil Suitability</Text>
                  <Text style={localStyles.detailValue}>{soilSuitability}</Text>
                </View>

                {/* Hectares Display */}
                <View style={localStyles.detailGroup}>
                  <Text style={localStyles.detailLabel}>Hectares</Text>
                  <Text style={localStyles.detailValue}>{hectares} ha</Text>
                </View>

                {/* Edit Status Alert */}
                {isEditingCoordinates && (
                  <View
                    style={[
                      localStyles.detailGroup,
                      {
                        backgroundColor: isInsertingCoordinates
                          ? '#d4edda'
                          : '#fff3cd',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isInsertingCoordinates
                          ? '#28a745'
                          : '#ffc107',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isInsertingCoordinates ? '#155724' : '#856404',
                        fontWeight: '600',
                        fontSize: 14,
                      }}
                    >
                      {isInsertingCoordinates
                        ? '✓ Insert Mode Active: Tap on the map to add coordinates'
                        : '📍 View Mode: Enable insert mode to add coordinates'}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Modal Buttons */}
              <View style={localStyles.buttonContainer}>
                {!isEditingCoordinates ? (
                  <>
                    <TouchableOpacity
                      style={[Styles.button, localStyles.submitButton]}
                      onPress={() => {
                        setOriginalEditingCoordinates([
                          ...editingFarmCoordinates,
                        ]);
                        setIsEditingCoordinates(true);
                        setIsInsertingCoordinates(false);
                        setEditingUndoStack([]);
                        setEditingRedoStack([]);
                        setFarmDetailsVisible(false);
                      }}
                    >
                      <Text style={Styles.buttonText}>Edit Coordinates</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[Styles.button, localStyles.submitButton]}
                      onPress={() => {
                        setFarmDetailsVisible(false);
                        setIsEditingFarmData(true);
                      }}
                    >
                      <Text style={Styles.buttonText}>Edit Farm Data</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={localStyles.cancelButton}
                      onPress={() => {
                        setFarmDetailsVisible(false);
                        setSelectedFarmId(null);
                      }}
                    >
                      <Text style={localStyles.cancelButtonText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={localStyles.cancelButton}
                      onPress={() => {
                        setIsEditingCoordinates(false);
                        setIsInsertingCoordinates(false);
                        setEditingFarmCoordinates([
                          ...originalEditingCoordinates,
                        ]);
                        setEditingUndoStack([]);
                        setEditingRedoStack([]);
                        setSelectedFarmId(null);
                      }}
                    >
                      <Text style={localStyles.cancelButtonText}>
                        Close Edit
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* --- EDIT FARM DATA MODAL --- */}
      <Modal
        visible={isEditingFarmData}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditingFarmData(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Animated.View
              style={[
                Styles.formBox,
                {
                  width: '100%',
                  minHeight: '70%',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingHorizontal: 20,
                  paddingVertical: 20,
                  transform: [{ translateY: panY }],
                },
              ]}
            >
              {/* Title Header */}
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Edit Farm Data</Text>
                <TouchableOpacity
                  onPress={() => setIsEditingFarmData(false)}
                  style={localStyles.closeButton}
                >
                  <Ionicons
                    name="chevron-down"
                    size={28}
                    color={Styles.buttonText.color}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={localStyles.formContainer}
              >
                {/* Soil Type Dropdown */}
                <View style={localStyles.formGroup}>
                  <Text style={localStyles.label}>Soil Type</Text>
                  <FormDropdown
                    data={SoilTypeData}
                    value={soilType}
                    onValueChange={setSoilType}
                    placeholder="Select soil type"
                  />
                </View>

                {/* Soil Suitability Dropdown */}
                <View style={localStyles.formGroup}>
                  <Text style={localStyles.label}>Soil Suitability</Text>
                  <FormDropdown
                    data={SoilSuitabilityData}
                    value={soilSuitability}
                    onValueChange={setSoilSuitability}
                    placeholder="Select suitability"
                  />
                </View>

                {/* Hectares Display */}
                <View style={localStyles.formGroup}>
                  <Text style={localStyles.label}>Hectares</Text>
                  <TextInput
                    style={[
                      Styles.inputFields,
                      { marginBottom: 15, width: '100%' },
                    ]}
                    value={`${hectares} ha`}
                    editable={false}
                    placeholderTextColor="#8b8b8bff"
                  />
                </View>
              </ScrollView>

              {/* Modal Buttons */}
              <View style={localStyles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    Styles.button,
                    localStyles.submitButton,
                    {
                      opacity:
                        soilType && soilSuitability && !isUpdating ? 1 : 0.5,
                    },
                  ]}
                  onPress={async () => {
                    if (!selectedFarmId || !soilType || !soilSuitability) {
                      Alert.alert(
                        'Missing Fields',
                        'Please fill in all required fields.',
                      );
                      return;
                    }

                    try {
                      setIsUpdating(true);
                      await axios.put(
                        `${API_URL}/area/${areaId}/farm/${selectedFarmId}/data`,
                        {
                          Soil_Type: soilType,
                          Soil_Suitability: soilSuitability,
                          Hectares: hectares,
                          Status: 'Inactive',
                        },
                        {
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${userToken}`,
                          },
                          timeout: 10000,
                        },
                      );

                      // Refresh farms list
                      await fetchAreaAndFarms();
                      setIsEditingFarmData(false);
                      setFarmDetailsVisible(false);
                      setSelectedFarmId(null);
                      Alert.alert('Success', 'Farm data updated!');
                    } catch (err) {
                      const error = err as AxiosError;
                      const apiErrorMessage = (
                        error.response?.data as { message?: string }
                      )?.message;
                      Alert.alert(
                        'Error',
                        apiErrorMessage || 'Failed to update farm data',
                      );
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  disabled={!soilType || !soilSuitability || isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator color={Styles.buttonText.color} />
                  ) : (
                    <Text style={Styles.buttonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={localStyles.cancelButton}
                  onPress={() => setIsEditingFarmData(false)}
                  disabled={isUpdating}
                >
                  <Text style={localStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* --- SAVE BUTTON --- */}
      {!isEditingCoordinates ? (
        <TouchableOpacity
          style={[
            Styles.button,
            localStyles.updateButton,
            {
              opacity: points.length >= 3 && !isUpdating ? 1 : 0.5,
            },
          ]}
          onPress={handleConfirmUpdate}
          disabled={points.length < 3 || isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator color={Styles.buttonText.color} />
          ) : (
            <Text style={Styles.buttonText}>
              {farmId ? 'Edit Farm Plot' : 'Save Farm Plot'}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={localStyles.bottomButtonsContainer}>
          <TouchableOpacity
            style={[Styles.button, localStyles.bottomButton]}
            onPress={async () => {
              if (!selectedFarmId || editingFarmCoordinates.length < 3) {
                Alert.alert('Invalid', 'Must have at least 3 coordinates');
                return;
              }

              try {
                setIsUpdating(true);
                await axios.put(
                  `${API_URL}/area/${areaId}/farm/${selectedFarmId}/coordinates`,
                  { coordinates: editingFarmCoordinates },
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${userToken}`,
                    },
                    timeout: 10000,
                  },
                );

                // Refresh farms list
                await fetchAreaAndFarms();
                setFarmDetailsVisible(false);
                setIsEditingCoordinates(false);
                setIsInsertingCoordinates(false);
                setEditingUndoStack([]);
                setEditingRedoStack([]);
                setSelectedFarmId(null);
                Alert.alert('Success', 'Farm coordinates updated!');
              } catch (err) {
                const error = err as AxiosError;
                const apiErrorMessage = (
                  error.response?.data as { message?: string }
                )?.message;
                Alert.alert(
                  'Error',
                  apiErrorMessage || 'Failed to update coordinates',
                );
              } finally {
                setIsUpdating(false);
              }
            }}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color={Styles.buttonText.color} />
            ) : (
              <Text style={Styles.buttonText}>Save Coordinates</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.bottomCancelButton}
            onPress={() => {
              setIsEditingCoordinates(false);
              setIsInsertingCoordinates(false);
              setEditingFarmCoordinates([...originalEditingCoordinates]);
              setEditingUndoStack([]);
              setEditingRedoStack([]);
              setSelectedFarmId(null);
            }}
            disabled={isUpdating}
          >
            <Text style={localStyles.cancelButtonText}>Cancel Edit</Text>
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: 18,
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
    left: 10,
    zIndex: 1,
    paddingTop: 10,
    paddingRight: 10,
    paddingLeft: 10,
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
  bottomButtonsContainer: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    gap: 10,
    zIndex: 1,
  },
  bottomButton: {
    marginTop: 0,
    width: '100%',
  },
  bottomCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F4D03F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#3D550C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4D03F',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    padding: 5,
  },
  formContainer: {
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 18,
  },
  detailGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F4D03F',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F4D03F',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 16,
    color: Styles.text.color,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#555',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F4D03F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F4D03F',
  },
  submitButton: {
    marginTop: 0,
    width: '100%',
  },
  modalHandle: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#ccc',
  },
});

export default FarmPlotCoordinates;
