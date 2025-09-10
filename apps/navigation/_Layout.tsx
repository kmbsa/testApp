import { StyleSheet, Text, View } from 'react-native'
import { Tabs } from 'expo-router';
import React from 'react'

export default function _Layout() {
  return (
    <Tabs>
        <Tabs.Screen
            name="Login"
            options={{
                title: 'Login',
                headerShown: false,
                tabBarIcon: ( {focused} ) => (
                    <>
                        
                    </>
                )
            }}
        />
        <Tabs.Screen
            name="Registration"
            options={{
                title: 'Registration',
                headerShown: false
            }}
        />
    </Tabs>
  )
}
