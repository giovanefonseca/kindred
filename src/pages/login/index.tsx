import React from "react";
import {
    Text,
    View,
    Image,
    Alert,
} from 'react-native';

import { style } from "./styles";
import Logo from '../../assets/logo.png';
import { MaterialIcons } from '@expo/vector-icons';
import { themes } from "../../global/themes";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { useNavigation, NavigationProp } from "@react-navigation/native";

// 1. IMPORTAR O FIREBASE (Ajuste o caminho do seu ficheiro de configuração)
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebaseConfig"; // <-- Substitua pelo caminho correto do seu ficheiro

export default function Login() {
    const navigation = useNavigation<NavigationProp<any>>();

    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(true);
    const [loading, setLoading] = React.useState(false);

    // 2. FUNÇÃO DE LOGIN ATUALIZADA COM FIREBASE
    async function getLogin() {
        if (!email || !password || email.trim() === '' || password.trim() === '') {
            return Alert.alert('Atenção', 'Preencha todos os campos!');
        }

        try {
            setLoading(true);

            // Tenta fazer o login no Firebase
            await signInWithEmailAndPassword(auth, email.trim(), password);

            // Se der sucesso, vai para as rotas principais
            navigation.reset({ routes: [{ name: "BottomRoutes" }] });
            
        } catch (error: any) {
            console.log("Erro no login:", error);
            // Tratamento de erros comuns do Firebase
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                Alert.alert('Erro', 'E-mail ou senha incorretos.');
            } else if (error.code === 'auth/invalid-email') {
                Alert.alert('Erro', 'Formato de e-mail inválido.');
            } else {
                Alert.alert('Erro', 'Não foi possível fazer login. Tente novamente.');
            }
        } finally {
            setLoading(false); // Para o loading independentemente de sucesso ou erro
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
                        text="ENTRAR"
                        loading={loading}
                        onPress={getLogin} // A validação de campos vazios já está dentro da função getLogin
                    />
                </View>
            </View>

            <View style={style.boxBottom}>
                {/* Adicionado onPress para navegar para a tela de criar conta */}
                <Text style={style.textBottom}>Não tem conta? 
                    <Text 
                        style={{color: themes.colors.notBlack, fontWeight: 'bold'}}
                        onPress={() => navigation.navigate('Register')} // <-- Ajuste para o nome da sua rota de cadastro
                    > Crie agora!</Text>
                </Text>
            </View>
        </View>
    );
}