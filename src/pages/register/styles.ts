import { StyleSheet } from "react-native";
import { themes } from "../../global/themes";

export const style = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 30,
        // backgroundColor: themes.colors.secondary,
    },
    boxTop: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 120,
        marginBottom: 20,
    },
    boxMid: {
        width: '100%',
        paddingHorizontal: 20,
        // Removido alignItems: 'center' para manter o alinhamento padrão à esquerda
    },
    boxBottom: {
        width: '100%',
        alignItems: 'center',
        marginTop: 'auto', // Garante que apenas este bloco vá para o rodapé
        paddingBottom: 50,
    },
    logoImagem: {
        height: 100,
        width: 80,
        resizeMode: 'contain',
    },
    fonteTitulo: {
        fontWeight: 'bold',
        marginTop: 20,
        fontSize: 24,
    },
    button: {
        width: '100%',
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0052cc', // ajuste para a cor do seu tema
        borderRadius: 25,
        marginTop: 30, // Controla a distância exata entre o campo de senha e o botão
    },
    textBottom: {
        fontSize: 18,
        color: 'gray',
        textAlign: 'center',
    },
    boxButton: {
        justifyContent: 'center',
        alignItems: 'center'
    },
});