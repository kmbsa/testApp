import {
  KeyboardAvoidingView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import React from 'react';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useNavigation } from '@react-navigation/native';
import Styles from '../../../styles/styles';
import { MapDetailsUpdateProps } from '../../../navigation/types';

const MapDetailsUpdate = () => {
  const navigation = useNavigation<MapDetailsUpdateProps['navigation']>();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[Styles.container, { alignItems: 'center' }]}>
      <KeyboardAvoidingView>
        <View style={localStyles.titleContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={localStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Styles.text.color} />
          </TouchableOpacity>
          <View style={localStyles.headerTitleContainer}>
            <Text style={localStyles.title}>Placeholder Name</Text>
          </View>
        </View>
        <ScrollView>
          <View style={Styles.container}>
            <View style={Styles.header}>
              <Text style={Styles.headerText}>Map Location</Text>
              <View style={[Styles.formBox, localStyles.formBox]}></View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  formBox: {
    width: '100%',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 10,
    width: '90%',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Styles.text.color,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});

export default MapDetailsUpdate;
