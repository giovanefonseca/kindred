import { StyleSheet } from "react-native";
import { themes } from "../../global/themes";


export const styles = StyleSheet.create({
    boxInput: {
        width: '100%',
        height: 40,
        borderWidth: 1,
        borderRadius: 40,
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        backgroundColor: themes.colors.lightPurple,
        borderColor: themes.colors.primary,
    },
    input: {
        height: '100%',
        width: '90%',
        backgroundColor: 'transparent',
        borderRadius: 40,
        paddingHorizontal: 10,
    },
    titleInput: {
        marginLeft: 5,
        color: themes.colors.notBlack,
        marginTop: 20
    },
    icon: {
        width: '100%'
    }
})