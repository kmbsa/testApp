import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/native';

export type Coordinate = {
    latitude: number;
    longitude: number;
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
    Region?: string;
    Province?: string;
    Organization: string;
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
    Camera: undefined;
    Loading: undefined;
    AuthenticatedStack: undefined;
    MapPreview: {areaId: number} | undefined;
};

export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type RegistrationScreenProps = NativeStackScreenProps<RootStackParamList, 'Registration'>;
export type MapScreenProps = NativeStackScreenProps<RootStackParamList, 'Map'>;
export type CameraScreenProps = NativeStackScreenProps<RootStackParamList, 'Camera'>;
export type LoadingScreenProps = NativeStackScreenProps<RootStackParamList, 'Loading'>;
export type AuthenticatedStackScreenProps = NativeStackScreenProps<RootStackParamList, 'AuthenticatedStack'>;
export type MapsEntriesProps = NativeStackScreenProps<RootStackParamList, 'MapEntries'>;
export type MapPreviewProps = NativeStackScreenProps<RootStackParamList, 'MapPreview'>;

export type MapScreenRouteProp = MapScreenProps['route'];

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
