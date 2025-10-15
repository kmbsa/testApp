import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Home from '../(pages)/auth/usr/Home';
import Map from '../(pages)/auth/usr/Map';
import Camera from '../(pages)/auth/usr/Camera';
import MapEntries from '../(pages)/auth/usr/MapEntries';
import MapPreview from '../(pages)/auth/usr/MapView';
import Weather from '../(pages)/auth/usr/Weather';
import Test from '../(pages)/auth/tst/Test';
import DraftsPage from '../(pages)/auth/usr/DraftsPage';
import FarmActivityScreen from '../(pages)/auth/usr/FarmActivity';
import ImageViewerScreen from '../(pages)/auth/usr/ImageViewer';
import AccountSettingsScreen from '../(pages)/auth/usr/AccountSettings';
import { PointsProvider } from '../context/PointsContext';

import type { RootStackParamList } from './types';

const AuthenticatedUserFlowStack =
  createNativeStackNavigator<RootStackParamList>();

function AuthenticatedUserStack() {
  console.log(
    'AuthenticatedStack Component Rendered (Rendering its own Navigator).',
  );

  return (
    <PointsProvider>
      <AuthenticatedUserFlowStack.Navigator
        screenOptions={{ headerShown: false }}
      >
        <AuthenticatedUserFlowStack.Screen name="Home" component={Home} />
        <AuthenticatedUserFlowStack.Screen
          name="Map"
          component={Map}
          options={{ headerShown: false }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="Camera"
          component={Camera}
          options={{ title: 'Take A Photo' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="MapEntries"
          component={MapEntries}
          options={{ title: 'Map Entries' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="MapPreview"
          component={MapPreview}
          options={{ title: 'Map Preview' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="WeatherPreview"
          component={Weather}
          options={{ title: 'Weather' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="DraftsPage"
          component={DraftsPage}
          options={{ title: 'Drafts' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="FarmActivity"
          component={FarmActivityScreen}
          options={{ title: 'Farm Activity' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="ImageViewerScreen"
          component={ImageViewerScreen}
          options={{ title: 'Image Viewer' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="AccountSettings"
          component={AccountSettingsScreen}
          options={{ title: 'Account Settings' }}
        />
        <AuthenticatedUserFlowStack.Screen
          name="Test"
          component={Test}
          options={{ title: 'Test' }}
        />
      </AuthenticatedUserFlowStack.Navigator>
    </PointsProvider>
  );
}

export default AuthenticatedUserStack;
