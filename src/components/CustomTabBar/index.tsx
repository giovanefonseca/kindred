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
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import * as Haptics from 'expo-haptics';

// Componente Modal Adaptável
import { CustomNotificationModal } from '../../components/CustomNotificationModal/CustomNotificationModal';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../contexts/AccessibilityContext';

// Firebase Imports
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

// ---------------------------------------------------------------------------
// ESTRUTURAÇÃO E EXTRAÇÃO DE INTENÇÃO (VOZ -> FIRESTORE)
// ---------------------------------------------------------------------------
interface ParsedVoiceResult {
    collectionTarget: 'notes' | 'reminders';
    recordType: string;
    notificationTitle: string;
    notificationSubtitle: string;
    modalIcon: string;
    structuredData: any;
}

const parseVoiceText = (rawText: string): ParsedVoiceResult => {
    const text = rawText.toLowerCase();
    const now = new Date();

    // ==========================================
    // 1. LEMBRETES (Remédios, Consultas, Exames)
    // ==========================================
    if (text.includes('lembrete') || text.includes('lembrar') || text.includes('agendar')) {
        let targetDate = new Date(now);
        let timeString = '--:--';

        if (text.includes('amanhã') || text.includes('amanha')) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        const timeMatch = text.match(/(?:às|as|para as|para às)?\s*(\d{1,2})(?:[:h](\d{2}))?\s*(?:horas?|h)?/i);
        if (timeMatch) {
            const hour = parseInt(timeMatch[1], 10);
            const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            targetDate.setHours(hour, min, 0, 0);
            timeString = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        } else {
            targetDate.setHours(targetDate.getHours() + 1);
            timeString = `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;
        }

        if (text.includes('remédio') || text.includes('remedio') || text.includes('medicamento')) {
            const dosagemMatch = text.match(/(\d+(?:,\d+)?\s*(?:mg|g|ml|gotas?|cp|comprimidos?))/i);
            const dosagem = dosagemMatch ? dosagemMatch[1] : '';

            const nomeMatch = text.match(/(?:remédio|remedio|medicamento|tomar)\s+([a-z\u00C0-\u017F]+(?:\s+[a-z\u00C0-\u017F]+)*?)(?=\s+\d|\s+às|\s+as|\s+amanhã|\s+hoje|$)/i);
            const nomeRemedio = nomeMatch ? nomeMatch[1].trim() : 'Medicamento';

            return {
                collectionTarget: 'reminders',
                recordType: 'Medicação',
                notificationTitle: 'Lembrete de Remédio',
                notificationSubtitle: `${nomeRemedio} ${dosagem} agendado para ${timeString}`,
                modalIcon: 'bell-outline',
                structuredData: {
                    title: `Tomar ${nomeRemedio}`,
                    categoryKey: 'Medicação',
                    dataAgendamento: targetDate.toISOString(),
                    dadosFormulario: {
                        medicamento: nomeRemedio,
                        dosagem: dosagem,
                        horario: timeString,
                        instrucoes: rawText,
                    }
                }
            };
        }

        return {
            collectionTarget: 'reminders',
            recordType: 'Outros',
            notificationTitle: 'Lembrete Criado',
            notificationSubtitle: `Agendado para ${timeString}`,
            modalIcon: 'bell-outline',
            structuredData: {
                title: rawText.charAt(0).toUpperCase() + rawText.slice(1),
                categoryKey: 'Outros',
                dataAgendamento: targetDate.toISOString(),
                dadosFormulario: { horario: timeString, descricao: rawText }
            }
        };
    }

    // ==========================================
    // 2. MEDIÇÕES E HIDRATAÇÃO
    // ==========================================

    // Pressão Arterial
    const pressaoMatch = text.match(/(\d{1,3})\s*(?:por|x|\/|com)\s*(\d{1,3})/i);
    if (text.includes('pressão') || text.includes('pressao') || pressaoMatch) {
        let sis = null, dia = null;
        if (pressaoMatch) {
            sis = parseInt(pressaoMatch[1], 10);
            dia = parseInt(pressaoMatch[2], 10);
            if (sis < 30) sis *= 10;
            if (dia < 20) dia *= 10;
        }
        return {
            collectionTarget: 'notes',
            recordType: 'Pressão Arterial',
            notificationTitle: 'Pressão Registrada',
            notificationSubtitle: sis ? `${sis}/${dia} mmHg salvo com sucesso.` : 'Anotação salva.',
            modalIcon: 'check',
            structuredData: {
                text: sis ? `Pressão aferida: ${sis}/${dia} mmHg` : rawText,
                tipoMedicao: 'Pressão Arterial',
                dados: sis ? { sistolica: sis, diastolica: dia, observacao: rawText } : { observacao: rawText }
            }
        };
    }

    // Glicemia
    const glicemiaMatch = text.match(/(\d{2,3})\s*(?:mg|glicemia|glicose|açúcar|acucar)/i);
    if (text.includes('glicemia') || text.includes('glicose') || text.includes('açúcar') || text.includes('acucar')) {
        const valor = glicemiaMatch ? parseInt(glicemiaMatch[1], 10) : null;
        return {
            collectionTarget: 'notes',
            recordType: 'Glicemia',
            notificationTitle: 'Glicemia Registrada',
            notificationSubtitle: valor ? `${valor} mg/dL salvo com sucesso.` : 'Anotação salva.',
            modalIcon: 'check',
            structuredData: {
                text: valor ? `Glicemia: ${valor} mg/dL` : rawText,
                tipoMedicao: 'Glicemia',
                dados: valor ? { glicemia: valor, valorMgDl: valor, observacao: rawText } : { observacao: rawText }
            }
        };
    }

    // Hidratação
    const aguaMatch = text.match(/(\d{1,4})\s*(ml|mililitros|litros?|l)/i);
    if (text.includes('água') || text.includes('agua') || text.includes('hidratação') || text.includes('hidratacao')) {
        let ml = null;
        if (aguaMatch) {
            ml = parseInt(aguaMatch[1], 10);
            if (aguaMatch[2].startsWith('l')) ml *= 1000;
        }
        return {
            collectionTarget: 'notes',
            recordType: 'Hidratação',
            notificationTitle: 'Hidratação Registrada',
            notificationSubtitle: ml ? `${ml}ml de água registrados.` : 'Mantenha-se hidratado!',
            modalIcon: 'check',
            structuredData: {
                text: ml ? `Ingestão de ${ml}ml de água` : rawText,
                tipoMedicao: 'Hidratação',
                dados: ml ? { quantidadeMl: ml, observacao: rawText } : { observacao: rawText }
            }
        };
    }

    // Peso
    if (text.includes('peso') || text.includes('quilos') || text.includes('kg')) {
        const pesoMatch = text.match(/(\d{2,3}(?:[.,]\d{1,2})?)/);
        const peso = pesoMatch ? pesoMatch[1] : null;
        return {
            collectionTarget: 'notes',
            recordType: 'Peso',
            notificationTitle: 'Peso Registrado',
            notificationSubtitle: peso ? `${peso} kg salvo com sucesso.` : 'Anotação salva.',
            modalIcon: 'check',
            structuredData: {
                text: rawText,
                tipoMedicao: 'Peso',
                dados: peso ? { peso: peso } : {}
            }
        };
    }

    // Anotação Geral
    return {
        collectionTarget: 'notes',
        recordType: 'Anotação de Voz',
        notificationTitle: 'Anotação Gravada',
        notificationSubtitle: 'Salvo com sucesso!',
        modalIcon: 'check',
        structuredData: {
            text: rawText,
            tipoMedicao: 'Anotação de Voz',
            dados: { notas: rawText }
        }
    };
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

    // ==========================================
    // RECONHECIMENTO DE VOZ (ATIVO E FUNCIONAL) // PRA VOZ FUNCIONAR
    // ==========================================

    useSpeechRecognitionEvent("result", (event) => {
        if (event.results && event.results[0]?.transcript) {
            const spokenText = event.results[0].transcript;
            setIsListening(false);
            saveVoiceNoteDirectly(spokenText);
        }
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
        } else {
            try {
                const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
                if (!result.granted) {
                    Alert.alert("Permissão Necessária", "Permita o uso do microfone para gravar por voz.");
                    return;
                }

                setIsListening(true);
                ExpoSpeechRecognitionModule.start({
                    lang: "pt-BR",
                    interimResults: false,
                });
            } catch (error) {
                console.error('Erro ao iniciar voz:', error);
                setIsListening(false);
            }
        }
    };

    const handleStopVoice = () => {
        try {
            // ExpoSpeechRecognitionModule.stop();
        } catch (error) {
            console.error('Erro ao parar voz:', error);
        } finally {
            setIsListening(false);
        }
    };

    const go = (screenName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate(screenName);
    };

    const saveVoiceNoteDirectly = async (text: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const parsedResult = parseVoiceText(text);
        const isoNow = new Date().toISOString();

        try {
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
                onPress={handleVoicePress} // PRA VOZ FUNCIONAR
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