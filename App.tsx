import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootStack from './navigation/AppNavigator';
import { AuthProvider } from './context/AuthContext';
import { PointsProvider } from './context/PointsContext';
import { PhotoProvider } from './context/PhotosContext';

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