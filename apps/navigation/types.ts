import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type topography = {
  Slope: number;
  Mean_Average_Sea_Level: number;
};

export type Photo = {
  id: string;
  uri: string;
  base64: string;
  mimeType: string;
  filename: string;
};

export type AreaEntry = {
  Area_ID: number;
  User_ID: number;
  Area_Name: string;
  Region: string;
  Province: string;
  Organization: string;
  topography: topography[];
  Soil_Type: string;
  Hectares: string;
  Suitability: string;
  created_at: string;
  coordinates: BackendCoordinate[];
  images: BackendPhoto[];
};

export type BackendCoordinate = {
  Latitude: number;
  Longitude: number;
};

export type BackendPhoto = {
  Image_ID: number;
  Image_filename?: string;
  Filepath: string;
};

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Registration: undefined;
  Map: { capturedPhotoUri?: string; capturedLocation?: Coordinate } | undefined;
  MapEntries: undefined;
  DraftsPage: undefined;
  Camera: undefined;
  Loading: undefined;
  AuthenticatedStack: undefined;
  MapPreview: { areaId: number } | undefined;
  MapDetailsUpdate: { areaId: number } | undefined;
  MapCoordinatesUpdate: { areaId: number } | undefined;
  ImageViewerScreen:
    | { images: BackendPhoto[]; initialIndex: number; apiUrl: string }
    | undefined;
  FarmActivity: { areaId: number } | undefined;
  WeatherPreview: { location: Coordinate } | undefined;
  AccountSettings: undefined;
  AuthTabs: undefined;
  Test: undefined;
};

export type LoginScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Login'
>;
export type HomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Home'
>;
export type RegistrationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Registration'
>;
export type MapScreenProps = NativeStackScreenProps<RootStackParamList, 'Map'>;
export type CameraScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Camera'
>;
export type LoadingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Loading'
>;
export type AuthenticatedStackScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AuthenticatedStack'
>;
export type MapsEntriesProps = NativeStackScreenProps<
  RootStackParamList,
  'MapEntries'
>;
export type DraftsPageProps = NativeStackScreenProps<
  RootStackParamList,
  'DraftsPage'
>;
export type MapPreviewProps = NativeStackScreenProps<
  RootStackParamList,
  'MapPreview'
>;
export type MapDetailsUpdateProps = NativeStackScreenProps<
  RootStackParamList,
  'MapDetailsUpdate'
>;
export type MapCoordinatesUpdateProps = NativeStackScreenProps<
  RootStackParamList,
  'MapCoordinatesUpdate'
>;
export type ImageViewerProps = NativeStackScreenProps<
  RootStackParamList,
  'ImageViewerScreen'
>;
export type FarmActivityProps = NativeStackScreenProps<
  RootStackParamList,
  'FarmActivity'
>;
export type WeatherPreviewProps = NativeStackScreenProps<
  RootStackParamList,
  'WeatherPreview'
>;
export type AccountSettingsProps = NativeStackScreenProps<
  RootStackParamList,
  'AccountSettings'
>;
export type TestScreenProps = NativeStackNavigationProp<
  RootStackParamList,
  'Test'
>;
export type AuthTabsProps = NativeStackNavigationProp<
  RootStackParamList,
  'AuthTabs'
>;

export type MapScreenRouteProp = MapScreenProps['route'];

export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;
