import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '@env';
interface UserData {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  sex?: string;
  contact_no?: string;
  user_type?: string;
}

interface RegistrationPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  sex: string | null;
  contact_no: string;
}

interface AuthContextType {
  userToken: string | null;
  userData: UserData | null;
  isLoading: boolean;
  isSigningIn: boolean;
  isSigningUp: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (userDataPayload: RegistrationPayload) => Promise<void>;
  signOut: () => Promise<void>;
  fetchUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      try {
        console.log('AuthContext: Checking for token in AsyncStorage...');
        const token = await AsyncStorage.getItem('token');
        if (token) {
          console.log('AuthContext: Token found.');
          setUserToken(token);
          // Fetch user data immediately if token is found
          // The userToken effect below will handle fetching data
        } else {
          console.log('AuthContext: No token found.');
        }
      } catch (e) {
        console.error('AuthContext: Failed to load token from storage:', e);
      } finally {
        setIsLoading(false); // Initial check is complete
        console.log('AuthContext: Initial loading complete.');
      }
    };
    checkToken();
  }, []);

  // --- Internal function to fetch user data ---
  const internalFetchUserData = useCallback(async (token: string) => {
    setError(null); // Clear previous errors
    console.log('AuthContext: Fetching user data...');
    try {
      const response = await axios.get<UserData>(`${API_URL}/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserData(response.data);
      console.log(
        'AuthContext: User data fetched successfully:',
        response.data,
      );
    } catch (e: any) {
      console.error('AuthContext: Error fetching user data:', e);
      setError('Failed to fetch user data.');

      // If token is invalid or expired, the API might return 401/403
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        console.log(
          'AuthContext: User data fetch returned 401, token likely expired. Signing out.',
        );
        signOut();
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    console.log(
      'AuthContext: userToken state changed:',
      userToken ? 'present' : 'null',
    );
    const handleUserTokenChange = async () => {
      if (userToken) {
        try {
          await internalFetchUserData(userToken);
        } catch (e) {}
      } else {
        console.log('AuthContext: userToken is null, clearing user data.');
        setUserData(null);
      }
    };
    handleUserTokenChange();
  }, [userToken, internalFetchUserData]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsSigningIn(true);
    setError(null);
    console.log('AuthContext: Attempting to sign in...', { email });
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        user: email,
        password: password,
      });

      if (response.data.token) {
        const token = response.data.token;
        console.log('AuthContext: Login successful, saving token...');
        await AsyncStorage.setItem('token', token);
        setUserToken(token);
        console.log('AuthContext: Token saved and state updated.');
      } else {
        setError('Login failed: No token received from API.');
        console.error('AuthContext: Login failed: No token received.');
        throw new Error('Login failed: No token received.');
      }
    } catch (e: any) {
      console.error('AuthContext: Login API error:', e);
      if (axios.isAxiosError(e) && e.response) {
        const backendError =
          e.response.data?.error ||
          `Server error (Status: ${e.response.status})`;
        setError(backendError);
        console.error(
          'AuthContext: Login API error response data:',
          e.response.data,
        );
      } else {
        setError('Login failed: Network error or unexpected issue.');
      }
      throw e;
    } finally {
      setIsSigningIn(false);
      console.log('AuthContext: Sign in process ended.');
    }
  }, []);

  const signUp = useCallback(async (userDataPayload: RegistrationPayload) => {
    setIsSigningUp(true);
    setError(null);
    console.log('AuthContext: Attempting to sign up...', {
      email: userDataPayload.email,
    });
    try {
      const response = await axios.post(`${API_URL}/user`, userDataPayload);

      if (response.status === 201) {
        console.log('AuthContext: Registration successful:', response.data);
      } else {
        setError(
          response.data?.error ||
            `Registration failed with status ${response.status}`,
        );
        console.error(
          'AuthContext: Registration failed with status:',
          response.status,
          response.data,
        );
        throw new Error('Registration failed');
      }
    } catch (e: any) {
      console.error('AuthContext: Registration API error:', e);
      if (axios.isAxiosError(e) && e.response) {
        const backendError =
          e.response.data?.error ||
          `Server error (Status: ${e.response.status})`;
        setError(backendError);
        console.error(
          'AuthContext: Registration API error response data:',
          e.response.data,
        );
      } else {
        setError('Registration failed: Network error or unexpected issue.');
      }
      throw e;
    } finally {
      setIsSigningUp(false);
      console.log('AuthContext: Sign up process ended.');
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('AuthContext: Signing out...');
    setUserToken(null);
    setUserData(null);
    setError(null);
    try {
      // Optional: Call backend logout endpoint (backend might invalidate the token)
      // Need the token to call this, but we just cleared it in state.
      // This highlights a potential edge case: if the backend logout fails, the token is still valid there.
      // A better approach might be to send the token to backend BEFORE clearing state,
      // or have backend invalidate based on user ID.
      // For simplicity now, we'll just remove from storage.
      console.log('AuthContext: Removing token from storage.');
      await AsyncStorage.removeItem('token');
      console.log('AuthContext: Token removed from AsyncStorage.');
    } catch (e) {
      console.error(
        'AuthContext: Failed to remove token from storage or call backend logout:',
        e,
      );
    }
    console.log('AuthContext: Sign out process complete.');
  }, []);

  const fetchUserData = useCallback(async () => {
    if (userToken) {
      console.log('AuthContext: fetchUserData called with token present.');
      await internalFetchUserData(userToken);
    } else {
      console.warn('AuthContext: fetchUserData called but no token found.');
      setError('Cannot fetch user data: No authentication token found.');
      // signOut(); // Or sign out if this indicates an invalid state
    }
  }, [userToken, internalFetchUserData]);

  const contextValue = useMemo(
    () => ({
      userToken,
      userData,
      isLoading,
      isSigningIn,
      isSigningUp,
      error,
      signIn,
      signUp,
      signOut,
      fetchUserData,
    }),
    [
      userToken,
      userData,
      isLoading,
      isSigningIn,
      isSigningUp,
      error,
      signIn,
      signUp,
      signOut,
      fetchUserData,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
