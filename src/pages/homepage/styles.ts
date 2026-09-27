import { StyleSheet, Dimensions } from 'react-native';
import { themes } from "../../global/themes";
const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2; // Calcula a largura exata para caberem 2 por linha com os espaçamentos

export const style = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 10,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginTop: 25,
        marginBottom: 15,
        textTransform: 'uppercase',
    },

    // --- ESTILOS DO MEU PAINEL ---
    dashboardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 10,
    },

    //--- ESTILO BOTÕES ----
        dashboardCardSecurity: {
            width: cardWidth,
            backgroundColor: themes.colors.lightGray,
            padding: 15,
            borderRadius: 30,
            marginBottom: 15,
            alignItems: 'flex-start',
            borderColor: themes.colors.darkRed,
            borderWidth: 4,
        },
        dashboardCardNote: {
            width: cardWidth,
            backgroundColor: themes.colors.lightGray,
            padding: 15,
            borderRadius: 30,
            marginBottom: 15,
            alignItems: 'flex-start',
            borderColor: themes.colors.orange,
            borderWidth: 4,
        },
        dashboardCardReminder: {
            width: cardWidth,
            backgroundColor: themes.colors.lightGray,
            padding: 15,
            borderRadius: 30,
            marginBottom: 15,
            alignItems: 'flex-start',
            borderColor: themes.colors.secureGreen,
            borderWidth: 4,
        },
        dashboardCardHidro: {
            width: cardWidth,
            backgroundColor: themes.colors.lightGray,
            padding: 15,
            borderRadius: 30,
            marginBottom: 15,
            alignItems: 'flex-start',
            borderColor: themes.colors.primary,
            borderWidth: 4,
        },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000000', // Cor de destaque dos números
        marginBottom: 4,
    },
    cardLabel: {
        fontSize: 20,
        color: '#000000',
        fontWeight: '500',
    },

    // --- ESTILOS DAS AÇÕES RÁPIDAS ---
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: cardWidth,
        height: cardWidth, // Deixa os botões perfeitamente quadrados
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
        padding: 10,
        elevation: 3, // Sombra para Android
        shadowColor: '#000', // Sombras para iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    cardText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 20,
        marginTop: 12,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    calendarIconWrapper: {
        position: 'relative',
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bellIconOverlay: {
        position: 'absolute',
        bottom: 2,
        right: -2,
        backgroundColor: themes.colors.secureGreen,
        borderRadius: 10,
        padding: 2,
    },

    // --- ESTILOS DAS NOTIFICAÇÕES ---
    notificationsSection: {
        marginTop: 10,
    },
    emptyText: {
        textAlign: 'center',
        color: '#888888',
        marginTop: 15,
        fontSize: 14,
    },
    notificationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F5F5',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 50,
        marginBottom: 12,
        borderWidth: 2, // Define a espessura do contorno
        borderColor: themes.colors.secureGreen // Substitui o outlineColor
    },
    notificationText: {
        flex: 1,
        fontSize: 18,
        color: '#333333',
        marginRight: 10,
        paddingHorizontal: 10,
    },
    notificationBold: {
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    notificationIconWrapper: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },

    saveButtonText: { color: '#ff0000', fontSize: 24, fontWeight: 'bold', letterSpacing: 0.5 }
});