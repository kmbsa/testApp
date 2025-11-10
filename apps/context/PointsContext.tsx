import React, {
  createContext,
  useState,
  useContext,
  useMemo,
  useCallback,
} from 'react';
import type { Coordinate } from '../navigation/types';

interface PointsContextType {
  points: Coordinate[];
  redoStack: Coordinate[];
  isComplete: boolean;
  province: string | null;
  region: string | null;
  addPoint: (point: Coordinate) => void;
  insertPoint: (point: Coordinate, index: number) => void;
  updatePoint: (index: number, newPoint: Coordinate) => void;
  resetPoints: () => void;
  undoPoint: () => void;
  redoPoint: () => void;
  setIsComplete: (
    complete: boolean,
    province?: string,
    region?: string,
  ) => void;
  closePolygon: () => void;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const usePointsContext = () => {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePointsContext must be used within a PointsProvider');
  }
  return context;
};

export const isCoordinateInArray = (
  coordinate: { latitude: number; longitude: number },
  array: { latitude: number; longitude: number }[],
  epsilon = 0.00001,
): boolean => {
  return array.some(
    (point) =>
      Math.abs(point.latitude - coordinate.latitude) < epsilon &&
      Math.abs(point.longitude - coordinate.longitude) < epsilon,
  );
};

export const findClosestSegmentForInsertion = (
  touchCoord: Coordinate,
  points: Coordinate[],
  maxDistance: number = 0.0001,
): { insertionIndex: number; distance: number } | null => {
  if (points.length < 2) return null;

  let closestDistance = Infinity;
  let insertionIndex = -1;

  // Iterate through all line segments
  // We stop at points.length - 1 because the segment is points[i] to points[i+1]
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Simplified planar distance calculation (works well for small distances)
    const dx = p2.longitude - p1.longitude;
    const dy = p2.latitude - p1.latitude;
    const sqrLen = dx * dx + dy * dy;

    if (sqrLen === 0) continue; // Skip identical points

    // Calculate t (projection parameter)
    let t =
      ((touchCoord.longitude - p1.longitude) * dx +
        (touchCoord.latitude - p1.latitude) * dy) /
      sqrLen;

    // Clamp t to [0, 1] to ensure the closest point is on the segment (not beyond the endpoints)
    t = Math.max(0, Math.min(1, t));

    // Closest point coordinates on the segment
    const closestLng = p1.longitude + t * dx;
    const closestLat = p1.latitude + t * dy;

    // Euclidean distance from tapped point to the closest point on the segment
    const dLng = touchCoord.longitude - closestLng;
    const dLat = touchCoord.latitude - closestLat;
    const currentDistance = Math.sqrt(dLng * dLng + dLat * dLat);

    if (currentDistance < closestDistance) {
      closestDistance = currentDistance;
      insertionIndex = i + 1; // Insert AFTER point 'i' (i.e., before point 'i+1')
    }
  }

  if (closestDistance < maxDistance) {
    return { insertionIndex, distance: closestDistance };
  }

  return null;
};

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [points, setPoints] = useState<Coordinate[]>([]);
  const [redoStack, setRedoStack] = useState<Coordinate[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const [province, setProvince] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  const addPoint = useCallback((point: Coordinate) => {
    console.log('>>> Context: addPoint called with point:', point);
    setPoints((prevPoints) => {
      console.log(
        '>>> Context: addPoint updater: Previous points state:',
        prevPoints,
      );

      const isCoordinateDuplicate = prevPoints.some(
        (existingPoint) =>
          Math.abs(existingPoint.latitude - point.latitude) < 0.00001 &&
          Math.abs(existingPoint.longitude - point.longitude) < 0.00001,
      );

      if (isCoordinateDuplicate) {
        console.log(
          '>>> Context: Skipping adding point due to coordinate duplicate.',
          point,
        );
        return prevPoints;
      }

      console.log('>>> Context: Adding point with unique coordinate.', point);
      setIsComplete(false);
      const newState = [...prevPoints, point];
      console.log(
        '>>> Context: addPoint updater: New state after adding:',
        newState,
      );
      return newState;
    });
    setRedoStack([]);
  }, []);

  const resetPoints = useCallback(() => {
    console.log('>>> Context: Resetting all points.');
    setPoints([]);
    setRedoStack([]);
    setIsComplete(false);
  }, []);

  const undoPoint = useCallback(() => {
    setPoints((prevPoints) => {
      if (prevPoints.length > 0) {
        const newPoints = [...prevPoints];
        const lastPoint = newPoints.pop();
        if (lastPoint) {
          setRedoStack((prevRedo) => [...prevRedo, lastPoint]);
        }
        console.log(
          '>>> Context: Undoing last point. New points count:',
          newPoints.length,
        );
        if (prevPoints.length > 1 && newPoints.length > 0) {
          const firstPoint = newPoints[0];
          if (
            lastPoint &&
            Math.abs(lastPoint.latitude - firstPoint.latitude) < 0.00001 &&
            Math.abs(lastPoint.longitude - firstPoint.longitude) < 0.00001
          ) {
            setIsComplete(false);
          }
        } else if (newPoints.length < 3 && isComplete) {
          setIsComplete(false);
        }
        return newPoints;
      }
      return prevPoints;
    });
  }, [isComplete]);

  const redoPoint = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length > 0) {
        const newRedoStack = [...prevRedo];
        const restoredPoint = newRedoStack.pop();
        if (restoredPoint) {
          setPoints((prevPoints) => {
            const updatedPoints = [...prevPoints, restoredPoint];
            if (
              updatedPoints.length > 1 &&
              updatedPoints.length > prevPoints.length
            ) {
              const firstPoint = updatedPoints[0];
              const lastPoint = updatedPoints[updatedPoints.length - 1];
              if (
                Math.abs(lastPoint.latitude - firstPoint.latitude) < 0.00001 &&
                Math.abs(lastPoint.longitude - firstPoint.longitude) < 0.00001
              ) {
                setIsComplete(true);
              }
            } else {
              setIsComplete(false);
            }
            console.log(
              '>>> Context: Redoing point. New points count:',
              updatedPoints.length,
            );
            return updatedPoints;
          });
        }
        console.log(
          '>>> Context: New redo stack count after redo:',
          newRedoStack.length,
        );
        return newRedoStack;
      }
      return prevRedo;
    });
  }, [setIsComplete]);

  const handleSetIsComplete = useCallback(
    (complete: boolean, newProvince?: string, newRegion?: string) => {
      setIsComplete(complete);
      console.log(
        `>>> Context: Setting isComplete: ${complete}. Province: ${newProvince}, Region: ${newRegion}`,
      );
      if (complete) {
        setProvince(newProvince ?? null);
        setRegion(newRegion ?? null);
      } else {
        // Reset location data when polygon is opened for editing
        setProvince(null);
        setRegion(null);
      }
    },
    [],
  );

  const closePolygon = useCallback(() => {
    console.log('>>> Context: Attempting to close polygon.');
    if (points.length < 3) {
      console.log('>>> Context: Cannot close polygon - not enough points.');
      return;
    }
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const alreadyClosed =
      Math.abs(firstPoint.latitude - lastPoint.latitude) < 0.00001 &&
      Math.abs(firstPoint.longitude - lastPoint.longitude) < 0.00001;

    if (alreadyClosed) {
      console.log('>>> Context: Polygon is already closed.');
      setIsComplete(true);
      return;
    }

    console.log('>>> Context: Adding closing point.');
    const closingPoint: Coordinate = {
      latitude: firstPoint.latitude,
      longitude: firstPoint.longitude,
    };

    setPoints((prevPoints) => {
      console.log(
        '>>> Context: closePolygon updater: Previous points state:',
        prevPoints,
      );
      const newState = [...prevPoints, closingPoint];
      console.log(
        '>>> Context: closePolygon updater: New state after adding closing point:',
        newState,
      );
      return newState;
    });

    setIsComplete(true);
    setRedoStack([]);
  }, [points, setIsComplete, setRedoStack]);

  const insertPoint = useCallback(
    (point: Coordinate, index: number) => {
      setPoints((prevPoints) => {
        if (isComplete) {
          console.log('>>> Context: insertPoint ignored: shape is complete.');
          return prevPoints;
        }

        const newPoints = [...prevPoints];
        const validIndex = Math.max(0, Math.min(index, newPoints.length));
        newPoints.splice(validIndex, 0, point);

        console.log(
          `>>> Context: insertPoint called. New point inserted at index ${validIndex}. New length: ${newPoints.length}`,
        );

        return newPoints;
      });
      setRedoStack([]);
    },
    [isComplete],
  );

  const updatePoint = useCallback(
    (index: number, newPoint: Coordinate) => {
      console.log(
        `>>> Context: Updating point at index ${index} to:`,
        newPoint,
      );

      setPoints((prevPoints) => {
        if (index < 0 || index >= prevPoints.length) {
          console.error('Invalid index provided for updatePoint:', index);
          return prevPoints;
        }
        const newPoints = [...prevPoints];

        newPoints[index] = newPoint;

        if (isComplete && newPoints.length > 2) {
          if (index === 0) {
            newPoints[newPoints.length - 1] = newPoint;
          } else if (index === newPoints.length - 1) {
            newPoints[0] = newPoint;
          }
        }
        return newPoints;
      });
    },
    [isComplete],
  );

  const contextValue = useMemo(
    () => ({
      points,
      redoStack,
      isComplete,
      province,
      region,
      addPoint,
      insertPoint,
      updatePoint,
      resetPoints,
      undoPoint,
      redoPoint,
      setIsComplete: handleSetIsComplete,
      closePolygon,
    }),
    [
      points,
      redoStack,
      isComplete,
      province,
      region,
      addPoint,
      insertPoint,
      updatePoint,
      resetPoints,
      undoPoint,
      redoPoint,
      handleSetIsComplete,
      closePolygon,
    ],
  );

  return (
    <PointsContext.Provider value={contextValue}>
      {children}
    </PointsContext.Provider>
  );
};

export default PointsContext;
