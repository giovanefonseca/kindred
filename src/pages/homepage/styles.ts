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
        fontSize: 16,
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
            backgroundColor: themes.colors.darkRed,
            padding: 15,
            borderRadius: 16,
            marginBottom: 15,
            alignItems: 'flex-start',
        },
        dashboardCardNote: {
            width: cardWidth,
            backgroundColor: themes.colors.orange,
            padding: 15,
            borderRadius: 16,
            marginBottom: 15,
            alignItems: 'flex-start',
        },
        dashboardCardReminder: {
            width: cardWidth,
            backgroundColor: themes.colors.secureGreen,
            padding: 15,
            borderRadius: 16,
            marginBottom: 15,
            alignItems: 'flex-start',
        },
        dashboardCardHidro: {
            width: cardWidth,
            backgroundColor: themes.colors.primary,
            padding: 15,
            borderRadius: 16,
            marginBottom: 15,
            alignItems: 'flex-start',
        },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff', // Cor de destaque dos números
        marginBottom: 4,
    },
    cardLabel: {
        fontSize: 13,
        color: '#ffffff',
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
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    calendarIconWrapper: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bellIconOverlay: {
        position: 'absolute',
        bottom: -4,
        right: -8,
        backgroundColor: 'transparent',
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
        borderRadius: 12,
        marginBottom: 12,
    },
    notificationText: {
        flex: 1,
        fontSize: 14,
        color: '#333333',
        marginRight: 10,
    },
    notificationBold: {
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    notificationIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E8F5E9', // Fundo circular verdinho para o ícone
        alignItems: 'center',
        justifyContent: 'center',
    },
});