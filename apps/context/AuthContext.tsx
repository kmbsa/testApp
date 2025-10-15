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

// --- INTERFACES ---

interface UserData {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  sex?: string | null;
  contact_no?: string | null;
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

export interface UserDataUpdatePayload {
  first_name?: string;
  last_name?: string;
  sex?: string | null;
  contact_no?: string | null;
}

export interface UserCredentialsUpdatePayload {
  email?: string;
  password?: string;
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
  updateUserData: (data: UserDataUpdatePayload) => Promise<void>;
  updateUserCredentials: (data: UserCredentialsUpdatePayload) => Promise<void>;
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

  // --- Helper function (Internal - only fetches data) ---
  const internalFetchUserData = useCallback(
    async (token: string) => {
      try {
        const response = await axios.get(`${API_URL}/auth/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('API Response for /user endpoint:', response.data);

        const userDetails = response.data.user || response.data;

        if (userDetails && userDetails.first_name && userDetails.last_name) {
          setUserData(userDetails);
          setError(null);
          console.log(
            'AuthContext: User data fetched successfully and state updated.',
          );
        } else {
          console.error(
            'AuthContext: User data in API response is incomplete. Missing first_name or last_name.',
          );
          setError(
            'Failed to fetch complete user data. Please check API response structure.',
          );
          setUserData(null);
        }
      } catch (e: any) {
        console.error('Error fetching user data:', e.response?.data || e);
        setError(
          e.response?.data?.message ||
            'Failed to fetch user data. Please re-login.',
        );
        setUserData(null);
      }
    },
    [setUserData, setError],
  );

  // --- Auth Functions (Existing) ---
  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsSigningIn(true);
      try {
        const response = await axios.post(`${API_URL}/auth/login`, {
          email,
          password,
        });
        const token = response.data.access_token;
        await AsyncStorage.setItem('access_token', token);
        setUserToken(token);
        // Immediately fetch user data after getting the token
        await internalFetchUserData(token);
        setError(null);
      } catch (e: any) {
        console.error('AuthContext: Sign in failed:', e.response?.data || e);
        setError(
          e.response?.data?.message ||
            'Sign in failed. Check your credentials.',
        );
      } finally {
        setIsSigningIn(false);
      }
    },
    [internalFetchUserData],
  );

  const signUp = useCallback(async (userDataPayload: RegistrationPayload) => {
    setIsSigningUp(true);
    try {
      await axios.post(`${API_URL}/auth/register`, userDataPayload);
      setError(null);
      console.log('AuthContext: User registered successfully.');
    } catch (e: any) {
      console.error('AuthContext: Sign up failed:', e.response?.data || e);
      setError(
        e.response?.data?.message || 'Sign up failed. Please try again.',
      );
    } finally {
      setIsSigningUp(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setUserData(null);
    setUserToken(null);
    try {
      if (userToken) {
        try {
          await axios.post(
            `${API_URL}/auth/logout`,
            {},
            {
              headers: {
                Authorization: `Bearer ${userToken}`,
              },
            },
          );
        } catch (logoutErr) {
          console.warn(
            'AuthContext: Backend logout failed or not implemented.',
            logoutErr,
          );
        }
      }
      console.log('AuthContext: Removing access_token from storage.');
      await AsyncStorage.removeItem('access_token');
    } catch (e) {
      console.error(
        'AuthContext: Failed to remove access_token from storage or call backend logout:',
        e,
      );
    }
    console.log('AuthContext: Sign out process complete.');
  }, [userToken]);

  const fetchUserData = useCallback(async () => {
    if (userToken) {
      console.log('AuthContext: fetchUserData called with token present.');
      await internalFetchUserData(userToken);
    } else {
      console.warn('AuthContext: fetchUserData called but no token found.');
      setError('Cannot fetch user data: No authentication token found.');
    }
  }, [userToken, internalFetchUserData]);

  // --- Update User Personal Data (Route: /user) ---
  const updateUserData = useCallback(
    async (data: UserDataUpdatePayload) => {
      if (!userToken) {
        throw new Error('Authentication token not available.');
      }

      const payload: { [key: string]: any } = {};
      (Object.keys(data) as Array<keyof UserDataUpdatePayload>).forEach(
        (key) => {
          const value = data[key];
          if (value !== undefined) {
            payload[key] = value;
          }
        },
      );

      if (Object.keys(payload).length === 0) {
        console.warn(
          'updateUserData called with empty payload, skipping API call.',
        );
        return;
      }

      console.log(
        'AuthContext: Calling API to update user data (Route: /user)...',
        payload,
      );
      try {
        const response = await axios.put(`${API_URL}/user`, payload, {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 200) {
          await internalFetchUserData(userToken);
          console.log('User data updated successfully and state refreshed.');
        } else {
          throw new Error(
            response.data.message || 'Failed to update user data.',
          );
        }
      } catch (e: any) {
        console.error('Error updating user data:', e.response?.data || e);
        throw new Error(
          e.response?.data?.message ||
            'Network error or failed to update data.',
        );
      }
    },
    [userToken, internalFetchUserData],
  );

  // --- Update User Credentials (Route: /user/credentials) ---
  const updateUserCredentials = useCallback(
    async (data: UserCredentialsUpdatePayload) => {
      if (!userToken) {
        throw new Error('Authentication token not available.');
      }

      if (!data.email && !data.password) {
        throw new Error('Must provide a new email or a new password.');
      }

      console.log(
        'AuthContext: Calling API to update user credentials (Route: /user/credentials)...',
      );
      try {
        const response = await axios.put(`${API_URL}/user/credentials`, data, {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 200) {
          if (data.email) {
            // Re-fetch user data if email changed to update the local state
            await internalFetchUserData(userToken);
          }
          console.log('User credentials updated successfully.');
        } else {
          throw new Error(
            response.data.message || 'Failed to update credentials.',
          );
        }
      } catch (e: any) {
        console.error(
          'Error updating user credentials:',
          e.response?.data || e,
        );
        throw new Error(
          e.response?.data?.message ||
            'Network error or failed to update credentials.',
        );
      }
    },
    [userToken, internalFetchUserData],
  );

  // --- Existing useEffect to load token ---
  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (token) {
          setUserToken(token);
          await internalFetchUserData(token);
        }
      } catch (e) {
        console.error('Failed to load token from storage:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, [internalFetchUserData]);

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
      updateUserData,
      updateUserCredentials,
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
      updateUserData,
      updateUserCredentials,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
