// src/navigation/AuthenticatedStack.tsx

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';


import Home from '../pages/Home';
import Map from '../pages/Map';
import CameraModule from '../pages/Camera'; // Keep the import


import Test from '../pages/Test';
import Test2 from '../pages/Test2';
import { PointsProvider } from '../context/PointsContext'; // Adjust path

import type { RootStackParamList } from './types'; // Ensure path is correct

const AuthenticatedFlowStack = createNativeStackNavigator<RootStackParamList>();

function AuthenticatedStack() {
    console.log("AuthenticatedStack Component Rendered (Rendering its own Navigator).");

    return (
        <PointsProvider>
            <AuthenticatedFlowStack.Navigator screenOptions={{ headerShown: false }}>
                 <AuthenticatedFlowStack.Screen name="Home" component={Home} />
                 <AuthenticatedFlowStack.Screen name="Map" component={Map} options={{ headerShown: false }} />
                 <AuthenticatedFlowStack.Screen name="Test" component={Test} options={{ headerShown: false }} />
                 {/* <AuthenticatedFlowStack.Screen name="Camera" component={CameraModule} options={{ title: 'Take A Photo' }} /> */}
                 <AuthenticatedFlowStack.Screen name="Test2" component={Test2} options={{ title: 'Another Test Page' }}/>
            </AuthenticatedFlowStack.Navigator>
        </PointsProvider>
    );
}

export default AuthenticatedStack;