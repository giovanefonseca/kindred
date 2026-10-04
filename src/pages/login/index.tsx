import React, { useState, useEffect } from "react";
import {
    Text,
    View,
    Image,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from "@react-navigation/native";

import Logo from '../../assets/kindred-logo.png';
import { themes } from "../../global/themes";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";

// Firebase
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../../config/firebaseConfig";

const { height } = Dimensions.get('window');

export default function Login() {
    const navigation = useNavigation<NavigationProp<any>>();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(true);
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        // Se já existir um usuário em cache local no aparelho, entra imediatamente
        if (auth.currentUser) {
            navigation.reset({ routes: [{ name: "BottomRoutes" }] });
            setCheckingAuth(false);
            return;
        }

        // Caso contrário, escuta a alteração de estado do Firebase
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                navigation.reset({ routes: [{ name: "BottomRoutes" }] });
            } else {
                setCheckingAuth(false);
            }
        });

        return () => unsubscribe();
    }, [navigation]);

    async function getLogin() {
        if (!email || !password || email.trim() === '' || password.trim() === '') {
            return Alert.alert('Atenção', 'Preencha todos os campos!');
        }

        try {
            setLoading(true);
            await signInWithEmailAndPassword(auth, email.trim(), password);
            navigation.reset({ routes: [{ name: "BottomRoutes" }] });
        } catch (error: any) {
            console.log("Erro no login:", error);
            if (error.code === 'auth/network-request-failed') {
                Alert.alert('Sem Conexão', 'Você precisa de internet para fazer o primeiro login.');
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                Alert.alert('Erro', 'E-mail ou senha incorretos.');
            } else if (error.code === 'auth/invalid-email') {
                Alert.alert('Erro', 'Formato de e-mail inválido.');
            } else {
                Alert.alert('Erro', 'Não foi possível fazer login. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    }

    if (checkingAuth) {
        return (
            <View style={style.loadingContainer}>
                <ActivityIndicator size="large" color={themes.colors.primary || '#0052CC'} />
            </View>
        );
    }

    return (
        <SafeAreaView style={style.safeArea} edges={['top', 'left', 'right', 'bottom']}>
            <KeyboardAvoidingView
                style={style.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : "padding"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={style.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View style={style.innerContainer}>
                        <View style={style.boxTop}>
                            <Image 
                                source={Logo}
                                style={style.logoImagem}
                                resizeMode="contain"
                            />
                            <Text style={style.fonteTitulo}>Seja bem-vindo!</Text>
                        </View>

                        <View style={style.boxMid}>
                            <Input
                                value={email}
                                onChangeText={setEmail}
                                title="ENDEREÇO DE E-MAIL"
                                IconRight={MaterialIcons}
                                IconRightName="email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <Input
                                value={password}
                                onChangeText={setPassword}
                                title="SENHA"
                                IconRight={MaterialIcons}
                                IconRightName={showPassword ? "visibility-off" : "visibility"}
                                secureTextEntry={showPassword}
                                autoCapitalize="none"
                                onIconRightPress={() => setShowPassword(!showPassword)}
                            />

                            <View style={style.boxButton}>
                                <Button 
                                    text="ENTRAR"
                                    loading={loading}
                                    onPress={getLogin}
                                />
                            </View>
                        </View>

                        <View style={style.boxBottom}>
                            <Text style={style.textBottom}>
                                Não tem conta?{' '}
                                <Text 
                                    style={style.textLink}
                                    onPress={() => navigation.navigate('Register')}
                                >
                                    Crie agora!
                                </Text>
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

export const style = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    innerContainer: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        minHeight: height * 0.85,
    },
    boxTop: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: height * 0.05,
    },
    logoImagem: {
        height: height * 0.12,
        width: 100,
    },
    fonteTitulo: {
        fontWeight: 'bold',
        marginTop: 14,
        fontSize: 24,
        color: themes.colors.notBlack || '#1A1A1A',
    },
    boxMid: {
        width: '100%',
        paddingHorizontal: 28,
        marginVertical: 20,
    },
    boxButton: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 30,
    },
    boxBottom: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 24,
        marginTop: 10,
    },
    textBottom: {
        fontSize: 18,
        color: 'gray',
        textAlign: 'center',
    },
    textLink: {
        color: themes.colors.notBlack || '#1A1A1A',
        fontWeight: 'bold',
    },
});