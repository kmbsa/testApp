import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/native';

export type Coordinate = { latitude: number; longitude: number };

export type AreaPicture = { photoUri?: string; };

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Registration: undefined;
  Map: { capturedPhotoUri?: string; capturedLocation?: Coordinate } | undefined;
  Camera: undefined;
  Loading: undefined;
  AuthenticatedStack: undefined;
  MapsPreview: undefined;
  Test: { capturedPhotoUri?: string; capturedLocation?: Coordinate } | undefined;
  Test2: undefined;
};

export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RegistrationScreenProps = NativeStackScreenProps<RootStackParamList, 'Registration'>;
export type MapScreenProps = NativeStackScreenProps<RootStackParamList, 'Map'>;
export type CameraScreenProps = NativeStackScreenProps<RootStackParamList, 'Camera'>;
export type LoadingScreenProps = NativeStackScreenProps<RootStackParamList, 'Loading'>;
export type AuthenticatedStackScreenProps = NativeStackScreenProps<RootStackParamList, 'AuthenticatedStack'>;
export type TestScreenProps = NativeStackScreenProps<RootStackParamList, 'Test'>;
export type Test2ScreenProps = NativeStackScreenProps<RootStackParamList, 'Test2'>;
export type MapsPreviewProps = NativeStackScreenProps<RootStackParamList, 'MapsPreview'>;

export type MapScreenRouteProp = MapScreenProps['route']; 

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;