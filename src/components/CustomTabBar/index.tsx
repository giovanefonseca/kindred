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
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import { themes } from "../../global/themes";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

// Componente Modal Adaptável
import { CustomNotificationModal } from '../../components/CustomNotificationModal/CustomNotificationModal';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../contexts/AccessibilityContext';

// Firebase Imports
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

const HEALTH_DICTIONARY = [
    {
        type: 'Glicemia',
        keywords: ['açúcar', 'acucar', 'açúcares', 'acucares', 'glicemia', 'glicose', 'taxa de açúcar', 'sangue', 'furada de dedo', 'insulina', 'dextro', 'dexa']
    },
    {
        type: 'Pressão',
        keywords: ['pressão', 'pressao', 'pressao arterial', 'pressão alta', 'pressão baixa', 'medir pressão', 'tensao', 'sistolica', 'diastolica']
    },
    {
        type: 'Oxigenação',
        keywords: ['oxigênio', 'oxigenio', 'oxigenaçao', 'oxigenacao', 'saturação', 'saturacao', 'saturando', 'oxímetro', 'oximetro', 'spo2', 'oxigenação do sangue']
    },
    {
        type: 'Peso',
        keywords: ['peso', 'pesando', 'pesa', 'quilos', 'kilos', 'kg', 'balança', 'balanca']
    },
    {
        type: 'Temperatura',
        keywords: ['febre', 'temperatura', 'graus', 'termômetro', 'termometro']
    }
];

const parseVoiceText = (text: string): string => {
    const lowerText = text.toLowerCase();
    const matches = lowerText.match(/\d+(\s*por\s*\d+)?/g);
    const valorEncontrado = matches ? matches[0] : null;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStampFormatted = `${day}/${month} ${hours}:${minutes}`;

    for (const entry of HEALTH_DICTIONARY) {
        const hasKeyword = entry.keywords.some((kw) => lowerText.includes(kw));
        if (hasKeyword) {
            if (valorEncontrado) {
                return `${entry.type} ${valorEncontrado} - ${timeStampFormatted}`;
            }
            return `${entry.type} (sem valor informado) - ${timeStampFormatted}`;
        }
    }

    return `${text} - ${timeStampFormatted}`;
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
    // Animações para as 9 barras da soundwave
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
                {/* Título GRAVANDO... */}
                <Text style={[
                    overlayStyles.recordingTitle, 
                    { fontSize: 24 * fontScale },
                    isHighContrast && { color: theme.buttonPrimary }
                ]}>
                    GRAVANDO...
                </Text>

                {/* Soundwave Animada */}
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

                {/* Botão Vermelho Parar (Stop) */}
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

                {/* Subtítulo auxiliar */}
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
    const [savedNoteText, setSavedNoteText] = useState('');

    
    
    // É AQUI QUE EU TENHO QUE DESCOMENTAR PRA LEITURA DO AUDIO FUNCIONAR:



    // useSpeechRecognitionEvent("result", (event) => {
    //     if (event.results && event.results[0]?.transcript) {
    //         const spokenText = event.results[0].transcript;
    //         setIsListening(false);
    //         saveVoiceNoteDirectly(spokenText);
    //     }
    // });

    // useSpeechRecognitionEvent("error", (event) => {
    //     console.error("Erro no reconhecimento de voz:", event.error);
    //     setIsListening(false);
    // });

    // useSpeechRecognitionEvent("end", () => {
    //     setIsListening(false);
    // });

    const handleVoicePress = async () => {
        if (isListening) {
            handleStopVoice();
        } else {
            // try {
            //     const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            //     if (!result.granted) {
            //         Alert.alert("Permissão Necessária", "Permita o uso do microfone.");
            //         return;
            //     }

                setIsListening(true);
            //     ExpoSpeechRecognitionModule.start({
            //         lang: "pt-BR",
            //         interimResults: false,
            //     });
            // } catch (error) {
            //     console.error('Erro ao iniciar voz:', error);
            //     setIsListening(false);
            // }
        }
    };

    const handleStopVoice = () => {
        // try {
        //     ExpoSpeechRecognitionModule.stop();
        // } catch (error) {
        //     console.error('Erro ao parar voz:', error);
        // } finally {
            setIsListening(false);
            // Simulação de teste para salvar texto obtido via voz
            // saveVoiceNoteDirectly("Glicemia 110");
        // }
    };



    // É AQUI QUE EU TENHO QUE DESCOMENTAR PRA LEITURA DO AUDIO FUNCIONAR:



    const go = (screenName: string) => {
        navigation.navigate(screenName);
    };

    const saveVoiceNoteDirectly = async (text: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const formattedNote = parseVoiceText(text);

        try {
            const newDocRef = doc(db, 'users', userId, 'notes', `note_${Date.now()}`);
            await setDoc(newDocRef, {
                text: formattedNote,
                rawSpeech: text,
                criadoEm: new Date().toISOString(),
                origem: 'voz'
            });

            setSavedNoteText(formattedNote);
            setModalVisible(true);
        } catch (error) {
            console.error('Erro ao salvar anotação por voz:', error);
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
            <TouchableOpacity style={styles.tabItem} onPress={() => go('List')}>
                <AntDesign name="bars" style={{ opacity: state.index === 0 ? 1 : 0.3, fontSize: 32, color: theme.buttonPrimary }} />
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.tabItemButton, { backgroundColor: theme.buttonPrimary }, isListening && { backgroundColor: '#DC3545' }]} 
                onPress={handleVoicePress}
                activeOpacity={0.8}
            >
                <View>
                    <FontAwesome name="microphone" style={{ fontSize: 40 * fontScale, color: theme.buttonText }} />
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => go('User')}>
                <FontAwesome name="user" style={{ opacity: state.index === 1 ? 1 : 0.3, fontSize: 32, color: theme.buttonPrimary }} />
            </TouchableOpacity>

            {/* OVERLAY COM SOUNDWAVE QUANDO ESTIVER GRAVANDO */}
            <RecordingOverlayModal
                visible={isListening}
                onStop={handleStopVoice}
                fontScale={fontScale}
                isHighContrast={isHighContrast}
                theme={theme}
            />

            {/* MODAL PADRONIZADO COM CHILDREN DE SUCESSO DA ANOTAÇÃO */}
            <CustomNotificationModal
                visible={modalVisible}
                title="Anotação Gravada"
                subtitle="Salvo com sucesso!"
                iconName="check"
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