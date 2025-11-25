import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoadingScreen from '../(pages)/LoadingScreen';

import AuthenticatedStack from './AuthenticatedStack';

import { useAuth } from '../context/AuthContext';

import type { RootStackParamList } from './types';

import AuthTabs from '../(pages)/_Layout';
import EmailVerification from '../(pages)/EmailVerification';
import TermsAndConditions from '../(pages)/UserAgreement';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootStack() {
  const { userToken, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Loading" component={LoadingScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken ? (
        <Stack.Screen
          name="AuthenticatedStack"
          component={AuthenticatedStack}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AuthTabs" component={AuthTabs} />
          <Stack.Screen
            name="EmailVerification"
            component={EmailVerification}
            options={{
              title: 'Verify Email',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="TermsAndConditions"
            component={TermsAndConditions}
            options={{
              title: 'Terms and Conditions',
              headerShown: false,
            }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

export default RootStack;
