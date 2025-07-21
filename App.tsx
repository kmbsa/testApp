import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootStack from './navigation/AppNavigator';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (

    <AuthProvider>
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
    </AuthProvider>
  );
}

export default App;