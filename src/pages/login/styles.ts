import { StyleSheet, Dimensions } from "react-native";
import { themes } from "../../global/themes";

export const style = StyleSheet.create({
    container:{
        flex:1,
        alignItems: 'center',
        padding: 20
    },
    boxTop: {
        height:Dimensions.get('window').height/3,
        width: '100%',
        //backgroundColor: 'red',
        alignItems: 'center',
        justifyContent: 'center',
    },
    boxMid: {
        height:Dimensions.get('window').height/4,
        width: '100%',
        //backgroundColor: 'green',
        padding: 35
    },
    boxBottom: {
        height:Dimensions.get('window').height/3,
        width: '100%',
        //backgroundColor: 'blue',
        alignItems: 'center',
        marginTop: 40,
    },
    logoImagem: {
        height: 100,
        width: 80
    },
    fonteTitulo: {
        fontWeight: 'bold',
        marginTop: 20,
        fontSize: 18
    },
    textBottom: {
        marginTop: 150,
        fontSize: 16,
        color: 'gray',
        alignItems: 'center',
        justifyContent: 'center',
    },
})