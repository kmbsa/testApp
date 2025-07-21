// src/navigation/AppNavigator.tsx - Main Navigator

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Registration from '../pages/Register';
import Login from '../pages/Login';
import LoadingScreen from '../pages/LoadingScreen';

import AuthenticatedStack from './AuthenticatedStack';

import { useAuth } from '../context/AuthContext';

// Import RootStackParamList type
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootStack() {
    const { userToken, isLoading } = useAuth();

    if (isLoading) {
         return(
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Loading" component={LoadingScreen} />
            </Stack.Navigator>
         );
    }

    return(
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {userToken ? (
                <Stack.Screen name="AuthenticatedStack" component={AuthenticatedStack} options={{ headerShown: false }}/>
            ) : (
                <Stack.Group>
                    <Stack.Screen name="Login" component={Login} />
                    <Stack.Screen name="Registration" component={Registration} />
                </Stack.Group>
            )}
        </Stack.Navigator>
    );
}

export default RootStack;