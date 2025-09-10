import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Home from '../(pages)/auth/usr/Home';
import Map from '../(pages)/auth/usr/Map';
import Camera from '../(pages)/auth/usr/Camera';
import MapEntries from '../(pages)/auth/usr/MapEntries';

import { PointsProvider } from '../context/PointsContext';

import type { RootStackParamList } from './types';
import MapPreview from '../(pages)/auth/usr/{id}';

const AuthenticatedFlowStack = createNativeStackNavigator<RootStackParamList>();

function AuthenticatedStack() {
    console.log("AuthenticatedStack Component Rendered (Rendering its own Navigator).");

    return (
        <PointsProvider>
            <AuthenticatedFlowStack.Navigator screenOptions={{ headerShown: false }}>
                 <AuthenticatedFlowStack.Screen name="Home" component={Home} />
                 <AuthenticatedFlowStack.Screen name="Map" component={Map} options={{ headerShown: false }} />
                 <AuthenticatedFlowStack.Screen name="Camera" component={Camera} options={{ title: 'Take A Photo' }} />
                 <AuthenticatedFlowStack.Screen name="MapEntries" component={MapEntries} options={{ title: 'Map Entries' }} />
                 <AuthenticatedFlowStack.Screen name="MapPreview" component={MapPreview} options={{ title: 'Map Preview' }} />
            </AuthenticatedFlowStack.Navigator>
        </PointsProvider>
    );
}

export default AuthenticatedStack;