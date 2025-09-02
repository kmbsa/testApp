import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootStack from './apps/navigation/AppNavigator';
import { AuthProvider } from './apps/context/AuthContext';
import { PointsProvider } from './apps/context/PointsContext';
import { PhotoProvider } from './apps/context/PhotosContext';

function App() {
  return (
    <AuthProvider>
      <PointsProvider>
        <PhotoProvider>
          <NavigationContainer>
            <RootStack />
          </NavigationContainer>
        </PhotoProvider>
      </PointsProvider>
    </AuthProvider>
  );
}

export default App;