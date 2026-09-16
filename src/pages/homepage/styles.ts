import { StyleSheet } from "react-native";
import { themes } from "../../global/themes";

export const style = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themes.colors.bgScreen,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 16,
        letterSpacing: 0.3,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 16,
    },
    card: {
        width: '48%',
        aspectRatio: 1,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
    },
    cardRed: {
        backgroundColor: themes.colors.darkRed,
    },
    cardOrange: {
        backgroundColor: themes.colors.orange,
    },
    cardGreen: {
        backgroundColor: themes.colors.secureGreen,
    },
    cardBlue: {
        backgroundColor: themes.colors.primary,
    },
    cardText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 22,
    },
    calendarIconWrapper: {
        width: 58,
        height: 58,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    bellIconOverlay: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        backgroundColor: themes.colors.secureGreen,
        borderRadius: 8,
    },
    notificationsSection: {
        marginTop: 24,
    },
    notificationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: themes.colors.secureGreen,
        borderRadius: 30,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    notificationText: {
        flex: 1,
        fontSize: 13.5,
        color: '#1A1A1A',
        marginRight: 10,
        fontWeight: '600',
    },
    notificationBold: {
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    highlightDanger: {
        fontWeight: 'bold',
        color: themes.colors.darkRed,
    },
    notificationIconWrapper: {
        width: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
});