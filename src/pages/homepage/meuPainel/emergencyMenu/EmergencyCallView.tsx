import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { themes } from '../../../../global/themes';

// Contexto Global de Acessibilidade
import { useAccessibility, ThemeColors } from '../../../../contexts/AccessibilityContext';

// Firebase Firestore e Auth
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

interface ResponsibleUser {
    uid: string;
    nome: string;
    photoUrl?: string | null;
}

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO DE EMERGÊNCIA
// ---------------------------------------------------------------------------
interface EmergencyModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    fontScale: number;
    isHighContrast: boolean;
    theme: ThemeColors;
    responsibles: ResponsibleUser[];
    calling: boolean;
}

function EmergencyModal({ 
    visible, 
    onClose, 
    onConfirm, 
    fontScale, 
    isHighContrast, 
    theme, 
    responsibles,
    calling 
}: EmergencyModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={[
                    modalStyles.modalCard,
                    isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 2 }
                ]}>
                    <View style={[
                        modalStyles.iconCircle,
                        isHighContrast && { backgroundColor: theme.buttonPrimary }
                    ]}>
                        <MaterialCommunityIcons name="alert" size={38} color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                    </View>

                    <Text style={[
                        modalStyles.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>CHAMADA DE EMERGÊNCIA</Text>
                    
                    <Text style={[
                        modalStyles.subtitle,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>
                        {responsibles.length > 0 
                            ? `Iniciando chamada simultânea para:\n${responsibles.map(r => `• ${r.nome}`).join('\n')}`
                            : 'Nenhum responsável vinculado para chamada.'}
                    </Text>

                    <View style={modalStyles.buttonRow}>
                        <TouchableOpacity 
                            style={[
                                modalStyles.cancelButton,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                            ]} 
                            onPress={onClose} 
                            disabled={calling}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                modalStyles.cancelText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>CANCELAR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[
                                modalStyles.confirmButton,
                                isHighContrast && { backgroundColor: theme.buttonPrimary },
                                (responsibles.length === 0 || calling) && { opacity: 0.6 }
                            ]} 
                            onPress={onConfirm} 
                            disabled={responsibles.length === 0 || calling}
                            activeOpacity={0.8}
                        >
                            {calling ? (
                                <ActivityIndicator size="small" color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                            ) : (
                                <Text style={[
                                    modalStyles.confirmText,
                                    { fontSize: 16 * fontScale },
                                    isHighContrast && { color: theme.buttonText }
                                ]}>LIGAR AGORA</Text>
                            )}
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
    const [responsibles, setResponsibles] = useState<ResponsibleUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [calling, setCalling] = useState(false);

    // Contexto de Acessibilidade
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const userId = auth.currentUser?.uid;

    useEffect(() => {
        const fetchResponsibles = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                const userDocSnap = await getDoc(doc(db, 'users', userId));

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    const responsibleIds: string[] = userData.responsaveis || [];

                    const loadedResponsibles: ResponsibleUser[] = [];

                    for (const respId of responsibleIds) {
                        const respSnap = await getDoc(doc(db, 'users', respId));
                        if (respSnap.exists()) {
                            const respData = respSnap.data();
                            loadedResponsibles.push({
                                uid: respId,
                                nome: respData.apelido || respData.nome || 'Responsável',
                                photoUrl: respData.photoUrl || null
                            });
                        }
                    }

                    setResponsibles(loadedResponsibles);
                }
            } catch (error) {
                console.error("Erro ao carregar responsáveis:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResponsibles();
    }, [userId]);

    const handleEmergencyCall = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setModalVisible(true);
    };

    const handleConfirmCall = async () => {
        if (!userId || responsibles.length === 0) return;

        setCalling(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            // Dispara um documento de chamada para cada responsável vinculado
            for (const resp of responsibles) {
                await addDoc(collection(db, 'calls'), {
                    callerId: userId,
                    receiverId: resp.uid,
                    status: 'active',
                    createdAt: serverTimestamp(),
                });
            }
        } catch (error) {
            console.error('Erro ao registrar chamada de emergência:', error);
        } finally {
            setCalling(false);
            setModalVisible(false);
        }
    };

    return (
        <SafeAreaView 
            style={[
                styles.screen,
                isHighContrast && { backgroundColor: theme.background }
            ]} 
            edges={['top', 'left', 'right']}
        >
            {/* CABEÇALHO PADRONIZADO */}
            <View style={[
                styles.header,
                isHighContrast && { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }
            ]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Voltar"
                >
                    <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                </TouchableOpacity>
                <Text style={[
                    styles.headerTitle,
                    { fontSize: 20 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>Emergência</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Banner Superior Vermelho */}
                <View style={[
                    styles.topBanner,
                    isHighContrast && { backgroundColor: theme.buttonPrimary }
                ]}>
                    <MaterialCommunityIcons 
                        name="alert" 
                        size={44} 
                        color={isHighContrast ? theme.buttonText : "#FFFFFF"} 
                        style={styles.bannerIcon} 
                    />
                    <Text style={[
                        styles.bannerTitle,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.buttonText }
                    ]}>CONTATOS DE{'\n'}EMERGÊNCIA</Text>
                </View>

                {/* Lista de Contatos dos Responsáveis */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.buttonPrimary} />
                    </View>
                ) : responsibles.length === 0 ? (
                    <Text style={[
                        styles.emptyText,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>
                        Nenhum responsável vinculado no momento.
                    </Text>
                ) : (
                    <View style={styles.contactsRow}>
                        {responsibles.map((resp) => (
                            <View key={resp.uid} style={styles.contactCard}>
                                <Text style={[
                                    styles.contactName,
                                    { fontSize: 14 * fontScale },
                                    isHighContrast && { color: theme.textPrimary }
                                ]} numberOfLines={1}>{resp.nome}</Text>
                                <View style={[
                                    styles.imageWrapper,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                                ]}>
                                    {resp.photoUrl ? (
                                        <Image source={{ uri: resp.photoUrl }} style={styles.contactImage} resizeMode="cover" />
                                    ) : (
                                        <View style={styles.placeholderContainer}>
                                            <MaterialCommunityIcons name="account" size={80} color={theme.textSecondary} />
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Botão de Chamada com Aviso */}
                <TouchableOpacity
                    style={styles.callRow}
                    activeOpacity={0.8}
                    onPress={handleEmergencyCall}
                    accessibilityRole="button"
                    accessibilityLabel="Botão de ligar para contatos de emergência"
                >
                    <View style={[
                        styles.phoneButton,
                        isHighContrast && { backgroundColor: theme.buttonPrimary }
                    ]}>
                        <FontAwesome name="phone" size={28} color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                    </View>
                    <Text style={[
                        styles.callText,
                        { fontSize: 14 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>
                        AO CLICAR NESTE BOTÃO,{'\n'}OS RESPONSÁVEIS SERÃO CHAMADOS
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            <EmergencyModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onConfirm={handleConfirmCall}
                fontScale={fontScale}
                isHighContrast={isHighContrast}
                theme={theme}
                responsibles={responsibles}
                calling={calling}
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
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        paddingVertical: 30,
        textAlign: 'center',
        color: '#666666',
        fontWeight: 'bold',
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
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E0E0E0',
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