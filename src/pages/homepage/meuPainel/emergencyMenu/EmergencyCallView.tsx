import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { themes } from '../../../../global/themes';

// Componente Modal Adaptável Padronizado
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Firebase Firestore e Auth
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

interface ResponsibleUser {
    uid: string;
    nome: string;
    photoUrl?: string | null;
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

                    if (responsibleIds.length === 0) {
                        setResponsibles([]);
                        return;
                    }

                    // BUSCA EM PARALELO VIA PROMISE.ALL (Muito mais rápido que o loop sequencial)
                    const promises = responsibleIds.map((respId) => getDoc(doc(db, 'users', respId)));
                    const snapshots = await Promise.all(promises);

                    const loadedResponsibles: ResponsibleUser[] = [];
                    snapshots.forEach((respSnap) => {
                        if (respSnap.exists()) {
                            const respData = respSnap.data();
                            loadedResponsibles.push({
                                uid: respSnap.id,
                                nome: respData.apelido || respData.nome || 'Responsável',
                                photoUrl: respData.photoUrl || null
                            });
                        }
                    });

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
            // Dispara documentos de chamada em paralelo
            const callPromises = responsibles.map((resp) =>
                addDoc(collection(db, 'calls'), {
                    callerId: userId,
                    receiverId: resp.uid,
                    status: 'active',
                    createdAt: serverTimestamp(),
                })
            );
            await Promise.all(callPromises);
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
                                {/* AQUI: Aumentando a base de 14 para 18 e aplicando fontScale */}
                                <Text style={[
                                    styles.contactName,
                                    { fontSize: 18 * fontScale }, 
                                    isHighContrast && { color: theme.textPrimary }
                                ]} numberOfLines={2}>
                                    {resp.nome}
                                </Text>
                                
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

            {/* MODAL PADRONIZADO DE EMERGÊNCIA VIA CHILDREN */}
            <CustomNotificationModal
                visible={modalVisible}
                title="CHAMADA DE EMERGÊNCIA"
                subtitle={
                    responsibles.length > 0 
                        ? `Iniciando chamada simultânea para:\n${responsibles.map(r => `• ${r.nome}`).join('\n')}`
                        : 'Nenhum responsável vinculado para chamada.'
                }
                iconName="alert"
                iconColor={isHighContrast ? theme.buttonPrimary : (themes.colors.darkRed || '#DC3545')}
                hideDefaultButtons={true}
                onClose={() => setModalVisible(false)}
            >
                <View style={styles.modalButtonRow}>
                    <TouchableOpacity 
                        style={[
                            styles.modalCancelButton,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                        ]} 
                        onPress={() => setModalVisible(false)} 
                        disabled={calling}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.modalCancelText,
                            { fontSize: 16 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>CANCELAR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.modalConfirmButton,
                            isHighContrast && { backgroundColor: theme.buttonPrimary },
                            (responsibles.length === 0 || calling) && { opacity: 0.6 }
                        ]} 
                        onPress={handleConfirmCall} 
                        disabled={responsibles.length === 0 || calling}
                        activeOpacity={0.8}
                    >
                        {calling ? (
                            <ActivityIndicator size="small" color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                        ) : (
                            <Text style={[
                                styles.modalConfirmText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.buttonText }
                            ]}>LIGAR AGORA</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </CustomNotificationModal>
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
    modalButtonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    modalCancelText: {
        color: '#555',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalConfirmButton: {
        flex: 1,
        backgroundColor: themes.colors.darkRed,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalConfirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});