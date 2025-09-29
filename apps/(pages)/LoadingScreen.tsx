import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import Styles from '../styles/styles';

function LoadingScreen() {
  return (
    <View style={[Styles.container, localStyles.container]}>
      <ActivityIndicator size="large" color={Styles.text.color} />
      <Text style={[Styles.text, { marginTop: 10 }]}>Loading...</Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LoadingScreen;
