import React, { useState } from "react";
import { 
    View, 
    Text, 
    Image, 
    Alert, 
    StyleSheet, 
    KeyboardAvoidingView, 
    ScrollView, 
    Platform, 
    Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';

// Importações do projeto
import Logo from '../../assets/logo.png';
import { themes } from "../../global/themes";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";

// Importações do Firebase
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebaseConfig";

const { height } = Dimensions.get('window');

export default function Register() {
    const navigation = useNavigation<NavigationProp<any>>();

    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(true);
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!nome || !email || !password || nome.trim() === '' || email.trim() === '' || password.trim() === '') {
            return Alert.alert('Atenção', 'Preencha todos os campos!');
        }

        try {
            setLoading(true);

            // 1. Cria a conta no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;

            // 2. Salva os dados extras no Firestore usando o UID do usuário
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                nome: nome.trim(),
                email: email.trim(),
                role: "user",
                criadoEm: new Date().toISOString()
            });

            Alert.alert('Sucesso', 'Conta criada com sucesso!');
            
            // Redireciona para o painel principal após criar a conta
            navigation.reset({ routes: [{ name: "BottomRoutes" }] });

        } catch (error: any) {
            console.log("Erro ao registrar:", error);
            if (error.code === 'auth/email-already-in-use') {
                Alert.alert('Erro', 'Este e-mail já está cadastrado.');
            } else if (error.code === 'auth/weak-password') {
                Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
            } else if (error.code === 'auth/invalid-email') {
                Alert.alert('Erro', 'Formato de e-mail inválido.');
            } else {
                Alert.alert('Erro', 'Não foi possível criar a conta. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={style.safeArea} edges={['top', 'left', 'right', 'bottom']}>
            <KeyboardAvoidingView
                style={style.keyboardView}
                behavior="padding"
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
                            <Text style={style.fonteTitulo}>Crie sua conta</Text>
                        </View>

                        <View style={style.boxMid}>
                            <Input
                                value={nome}
                                onChangeText={setNome}
                                title="NOME COMPLETO"
                                IconRight={MaterialIcons}
                                IconRightName="person"
                                autoCapitalize="words"
                                underlineColorAndroid="transparent"
                            />
                            <Input
                                value={email}
                                onChangeText={setEmail}
                                title="ENDEREÇO DE E-MAIL"
                                IconRight={MaterialIcons}
                                IconRightName="email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                underlineColorAndroid="transparent"
                            />
                            <Input
                                value={password}
                                onChangeText={setPassword}
                                title="SENHA"
                                IconRight={MaterialIcons}
                                IconRightName={showPassword ? "visibility-off" : "visibility"}
                                secureTextEntry={showPassword}
                                autoCapitalize="none"
                                underlineColorAndroid="transparent"
                                onIconRightPress={() => setShowPassword(!showPassword)}
                            />

                            <View style={style.boxButton}>
                                <Button 
                                    text="CADASTRAR"
                                    loading={loading}
                                    onPress={handleRegister}
                                />
                            </View>
                        </View>

                        <View style={style.boxBottom}>
                            <Text style={style.textBottom}>
                                Já tem uma conta?{' '}
                                <Text 
                                    style={style.textLink}
                                    onPress={() => navigation.goBack()}
                                >
                                    Entre agora!
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
        minHeight: height * 0.88,
    },
    boxTop: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: height * 0.08,
    },
    logoImagem: {
        height: height * 0.11,
        width: 100,
    },
    fonteTitulo: {
        fontWeight: 'bold',
        marginTop: 12,
        fontSize: 24,
        color: themes.colors.notBlack || '#1A1A1A',
    },
    boxMid: {
        width: '100%',
        paddingHorizontal: 28,
        marginVertical: 16,
    },
    boxButton: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
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