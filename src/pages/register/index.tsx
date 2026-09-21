import React, { useState } from "react";
import { View, Text, Image, Alert } from 'react-native';
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';

// Importações do seu projeto (ajuste os caminhos se necessário)
import { style } from "./styles";
import Logo from '../../assets/logo.png';
import { themes } from "../../global/themes";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";

// Importações do Firebase
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Caminho do seu arquivo Firebase

export default function Register() {
    const navigation = useNavigation<NavigationProp<any>>();

    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(true);
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!nome || !email || !password) {
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
        <View style={style.container}>
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
                />
                <Input
                    value={email}
                    onChangeText={setEmail}
                    title="ENDEREÇO DE E-MAIL"
                    IconRight={MaterialIcons}
                    IconRightName="email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
                <Input
                    value={password}
                    onChangeText={setPassword}
                    title="SENHA"
                    IconRight={MaterialIcons}
                    IconRightName={showPassword ? "visibility-off" : "visibility"}
                    secureTextEntry={showPassword}
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
                <Text style={style.textBottom}>Já tem uma conta? 
                    <Text 
                        style={{color: themes.colors.notBlack, fontWeight: 'bold'}}
                        onPress={() => navigation.goBack()} // Retorna para a tela de Login
                    > Entre agora!</Text>
                </Text>
            </View>
        </View>
    );
}