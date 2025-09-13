import React from 'react';

import { View, Text, ActivityIndicator, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Styles from '../../../styles/styles';

import { useAuth } from '../../../context/AuthContext';
import { RootStackNavigationProp, HomeScreenProps } from '../../../navigation/types';

function Home() {
  const { userData, signOut, isLoading } = useAuth();

  const navigation = useNavigation<HomeScreenProps['navigation']>();

  if (isLoading) {
    return (
      <View style={[Styles.container, localStyles.loadingContainer]}>
        <ActivityIndicator size="large" color={Styles.text.color} />
        <Text style={[Styles.text, { marginTop: 10 }]}>Loading user information...</Text>
      </View>
    );

  }

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

  return (
    <View style={[Styles.container, localStyles.container]}>
      <Text style={[Styles.welcomeText, localStyles.welcomeText]}>
        Welcome, {userData?.first_name} {userData?.last_name}!
      </Text>
      <TouchableOpacity style={Styles.button}
        onPress={() => navigation.navigate('Map')}>
        <Text style={Styles.buttonText}>Go to Map Page</Text>
      </TouchableOpacity>

      <TouchableOpacity style={Styles.button}
        onPress={() => navigation.navigate('MapEntries')}>
        <Text style={Styles.buttonText}>Go to Map Entries</Text>
      </TouchableOpacity>

      <TouchableOpacity style={Styles.button}
        onPress={() => navigation.navigate('Test')}>
        <Text style={Styles.buttonText}>Go to Page 3</Text>
      </TouchableOpacity>

      <TouchableOpacity style={Styles.button}
        onPress={handleLogout}>
        <Text style={Styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },

     welcomeText: {
         marginBottom: 20,
         textAlign: 'center',
     },
     loadingContainer: {
         flex: 1,
         justifyContent: 'center',
         alignItems: 'center',
     }
});

export default Home;