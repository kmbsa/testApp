import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';
import type { MapPoint } from '../navigation/types';

// Define the shape of the context data
interface PointsContextType {
  points: MapPoint[];
  redoStack: MapPoint[];
  isComplete: boolean;
  addPoint: (point: MapPoint) => void;
  resetPoints: () => void;
  undoPoint: () => void;
  redoPoint: () => void;
  setIsComplete: (complete: boolean) => void; // Keep this for other logic if needed
  closePolygon: () => void; // --- Add the new function ---
}

// Create the Context
const PointsContext = createContext<PointsContextType | undefined>(undefined);

// Custom hook for easily consuming the context
export const usePointsContext = () => {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePointsContext must be used within a PointsProvider');
  }
  return context;
};

// Helper function for coordinate comparison (can reuse the one from Map.tsx)
const isCoordinateInArray = (coordinate: { latitude: number; longitude: number }, array: { latitude: number; longitude: number }[], epsilon = 0.00001): boolean => {
    return array.some(point =>
        Math.abs(point.latitude - coordinate.latitude) < epsilon &&
        Math.abs(point.longitude - coordinate.longitude) < epsilon
    );
};

// Create the Provider component
export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [redoStack, setRedoStack] = useState<MapPoint[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // --- Define state update functions ---

  // Add a point to the points array - Coordinate-only duplicate check
  const addPoint = useCallback((point: MapPoint) => {
     console.log(">>> Context: addPoint called with point:", point);
     setPoints(prevPoints => {
         console.log(">>> Context: addPoint updater: Previous points state:", prevPoints); // <-- Log previous state

         // --- Coordinate-only duplicate check ---
         // Check if a point with these coordinates already exists in the array
         const isCoordinateDuplicate = prevPoints.some(existingPoint =>
             Math.abs(existingPoint.latitude - point.latitude) < 0.00001 &&
             Math.abs(existingPoint.longitude - point.longitude) < 0.00001
         );

         if (isCoordinateDuplicate) {
             console.log(">>> Context: Skipping adding point due to coordinate duplicate.", point);
             // Optional: You could add a specific check here if the incoming point *has* a photoUri
             // and you *do* want to allow multiple photos at the same spot.
             // But for now, the coordinate-only check prevents any additions at existing coords.
             return prevPoints; // Return current state without adding
         }

         console.log(">>> Context: Adding point with unique coordinate.", point);
         // Make sure adding a new point automatically sets isComplete to false
         setIsComplete(false); // Shape is no longer complete if you add a new point
         const newState = [...prevPoints, point];
         console.log(">>> Context: addPoint updater: New state after adding:", newState); // <-- Log new state
         return newState;
     });
     setRedoStack([]); // Clear redo stack when a new point is added
  }, []);

  // Reset points and redo stack (already implemented)
  const resetPoints = useCallback(() => {
     console.log(">>> Context: Resetting all points.");
     setPoints([]);
     setRedoStack([]);
     setIsComplete(false);
  }, []);

  // Undo the last point (already implemented)
  const undoPoint = useCallback(() => {
     setPoints(prevPoints => {
         if (prevPoints.length > 0) {
             const newPoints = [...prevPoints];
             const lastPoint = newPoints.pop();
             if (lastPoint) {
                  setRedoStack(prevRedo => [...prevRedo, lastPoint]);
             }
             console.log(">>> Context: Undoing last point. New points count:", newPoints.length);
             // If undo makes the shape no longer closed, set isComplete to false
             // Check if the point removed was the closing point
             if (prevPoints.length > 1 && newPoints.length > 0) { // Check lengths before pop and after
                  const firstPoint = newPoints[0];
                   if (lastPoint && // Ensure lastPoint exists
                       Math.abs(lastPoint.latitude - firstPoint.latitude) < 0.00001 &&
                       Math.abs(lastPoint.longitude - firstPoint.longitude) < 0.00001) {
                        setIsComplete(false); // Shape is no longer complete
                   }
             } else if (newPoints.length < 3 && isComplete) { // If points drop below 3 unique and it was complete
                  setIsComplete(false);
             }


             return newPoints;
         }
         return prevPoints; // No points to undo
     });
  }, [isComplete]); // Dependency on isComplete as used inside callback

  // Redo the last undone point (already implemented)
  const redoPoint = useCallback(() => {
     setRedoStack(prevRedo => {
         if (prevRedo.length > 0) {
             const newRedoStack = [...prevRedo];
             const restoredPoint = newRedoStack.pop();
             if (restoredPoint) {
                  setPoints(prevPoints => {
                     const updatedPoints = [...prevPoints, restoredPoint];
                     // Check if redo makes the shape complete (by restoring the closing point)
                     if (updatedPoints.length > 1 && updatedPoints.length > prevPoints.length) { // Check that a point was actually added
                          const firstPoint = updatedPoints[0];
                          const lastPoint = updatedPoints[updatedPoints.length - 1];
                          if (Math.abs(lastPoint.latitude - firstPoint.latitude) < 0.00001 &&
                              Math.abs(lastPoint.longitude - firstPoint.longitude) < 0.00001) {
                               setIsComplete(true); // Shape is now complete
                          }
                     } else {
                          // If redo doesn't make it complete, ensure isComplete is false
                          setIsComplete(false);
                     }
                      console.log(">>> Context: Redoing point. New points count:", updatedPoints.length);
                     return updatedPoints;
                  });
             }
             console.log(">>> Context: New redo stack count after redo:", newRedoStack.length);
             return newRedoStack;
         }
         return prevRedo;
     });
  }, []); // Dependencies: empty array as setters are stable

  // Expose setIsComplete (already implemented)
  const handleSetIsComplete = useCallback((complete: boolean) => {
      console.log(">>> Context: Setting isComplete to", complete);
      setIsComplete(complete);
  }, []);

   // --- Implement the new closePolygon function ---
   const closePolygon = useCallback(() => {
     console.log(">>> Context: Attempting to close polygon.");
     if (points.length < 3) {
          console.log(">>> Context: Cannot close polygon - not enough points.");
          return; 
     }
     const firstPoint = points[0];
     const lastPoint = points[points.length - 1];
     const alreadyClosed = Math.abs(firstPoint.latitude - lastPoint.latitude) < 0.00001 &&
                           Math.abs(firstPoint.longitude - lastPoint.longitude) < 0.00001;

     if (alreadyClosed) {
         console.log(">>> Context: Polygon is already closed.");
         setIsComplete(true); // Ensure isComplete is true if already closed
         return;
     }

     console.log(">>> Context: Adding closing point.");
     // --- Create closingPoint as a simple coordinate, EXCLUDING photoUri ---
     const closingPoint: MapPoint = { latitude: firstPoint.latitude, longitude: firstPoint.longitude };

     // --- Add the closing point WITHOUT the standard duplicate check ---
     setPoints(prevPoints => {
          console.log(">>> Context: closePolygon updater: Previous points state:", prevPoints); // <-- Log previous state
          const newState = [...prevPoints, closingPoint];
          console.log(">>> Context: closePolygon updater: New state after adding closing point:", newState); // <-- Log new state
          return newState;
     });

     setIsComplete(true); // Set the shape as complete
     setRedoStack([]); // Clear redo stack when completing
  }, [points, setIsComplete, setRedoStack]);

  // Memoize the context value
  const contextValue = useMemo(() => ({
    points,
    redoStack,
    isComplete,
    addPoint,
    resetPoints,
    undoPoint,
    redoPoint,
    setIsComplete: handleSetIsComplete, // Use the wrapped setter
    closePolygon, // --- Include the new function ---
  }), [points, redoStack, isComplete, addPoint, resetPoints, undoPoint, redoPoint, handleSetIsComplete, closePolygon]);

  // Provide the context value
  return (
    <PointsContext.Provider value={contextValue}>
      {children}
    </PointsContext.Provider>
  );
};

export default PointsContext;