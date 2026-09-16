import React from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { themes } from '../../../global/themes';

const kenisonImg = require('../../../assets/kenison.png');
const franciscaImg = require('../../../assets/francisca.png');

export function EmergencyCallView() {
    const handleEmergencyCall = () => {
        Alert.alert(
            'CHAMADA DE EMERGÊNCIA',
            'Iniciando chamada simultânea para:\n• Kenison (filho)\n• Francisca (filha)',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Ligar Agora', onPress: () => console.log('Ligando para emergência...') },
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Banner Superior Vermelho */}
            <View style={styles.topBanner}>
                <MaterialCommunityIcons name="alert" size={44} color="#FFFFFF" style={styles.bannerIcon} />
                <Text style={styles.bannerTitle}>CONTATOS DE{'\n'}EMERGÊNCIA</Text>
            </View>

            {/* Lista de Contatos dos Filhos */}
            <View style={styles.contactsRow}>
                {/* Contato 1 */}
                <View style={styles.contactCard}>
                    <Text style={styles.contactName}>Kenison (filho)</Text>
                    <View style={styles.imageWrapper}>
                        <Image
                            source={kenisonImg}
                            style={styles.contactImage}
                            resizeMode="cover"
                        />
                    </View>
                </View>

                {/* Contato 2 */}
                <View style={styles.contactCard}>
                    <Text style={styles.contactName}>Francisca (filha)</Text>
                    <View style={styles.imageWrapper}>
                        <Image
                            source={franciscaImg}
                            style={styles.contactImage}
                            resizeMode="cover"
                        />
                    </View>
                </View>
            </View>

            {/* Botão de Chamada com Aviso */}
            <TouchableOpacity
                style={styles.callRow}
                activeOpacity={0.8}
                onPress={handleEmergencyCall}
                accessibilityRole="button"
                accessibilityLabel="Botão de ligar para contatos de emergência"
                accessibilityHint="Ao clicar neste botão, ambos os filhos serão chamados"
            >
                <View style={styles.phoneButton}>
                    <FontAwesome name="phone" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.callText}>
                    AO CLICAR NESTE BOTÃO,{'\n'}AMBOS SERÃO CHAMADOS
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
    },
    topBanner: {
        width: '100%',
        backgroundColor: themes.colors.darkRed,
        borderRadius: 50,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    bannerIcon: {
        marginBottom: 6,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 0.5,
        lineHeight: 24,
    },
    contactsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 24,
        gap: 16,
    },
    contactCard: {
        flex: 1,
        alignItems: 'center',
    },
    contactName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 8,
        textAlign: 'center',
    },
    imageWrapper: {
        width: '100%',
        height: 300,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#EAEAEA',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    contactImage: {
        width: '100%',
        height: '100%',
    },
    callRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginTop: 6,
        paddingHorizontal: 4,
    },
    phoneButton: {
        width: 58,
        height: 58,
        borderRadius: 16,
        backgroundColor: themes.colors.darkRed,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    callText: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        lineHeight: 19,
        letterSpacing: 0.2,
    },
});

