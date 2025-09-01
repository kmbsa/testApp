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
    MapPreview: undefined;
    Test: { capturedPhotoUri?: string; capturedLocation?: Coordinate } | undefined;
    Test2: undefined;
    AreaDetails: { areaId: number };
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
export type MapsEntriesProps = NativeStackScreenProps<RootStackParamList, 'MapEntries'>;
export type AreaDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'AreaDetails'>;

export type MapScreenRouteProp = MapScreenProps['route'];

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
