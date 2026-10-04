import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
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

const DANGER_COLOR = themes.colors.darkRed || '#D32F2F';
const TEXT_COLOR = themes.colors.notBlack || '#1A1A1A';

export function EmergencyCallView() {
    const navigation = useNavigation<any>();
    const [modalVisible, setModalVisible] = useState(false);
    const [responsibles, setResponsibles] = useState<ResponsibleUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [calling, setCalling] = useState(false);

    // Contexto de Acessibilidade
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const userId = auth.currentUser?.uid;

    // 1. Animação de Pulso do Botão Inteiro (Loop Infinito)
    const buttonPulseAnim = useRef(new Animated.Value(1)).current;

    // 2. Animação de Compressão ao Pressionar (Scale Press)
    const scalePressAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Loop de pulso do botão inteiro
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(buttonPulseAnim, {
                    toValue: 1.03, // Expande levemente (3%) para um efeito elegante sem estourar o layout
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(buttonPulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        pulseLoop.start();

        return () => pulseLoop.stop();
    }, [buttonPulseAnim]);

    useEffect(() => {
        let cancelled = false;

        const fetchResponsibles = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                const userDocSnap = await getDoc(doc(db, 'users', userId));

                if (!userDocSnap.exists()) {
                    if (!cancelled) setResponsibles([]);
                    return;
                }

                const userData = userDocSnap.data();
                const responsibleIds: string[] = Array.isArray(userData.responsaveis)
                    ? userData.responsaveis.filter(
                          (id: unknown): id is string => typeof id === 'string'
                      )
                    : [];

                if (responsibleIds.length === 0) {
                    if (!cancelled) setResponsibles([]);
                    return;
                }

                const results = await Promise.allSettled(
                    responsibleIds.map((respId) => getDoc(doc(db, 'users', respId)))
                );

                const loadedResponsibles: ResponsibleUser[] = [];
                results.forEach((result) => {
                    if (result.status === 'fulfilled' && result.value.exists()) {
                        const respData = result.value.data();
                        loadedResponsibles.push({
                            uid: result.value.id,
                            nome: respData.apelido || respData.nome || 'Responsável',
                            photoUrl: respData.photoUrl || null,
                        });
                    } else if (result.status === 'rejected') {
                        console.error('Erro ao carregar um responsável:', result.reason);
                    }
                });

                if (!cancelled) setResponsibles(loadedResponsibles);
            } catch (error) {
                console.error('Erro ao carregar responsáveis:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchResponsibles();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const handleEmergencyCall = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setModalVisible(true);
    }, []);

    const handlePressIn = () => {
        Animated.spring(scalePressAnim, {
            toValue: 0.95,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scalePressAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
        }).start();
    };

    const handleConfirmCall = useCallback(async () => {
        if (!userId || responsibles.length === 0 || calling) return;

        setCalling(true);

        try {
            await Promise.all(
                responsibles.map((resp) =>
                    addDoc(collection(db, 'calls'), {
                        callerId: userId,
                        receiverId: resp.uid,
                        status: 'active',
                        createdAt: serverTimestamp(),
                    })
                )
            );

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setModalVisible(false);
        } catch (error) {
            console.error('Erro ao registrar chamada de emergência:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                'Não foi possível chamar',
                'Verifique sua conexão e tente novamente.'
            );
        } finally {
            setCalling(false);
        }
    }, [userId, responsibles, calling]);

    const activeColor = isHighContrast ? theme.buttonPrimary : DANGER_COLOR;

    // Combina o pulso contínuo com a compressão ao clicar
    const combinedScale = Animated.multiply(buttonPulseAnim, scalePressAnim);

    return (
        <SafeAreaView
            style={[
                styles.screen,
                isHighContrast && { backgroundColor: theme.background },
            ]}
            edges={['top', 'left', 'right']}
        >
            {/* CABEÇALHO PADRONIZADO */}
            <View
                style={[
                    styles.header,
                    isHighContrast && {
                        backgroundColor: theme.background,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                    },
                ]}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
                >
                    <Feather
                        name="arrow-left"
                        size={28}
                        color={isHighContrast ? theme.textPrimary : TEXT_COLOR}
                    />
                </TouchableOpacity>
                <Text
                    accessibilityRole="header"
                    style={[
                        styles.headerTitle,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary },
                    ]}
                >
                    Emergência
                </Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* BOTÃO PARA FICHA MÉDICA EM PDF */}
                <TouchableOpacity
                    style={[
                        styles.medicalRecordButton,
                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                    ]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        navigation.navigate('EmergencyFormView');
                    }}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="file-account" size={28} color={isHighContrast ? theme.buttonPrimary : '#0052cc'} />
                    <Text style={[styles.medicalRecordButtonText, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>
                        FICHA DE EMERGÊNCIA (PDF)
                    </Text>
                    <Feather name="chevron-right" size={24} color={isHighContrast ? theme.textSecondary : '#64748B'} />
                </TouchableOpacity>

                {/* Banner Superior Vermelho */}
                <View
                    style={[
                        styles.topBanner,
                        isHighContrast && { backgroundColor: theme.buttonPrimary },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="alert"
                        size={44}
                        color={isHighContrast ? theme.buttonText : '#FFFFFF'}
                        style={styles.bannerIcon}
                    />
                    <Text
                        style={[
                            styles.bannerTitle,
                            { fontSize: 20 * fontScale },
                            isHighContrast && { color: theme.buttonText },
                        ]}
                    >
                        CONTATOS DE EMERGÊNCIA
                    </Text>
                </View>

                {/* Lista de Contatos dos Responsáveis */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.buttonPrimary} />
                    </View>
                ) : responsibles.length === 0 ? (
                    <Text
                        style={[
                            styles.emptyText,
                            { fontSize: 16 * fontScale },
                            isHighContrast && { color: theme.textSecondary },
                        ]}
                    >
                        Nenhum responsável vinculado no momento.
                    </Text>
                ) : (
                    <View style={styles.contactsRow}>
                        {responsibles.map((resp) => (
                            <View key={resp.uid} style={styles.contactCard}>
                                <Text
                                    style={[
                                        styles.contactName,
                                        { fontSize: 18 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                    ]}
                                    numberOfLines={2}
                                >
                                    {resp.nome}
                                </Text>

                                <View
                                    style={[
                                        styles.imageWrapper,
                                        isHighContrast && {
                                            backgroundColor: theme.cardBackground,
                                            borderColor: theme.border,
                                            borderWidth: 1,
                                        },
                                    ]}
                                >
                                    {resp.photoUrl ? (
                                        <Image
                                            source={{ uri: resp.photoUrl }}
                                            style={styles.contactImage}
                                            resizeMode="cover"
                                            accessibilityLabel={`Foto de ${resp.nome}`}
                                        />
                                    ) : (
                                        <View style={styles.placeholderContainer}>
                                            <MaterialCommunityIcons
                                                name="account"
                                                size={80}
                                                color={theme.textSecondary}
                                            />
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* BOTÃO INTEIRO PULSANDO + CLIQUE DIRETO */}
                <TouchableWithoutFeedback
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={handleEmergencyCall}
                    accessibilityRole="button"
                    accessibilityLabel="Ligar para os responsáveis"
                    accessibilityHint="Abre o modal de confirmação de chamada"
                >
                    <Animated.View
                        style={[
                            styles.callButton,
                            {
                                backgroundColor: activeColor,
                                transform: [{ scale: combinedScale }],
                            },
                            isHighContrast && {
                                borderColor: theme.border,
                                borderWidth: 2,
                            },
                        ]}
                    >
                        <FontAwesome
                            name="phone"
                            size={44}
                            color={isHighContrast ? theme.buttonText : '#FFFFFF'}
                        />

                        <Text
                            style={[
                                styles.callButtonText,
                                { fontSize: 24 * fontScale },
                                isHighContrast && { color: theme.buttonText },
                            ]}
                        >
                            LIGAR PARA{'\n'}OS RESPONSÁVEIS
                        </Text>
                    </Animated.View>
                </TouchableWithoutFeedback>

                <Text
                    style={[
                        styles.callWarningText,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textPrimary },
                    ]}
                >
                    AO CLICAR NESTE BOTÃO, OS RESPONSÁVEIS SERÃO CHAMADOS
                </Text>
            </ScrollView>

            {/* MODAL PADRONIZADO DE EMERGÊNCIA */}
            <CustomNotificationModal
                visible={modalVisible}
                title="CHAMADA DE EMERGÊNCIA"
                subtitle={
                    responsibles.length > 0
                        ? `Iniciando chamada simultânea para:\n${responsibles
                              .map((r) => `• ${r.nome}`)
                              .join('\n')}`
                        : 'Nenhum responsável vinculado para chamada.'
                }
                iconName="alert"
                iconColor={isHighContrast ? theme.buttonPrimary : DANGER_COLOR}
                hideDefaultButtons={true}
                onClose={() => !calling && setModalVisible(false)}
            >
                <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                        style={[
                            styles.modalCancelButton,
                            isHighContrast && {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.border,
                                borderWidth: 1,
                            },
                        ]}
                        onPress={() => setModalVisible(false)}
                        disabled={calling}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Cancelar chamada de emergência"
                    >
                        <Text
                            style={[
                                styles.modalCancelText,
                                { fontSize: 20 * fontScale },
                                isHighContrast && { color: theme.textPrimary },
                            ]}
                        >
                            CANCELAR
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.modalConfirmButton,
                            isHighContrast && { backgroundColor: theme.buttonPrimary },
                            (responsibles.length === 0 || calling) && { opacity: 0.6 },
                        ]}
                        onPress={handleConfirmCall}
                        disabled={responsibles.length === 0 || calling}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Ligar agora para os responsáveis"
                    >
                        {calling ? (
                            <ActivityIndicator
                                size="small"
                                color={isHighContrast ? theme.buttonText : '#FFFFFF'}
                            />
                        ) : (
                            <Text
                                style={[
                                    styles.modalConfirmText,
                                    { fontSize: 20 * fontScale },
                                    isHighContrast && { color: theme.buttonText },
                                ]}
                            >
                                LIGAR AGORA
                            </Text>
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
        color: TEXT_COLOR,
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
        backgroundColor: DANGER_COLOR,
        borderRadius: 26,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
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
    medicalRecordButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        backgroundColor: '#F0F4FA',
        borderWidth: 1.5,
        borderColor: '#0052cc',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 18,
        marginBottom: 20,
    },
    medicalRecordButtonText: {
        fontWeight: 'bold',
        color: '#0052cc',
        flex: 1,
        marginLeft: 10,
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
        color: TEXT_COLOR,
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
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 110,
        borderRadius: 24,
        paddingVertical: 20,
        paddingHorizontal: 20,
        gap: 16,
        marginTop: 6,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    callButtonText: {
        flexShrink: 1,
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    callWarningText: {
        width: '100%',
        marginTop: 25,
        paddingHorizontal: 8,
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        color: TEXT_COLOR,
        lineHeight: 22,
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
        paddingVertical: 20,
        minHeight: 64,
        justifyContent: 'center',
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
        backgroundColor: DANGER_COLOR,
        borderRadius: 16,
        paddingVertical: 20,
        minHeight: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalConfirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});