import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from '../(pages)/Login';
import RegisterScreen from '../(pages)/Register';
import { AntDesign, Entypo, Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

const App = () => {
  return (
      <Tab.Navigator
        initialRouteName="Login"
        screenOptions={{
          tabBarStyle: { backgroundColor: '#fff' },
          tabBarLabelStyle: { fontSize: 14 },
          tabBarActiveTintColor: 'blue',
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
            headerShown: false
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
            headerShown: false
          }}
        />
      </Tab.Navigator>
  );
};

export default App;
