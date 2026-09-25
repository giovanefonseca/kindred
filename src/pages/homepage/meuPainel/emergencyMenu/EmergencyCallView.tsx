import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

const kenisonImg = require('../../../../assets/kenison.png');
const franciscaImg = require('../../../../assets/francisca.png');

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO DE EMERGÊNCIA
// ---------------------------------------------------------------------------
interface EmergencyModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

function EmergencyModal({ visible, onClose, onConfirm }: EmergencyModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={modalStyles.iconCircle}>
                        <MaterialCommunityIcons name="alert" size={38} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>CHAMADA DE EMERGÊNCIA</Text>
                    <Text style={modalStyles.subtitle}>
                        Iniciando chamada simultânea para:{'\n'}
                        • Kenison (filho){'\n'}
                        • Francisca (filha)
                    </Text>

                    <View style={modalStyles.buttonRow}>
                        <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose} activeOpacity={0.8}>
                            <Text style={modalStyles.cancelText}>CANCELAR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={modalStyles.confirmButton} onPress={onConfirm} activeOpacity={0.8}>
                            <Text style={modalStyles.confirmText}>LIGAR AGORA</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export function EmergencyCallView() {
    const navigation = useNavigation();
    const [modalVisible, setModalVisible] = useState(false);

    const handleEmergencyCall = () => {
        setModalVisible(true);
    };

    const handleConfirmCall = () => {
        setModalVisible(false);
        console.log('Ligando para emergência...');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>

            {/* CABEÇALHO PADRONIZADO */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Voltar"
                >
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Emergência</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Banner Superior Vermelho */}
                <View style={styles.topBanner}>
                    <MaterialCommunityIcons name="alert" size={44} color="#FFFFFF" style={styles.bannerIcon} />
                    <Text style={styles.bannerTitle}>CONTATOS DE{'\n'}EMERGÊNCIA</Text>
                </View>

                {/* Lista de Contatos dos Filhos */}
                <View style={styles.contactsRow}>
                    <View style={styles.contactCard}>
                        <Text style={styles.contactName}>Kenison (filho)</Text>
                        <View style={styles.imageWrapper}>
                            <Image source={kenisonImg} style={styles.contactImage} resizeMode="cover" />
                        </View>
                    </View>

                    <View style={styles.contactCard}>
                        <Text style={styles.contactName}>Francisca (filha)</Text>
                        <View style={styles.imageWrapper}>
                            <Image source={franciscaImg} style={styles.contactImage} resizeMode="cover" />
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
            </ScrollView>

            <EmergencyModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onConfirm={handleConfirmCall}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        position: 'relative',
        zIndex: 10,
    },
    backButton: {
        position: 'absolute',
        left: 20,
        padding: 4,
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.notBlack,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    headerShadow: {
        position: 'absolute',
        bottom: -6,
        left: 0,
        right: 0,
        height: 6,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
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

// ---------------------------------------------------------------------------
// ESTILOS DO MODAL DE EMERGÊNCIA
// ---------------------------------------------------------------------------
const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 2,
        borderColor: 'transparent',
        padding: 24,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6
    },
    iconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: themes.colors.darkRed,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#555',
        textAlign: 'left',
        width: '100%',
        marginBottom: 24,
        lineHeight: 24,
        paddingHorizontal: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    cancelText: {
        color: '#555',
        fontSize: 16,
        fontWeight: 'bold'
    },
    confirmButton: {
        flex: 1,
        backgroundColor: themes.colors.darkRed,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center'
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
});