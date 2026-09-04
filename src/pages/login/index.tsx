import React from "react";

import {
    Text,
    View,
    Image,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';

import { style } from "./styles";
import Logo from '../../assets/logo.png'
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { themes } from "../../global/themes";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { useNavigation,NavigationProp } from "@react-navigation/native";

export default function Login (){

    const navigation = useNavigation<NavigationProp<any>>();

    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(true);
    const [loading, setLoading] = React.useState(false);

    async function getLogin(){
        try {
            setLoading(true)

            if(!email || !password){
                return Alert.alert('Atenção','Preencha todos os campos!')
            }

            navigation.reset({routes: [{name:"BottomRoutes"}] });

            // setTimeout(()=> {
            //     if(email == 'giovane' && password == '123') {
            //         Alert.alert('Sucesso','Login realizado com sucesso!')
            //     } else {
            //         Alert.alert('Erro','Email ou senha incorretos!')
            //     }
            //     setLoading(false)
            // },3000)
            
        } catch (error) {
            console.log(error)
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

                />
                <Input
                    value={password}
                    onChangeText={setPassword}
                    title="SENHA"
                    IconRight={MaterialIcons}
                    IconRightName={showPassword ? "visibility-off" : "visibility"}
                    secureTextEntry={showPassword}
                    onIconRightPress={()=>setShowPassword(!showPassword)}
                />
            </View>

            <View style={style.boxBottom}>
                <Button 
                    text="ENTRAR"
                    loading={loading}
                    onPress={()=> {
                        if (!email || !password || email.trim() === '' || password.trim() === '') {
                            Alert.alert('Atenção','Por favor, preencha o e-mail e a senha.');
                        } else {
                            getLogin();
                        }
                    }}
                />

                <Text style={style.textBottom}>Não tem conta? <Text style={{color: themes.colors.notBlack}}>Crie agora!</Text></Text>
            </View>
        </View>
    )
}