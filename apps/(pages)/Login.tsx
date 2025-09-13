import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
    View,
    Text, 
    TextInput,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Styles from '../styles/styles';

import { useAuth } from '../context/AuthContext';

import {LoginScreenProps, RootStackNavigationProp} from '../navigation/types';

function Login() {
    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');

    const { signIn, isSigningIn, error } = useAuth();

    const navigation = useNavigation<RootStackNavigationProp>();

    const handleLogin = async () => {
        if (!emailOrUsername || !password) {
            Alert.alert('Login Failed', 'Please enter your email and password.');
            return;
        }
        try {
            await signIn(emailOrUsername, password);
        } catch (error: any) {
            console.error("Login failed in component:", error);
        }
    };

    useEffect(() => {
        if (error && !isSigningIn) {
            Alert.alert("Error", error);
        }
    }, [error, isSigningIn]);

    return (
        <SafeAreaView style={[Styles.container, localStyles.safeArea]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={localStyles.keyboardAvoidingView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={localStyles.scrollViewContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[Styles.formBox, localStyles.formBox]}>
                        <View style={Styles.fieldsContainer}>
                            <Text style={Styles.text}>Login</Text>

                            <Text style={Styles.text}>Email</Text>
                            <TextInput
                                style={Styles.inputFields}
                                placeholder="Enter your email"
                                placeholderTextColor={Styles.inputFields.borderColor}
                                value={emailOrUsername}
                                onChangeText={setEmailOrUsername}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            
                            <Text style={Styles.text}>Password</Text>
                            <TextInput
                                style={Styles.inputFields}
                                placeholder="Enter your password"
                                placeholderTextColor={Styles.inputFields.borderColor}
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                            </View>

                            <View style={{alignItems: 'center',}}>
                            <TouchableOpacity
                                onPress={() => Alert.alert('Feature Coming Soon!')}
                            >
                                <Text style={Styles.register}>Forgot Your Password?</Text>
                            </TouchableOpacity>
                            </View>

                        <View style={localStyles.buttonContainer}>
                            <TouchableOpacity
                                onPress={handleLogin}
                                disabled={isSigningIn}
                                style={[
                                    Styles.button,
                                    localStyles.loginButton,
                                    isSigningIn && { opacity: 0.7 }
                                ]}
                            >
                                {isSigningIn ? (
                                    <ActivityIndicator size="small" color={Styles.buttonText.color} />
                                ) : (
                                    <Text style={Styles.buttonText}>Login</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={localStyles.registerLinkContainer}>
                        <Text style={Styles.registerText}>Don't have an account? </Text>
                         <TouchableOpacity
                              onPress={() => navigation.navigate('Registration')}
                         >
                            <Text style={Styles.register}>Register Here</Text>
                         </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
            <StatusBar style="auto" />
        </SafeAreaView>
    );
}

const localStyles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    keyboardAvoidingView: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
    },
    scrollViewContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 20,
        width: '100%',
    },
    formBox: {
        width: 350,
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    buttonContainer: {
        marginTop: 20,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginButton: {
    },
    registerLinkContainer: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default Login;