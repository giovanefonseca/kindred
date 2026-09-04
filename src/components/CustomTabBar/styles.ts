import { StyleSheet } from "react-native";
import { themes } from "../../global/themes";


export const styles = StyleSheet.create({
    tabArea: {
        flexDirection:'row',
        height: 80,
        justifyContent: 'space-around',
    },
    tabItem:{
        flex:1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabItemButton:{
        width: 100,
        height: 100,
        borderRadius: 70,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        top: -50,
        backgroundColor: themes.colors.primary,
    }
})