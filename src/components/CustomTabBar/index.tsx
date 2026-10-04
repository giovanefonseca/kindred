import React, { useState, useEffect, useRef } from 'react';
import {
    Text,
    TouchableOpacity,
    View,
    Modal,
    StyleSheet,
    Animated,
    Easing,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './styles';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { themes } from "../../global/themes";
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Constants, { ExecutionEnvironment } from 'expo-constants';

// No Expo Go o módulo nativo de voz não existe; só carrega em development build
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const SpeechRecognition = IS_EXPO_GO ? null : require('expo-speech-recognition');
const ExpoSpeechRecognitionModule = SpeechRecognition?.ExpoSpeechRecognitionModule;
const useSpeechRecognitionEvent: (name: string, cb: (e: any) => void) => void =
    SpeechRecognition?.useSpeechRecognitionEvent ?? (() => {});


// Componente Modal Adaptável
import { CustomNotificationModal } from '../../components/CustomNotificationModal/CustomNotificationModal';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../contexts/AccessibilityContext';

// Parser de voz (lembretes com data/hora, hidratação, medições, anotações)
import { parseVoiceText } from './voiceParser';

// Firebase Imports
import { doc, setDoc, getDoc, increment } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

// Helper para gerar o ID do dia atual (ex: 2026-10-4) — mesmo formato da sua tela de hidratação
const getTodayId = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

// --- COMPONENTE VISUAL DA SOUNDWAVE / TELA DE GRAVAÇÃO ---
interface RecordingOverlayModalProps {
    visible: boolean;
    onStop: () => void;
    fontScale: number;
    isHighContrast: boolean;
    theme: any;
}

function RecordingOverlayModal({ visible, onStop, fontScale, isHighContrast, theme }: RecordingOverlayModalProps) {
    const bar1 = useRef(new Animated.Value(12)).current;
    const bar2 = useRef(new Animated.Value(28)).current;
    const bar3 = useRef(new Animated.Value(44)).current;
    const bar4 = useRef(new Animated.Value(18)).current;
    const bar5 = useRef(new Animated.Value(52)).current;
    const bar6 = useRef(new Animated.Value(24)).current;
    const bar7 = useRef(new Animated.Value(38)).current;
    const bar8 = useRef(new Animated.Value(16)).current;
    const bar9 = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        if (visible) {
            const createAnimation = (animValue: Animated.Value, minHeight: number, maxHeight: number, duration: number) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.timing(animValue, {
                            toValue: maxHeight,
                            duration,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: false,
                        }),
                        Animated.timing(animValue, {
                            toValue: minHeight,
                            duration,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: false,
                        }),
                    ])
                );
            };

            const anims = [
                createAnimation(bar1, 10, 36, 350),
                createAnimation(bar2, 16, 52, 420),
                createAnimation(bar3, 22, 68, 300),
                createAnimation(bar4, 12, 42, 480),
                createAnimation(bar5, 26, 78, 380),
                createAnimation(bar6, 14, 48, 320),
                createAnimation(bar7, 20, 62, 450),
                createAnimation(bar8, 10, 34, 390),
                createAnimation(bar9, 15, 45, 360),
            ];

            anims.forEach((anim) => anim.start());

            return () => {
                anims.forEach((anim) => anim.stop());
            };
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onStop}>
            <View style={overlayStyles.container}>
                <Text style={[
                    overlayStyles.recordingTitle,
                    { fontSize: 24 * fontScale },
                    isHighContrast && { color: theme.buttonPrimary }
                ]}>
                    GRAVANDO...
                </Text>

                <View style={overlayStyles.soundwaveContainer}>
                    {[bar1, bar2, bar3, bar4, bar5, bar6, bar7, bar8, bar9].map((barAnim, idx) => (
                        <Animated.View
                            key={idx}
                            style={[
                                overlayStyles.bar,
                                { height: barAnim },
                                isHighContrast && { backgroundColor: theme.buttonPrimary }
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[
                        overlayStyles.stopButton,
                        isHighContrast && { backgroundColor: theme.buttonPrimary, borderColor: theme.border, borderWidth: 2 }
                    ]}
                    onPress={onStop}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="square"
                        size={22}
                        color={isHighContrast ? theme.buttonText : "#FFFFFF"}
                    />
                </TouchableOpacity>

                <Text style={[
                    overlayStyles.subText,
                    { fontSize: 16 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    Toque para parar
                </Text>
            </View>
        </Modal>
    );
}

export default ({ state, navigation }: { state: any, navigation: any }) => {
    const { fontScale, isHighContrast, theme } = useAccessibility();
    const insets = useSafeAreaInsets();
    const [isListening, setIsListening] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const [notificationTitle, setNotificationTitle] = useState('Anotação Gravada');
    const [notificationSubtitle, setNotificationSubtitle] = useState('Salvo com sucesso!');
    const [modalIcon, setModalIcon] = useState('check');
    const [savedNoteText, setSavedNoteText] = useState('');

    // Evita salvar duas vezes se o reconhecedor disparar "result" mais de uma vez por gravação
    const handledRef = useRef(false);

    // ==========================================
    // RECONHECIMENTO DE VOZ
    // (requer development build — não funciona no Expo Go)
    // ==========================================
    useSpeechRecognitionEvent("result", (event) => {
        const spokenText = event.results?.[0]?.transcript;
        if (!spokenText || !event.isFinal || handledRef.current) return;
        handledRef.current = true;
        setIsListening(false);
        saveVoiceNoteDirectly(spokenText);
    });

    useSpeechRecognitionEvent("error", (event) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        setIsListening(false);
    });

    useSpeechRecognitionEvent("end", () => {
        setIsListening(false);
    });

    const handleVoicePress = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (isListening) {
            handleStopVoice();
            return;
        }

        try {
            const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!result.granted) {
                Alert.alert("Permissão Necessária", "Permita o uso do microfone para gravar por voz.");
                return;
            }

            handledRef.current = false;
            setIsListening(true);
            ExpoSpeechRecognitionModule.start({
                lang: "pt-BR",
                interimResults: false,
            });
        } catch (error) {
            console.error('Erro ao iniciar voz:', error);
            setIsListening(false);
        }
    };

    const handleStopVoice = () => {
        try {
            ExpoSpeechRecognitionModule.stop();
        } catch (error) {
            console.error('Erro ao parar voz:', error);
            setIsListening(false);
        }
    };

    const go = (screenName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate(screenName);
    };

    const saveVoiceNoteDirectly = async (text: string) => {
        let userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            // Resgata o ID do perfil ativo (Cuidador ou Dependente selecionado)
            const activeDependentId = await AsyncStorage.getItem('@active_user_id');
            if (activeDependentId) {
                userId = activeDependentId;
            }

            const parsedResult = parseVoiceText(text);
            const isoNow = new Date().toISOString();

            if (parsedResult.collectionTarget === 'reminders') {
                const newReminderRef = doc(db, 'users', userId, 'reminders', `reminder_${Date.now()}`);
                await setDoc(newReminderRef, {
                    ...parsedResult.structuredData,
                    criadoEm: isoNow,
                    ativo: true,
                    dadosFormulario: {
                        ...parsedResult.structuredData.dadosFormulario,
                        origem: 'voz_tabbar'
                    }
                });
                // Se a sua tela de lembretes agenda notificação local ao criar,
                // chame essa mesma função aqui usando structuredData.dataAgendamento.
            } else if (parsedResult.collectionTarget === 'hydration') {
                // increment() soma de forma atômica (sem ler antes → sem perder valores concorrentes)
                const addedMl: number = parsedResult.structuredData.quantidadeMl;
                const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());

                await setDoc(waterRef, {
                    total: increment(addedMl),
                    atualizadoEm: isoNow,
                    origem: 'voz_tabbar'
                }, { merge: true });

                const waterSnap = await getDoc(waterRef);
                const newTotal: number = waterSnap.exists() ? (waterSnap.data().total ?? addedMl) : addedMl;
                const fmt = (ml: number) => ml >= 1000 ? `${(ml / 1000).toFixed(1).replace('.', ',')}L` : `${ml}ml`;

                parsedResult.notificationSubtitle =
                    `${fmt(addedMl)} adicionados${parsedResult.structuredData.quantidadeAssumida ? ' (padrão)' : ''}! Total hoje: ${fmt(newTotal)}`;
            } else {
                const newNoteRef = doc(db, 'users', userId, 'notes', `note_${Date.now()}`);
                await setDoc(newNoteRef, {
                    ...parsedResult.structuredData,
                    rawSpeech: text,
                    criadoEm: isoNow,
                    origem: 'voz'
                });
            }

            setNotificationTitle(parsedResult.notificationTitle);
            setNotificationSubtitle(parsedResult.notificationSubtitle);
            setModalIcon(parsedResult.modalIcon);
            setSavedNoteText(parsedResult.structuredData.text || parsedResult.structuredData.title || text);
            setModalVisible(true);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Erro ao salvar no Firestore:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    return (
        <View style={[
            styles.tabArea,
            {
                backgroundColor: theme.cardBackground,
                borderTopColor: theme.border,
                borderTopWidth: 1,
                height: 80 + insets.bottom,
                paddingBottom: insets.bottom,
            }
        ]}>
            {/* BOTÃO 1: INÍCIO */}
            <TouchableOpacity
                style={styles.tabItem}
                onPress={() => go('List')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Ir para a página inicial"
            >
                <FontAwesome
                    name="home"
                    style={{
                        opacity: state.index === 0 ? 1 : 0.3,
                        fontSize: 32,
                        color: theme.buttonPrimary
                    }}
                />
                <Text style={[
                    tabNavStyles.tabLabel,
                    {
                        fontSize: 12 * fontScale,
                        color: theme.buttonPrimary,
                        opacity: state.index === 0 ? 1 : 0.5,
                        fontWeight: state.index === 0 ? 'bold' : 'normal'
                    }
                ]}>
                    Início
                </Text>
            </TouchableOpacity>

            {/* BOTÃO 2: MICROFONE */}
            <TouchableOpacity
                style={[
                    styles.tabItemButton,
                    { backgroundColor: theme.buttonPrimary },
                    isListening && { backgroundColor: '#DC3545' }
                ]}
                onPressIn={handleVoicePress}      // começa a gravar ao encostar
                onPressOut={handleStopVoice}      // para ao soltar
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Gravador de voz para lembretes e medições"
            >
                <View>
                    <FontAwesome name="microphone" style={{ fontSize: 40 * fontScale, color: theme.buttonText }} />
                </View>
            </TouchableOpacity>

            {/* BOTÃO 3: PERFIL */}
            <TouchableOpacity
                style={styles.tabItem}
                onPress={() => go('User')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Ir para o seu perfil"
            >
                <FontAwesome
                    name="user"
                    style={{
                        opacity: state.index === 1 ? 1 : 0.3,
                        fontSize: 32,
                        color: theme.buttonPrimary
                    }}
                />
                <Text style={[
                    tabNavStyles.tabLabel,
                    {
                        fontSize: 12 * fontScale,
                        color: theme.buttonPrimary,
                        opacity: state.index === 1 ? 1 : 0.5,
                        fontWeight: state.index === 1 ? 'bold' : 'normal'
                    }
                ]}>
                    Perfil
                </Text>
            </TouchableOpacity>

            {/* OVERLAY DE SOUNDWAVE DE GRAVAÇÃO */}
            <RecordingOverlayModal
                visible={isListening}
                onStop={handleStopVoice}
                fontScale={fontScale}
                isHighContrast={isHighContrast}
                theme={theme}
            />

            {/* MODAL PADRONIZADO DYNAMIC FEEDBACK */}
            <CustomNotificationModal
                visible={modalVisible}
                title={notificationTitle}
                subtitle={notificationSubtitle}
                iconName={modalIcon}
                iconColor={isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754')}
                closeText="CONCLUÍDO"
                onClose={() => setModalVisible(false)}
            >
                <View style={[
                    noteStyles.detailsContainer,
                    { backgroundColor: theme.background, borderColor: theme.border }
                ]}>
                    <Text style={[
                        noteStyles.detailsText,
                        { fontSize: 16 * fontScale, color: theme.textPrimary }
                    ]}>
                        {savedNoteText}
                    </Text>
                </View>
            </CustomNotificationModal>
        </View>
    );
};

const tabNavStyles = StyleSheet.create({
    tabLabel: {
        marginTop: 2,
        textAlign: 'center',
    },
});

const noteStyles = StyleSheet.create({
    detailsContainer: {
        width: '100%',
        borderRadius: 16,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1
    },
    detailsText: {
        fontWeight: 'bold',
        lineHeight: 22,
        textAlign: 'center'
    },
});

const overlayStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    recordingTitle: {
        color: '#FFFFFF',
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 28,
        textAlign: 'center',
    },
    soundwaveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 90,
        gap: 6,
        marginBottom: 36,
    },
    bar: {
        width: 7,
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
    },
    stopButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    subText: {
        color: '#D0D0D0',
        fontWeight: 'bold',
    },
});