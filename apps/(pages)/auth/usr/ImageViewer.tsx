// ImageViewer.tsx

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native'; // 🚨 FIX: Re-import RouteProp
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BackendPhoto } from '../../../navigation/types';
import type {
  RootStackParamList,
  // 🗑️ REMOVED: ImageViewerProps is no longer needed here
} from '../../../navigation/types';

const { width, height } = Dimensions.get('window');

// 🚨 FIX: Define the specific route prop type for useRoute
type ImageViewerRouteProp = RouteProp<RootStackParamList, 'ImageViewerScreen'>;

export default function ImageViewerScreen() {
  const route = useRoute<ImageViewerRouteProp>(); // 🚨 FIX: Use the specific RouteProp
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  // We can use the non-null assertion (!) since the screen requires these params
  const { images, initialIndex, apiUrl } = route.params!;

  const imageScrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Use a simple useEffect to scroll when the component is mounted.
  useEffect(() => {
    const timer = setTimeout(() => {
      imageScrollViewRef.current?.scrollTo({
        x: initialIndex * width,
        animated: false,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [initialIndex, width]);

  // Update counter on scroll
  const handleScroll = (event: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(newIndex);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close Button */}
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 10 }]}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="close" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Main Scroll View */}
      <ScrollView
        ref={imageScrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        onMomentumScrollEnd={handleScroll}
        contentOffset={{ x: initialIndex * width, y: 0 }} // Pre-set the initial offset
      >
        {images.map((image: BackendPhoto) => (
          <Image
            key={`full-${image.Image_ID}`}
            source={{ uri: `${apiUrl}/${image.Filepath}` }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        ))}
      </ScrollView>

      {/* Image Counter */}
      <View style={[styles.imageCounter, { marginBottom: insets.bottom + 20 }]}>
        <Text style={styles.imageCounterText}>
          {currentIndex + 1} / {images.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    width: width,
    height: height,
  },
  fullScreenImage: {
    width: width,
    height: height * 0.9, // Adjust height to leave space for counter and safe area
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
