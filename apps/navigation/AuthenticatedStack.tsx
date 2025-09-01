import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Home from '../pages/Home';
import Map from '../pages/Map';
import Camera from '../pages/Camera';
import MapEntries from '../pages/MapEntries';

import { PointsProvider } from '../context/PointsContext';

import type { RootStackParamList } from './types';
import AreaDetailsScreen from '../pages/{id}';

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
                 <AuthenticatedFlowStack.Screen name="MapPreview" component={AreaDetailsScreen} options={{ title: 'Map Preview' }} />
            </AuthenticatedFlowStack.Navigator>
        </PointsProvider>
    );
}

export default AuthenticatedStack;