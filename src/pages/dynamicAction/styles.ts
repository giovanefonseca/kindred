import { StyleSheet } from 'react-native';
import { themes } from '../../global/themes';

export const style = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themes.colors.bgScreen,
    },
    topNavBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        letterSpacing: 0.3,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 30,
        alignItems: 'center',
    },
});
