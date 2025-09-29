import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AntDesign, Entypo } from '@expo/vector-icons';
import LoginScreen from '../(pages)/Login';
import RegisterScreen from '../(pages)/Register';

const Tab = createBottomTabNavigator();

const App = () => {
  return (
    <Tab.Navigator
      initialRouteName="Login"
      screenOptions={{
        tabBarStyle: { backgroundColor: '#3D550C' },
        tabBarLabelStyle: { fontSize: 14 },
        tabBarActiveTintColor: '#F4D03F',
      }}
    >
      <Tab.Screen
        name="Login"
        component={LoginScreen}
        options={{
          title: 'Login',
          tabBarIcon: ({ color, size }) => (
            <Entypo name="login" color={color} size={size} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Registration"
        component={RegisterScreen}
        options={{
          title: 'Register',
          tabBarIcon: ({ color, size }) => (
            <AntDesign name="user-add" color={color} size={size} />
          ),
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

export default App;
