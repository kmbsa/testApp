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

export type farmPlot = {
  Farm_Plot_ID: number;
  Area_ID: number;
  Soil_Type: string;
  Hectares: string;
  Suitability: string;
  created_at: string;
  coordinates: BackendCoordinate[];
};

export type AreaEntry = {
  Area_ID: number;
  User_ID: number;
  Area_Name: string;
  Region: string;
  Province: string;
  Organization: string;
  topography: topography[];
  Hectares: string;
  created_at: string;
  coordinates: BackendCoordinate[];
  images: BackendPhoto[];
  farm?: farmPlot[];
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

export type ActivityLog = {
  Activity_Log_ID: number;
  User_ID: number;
  Activity_Type: string;
  Entity_Type: string;
  Entity_ID: number | null;
  Description: string;
  Device: string;
  IPv4_Address: string;
  User_Agent: string;
  Timestamp: string;
};

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Registration: { agreedToTerms?: boolean } | undefined;
  Map: { capturedPhotoUri?: string; capturedLocation?: Coordinate } | undefined;
  MapEntries: undefined;
  DraftsPage: undefined;
  Camera: undefined;
  Loading: undefined;
  AuthenticatedStack: undefined;
  MapPreview: { areaId: number } | undefined;
  MapDetailsUpdate: { areaId: number } | undefined;
  MapCoordinatesUpdate: { areaId: number; draftData?: any } | undefined;
  MapCoordinatesUpdateDraftsPage: undefined;
  FarmPlotCoordinates:
    | { areaId: number; farmId?: number; draftData?: any }
    | undefined;
  FarmPlotCoordinatesDraftsPage: undefined;
  ImageViewerScreen:
    | { images: BackendPhoto[]; initialIndex: number; apiUrl: string }
    | undefined;
  FarmActivity: { areaId: number; farmId?: number } | undefined;
  WeatherPreview: { location: Coordinate } | undefined;
  AccountSettings: undefined;
  UserActivity: undefined;
  AuthTabs: undefined;
  Test: undefined;
  EmailVerification: { user_id: number; email: string; first_name: string };
  TermsAndConditions: { source?: string } | undefined;
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
export type MapCoordinatesUpdateDraftsPageProps = NativeStackScreenProps<
  RootStackParamList,
  'MapCoordinatesUpdateDraftsPage'
>;
export type FarmPlotCoordinatesProps = NativeStackScreenProps<
  RootStackParamList,
  'FarmPlotCoordinates'
>;
export type FarmPlotCoordinatesDraftsPageProps = NativeStackScreenProps<
  RootStackParamList,
  'FarmPlotCoordinatesDraftsPage'
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
export type UserActivityProps = NativeStackScreenProps<
  RootStackParamList,
  'UserActivity'
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
