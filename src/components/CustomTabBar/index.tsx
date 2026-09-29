import React, { useState } from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator, Modal, StyleSheet, Alert } from 'react-native';
import { styles } from './styles';
import { AntDesign, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { themes } from "../../global/themes";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

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

interface SuccessModalProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

function SuccessModal({ visible, title, message, onClose }: SuccessModalProps) {
    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={modalStyles.iconCircle}>
                        <MaterialCommunityIcons name="check" size={40} color="#FFFFFF" />
                    </View>
                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={modalStyles.subtitle}>Salvo com sucesso!</Text>
                    <View style={modalStyles.detailsContainer}>
                        <Text style={modalStyles.detailsText}>{message}</Text>
                    </View>
                    <TouchableOpacity style={modalStyles.closeButton} onPress={onClose} activeOpacity={0.8}>
                        <Text style={modalStyles.closeText}>CONCLUÍDO</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

export default ({ state, navigation }: { state: any, navigation: any }) => {
    const [isListening, setIsListening] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [savedNoteText, setSavedNoteText] = useState('');

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
        if (isListening) {
            try {
                ExpoSpeechRecognitionModule.stop();
                setIsListening(false);
            } catch (error) {
                console.error('Erro ao parar voz:', error);
            }
        } else {
            try {
                const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
                if (!result.granted) {
                    Alert.alert("Permissão Necessária", "Permita o uso do microfone.");
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
        <View style={styles.tabArea}>
            <TouchableOpacity style={styles.tabItem} onPress={() => go('List')}>
                <AntDesign name="bars" style={{ opacity: state.index === 0 ? 1 : 0.3, fontSize: 32, color: themes.colors.primary }} />
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.tabItemButton, isListening && { backgroundColor: themes.colors.darkRed || '#DC3545' }]} 
                onPress={handleVoicePress}
                activeOpacity={0.8}
            >
                <View>
                    {isListening ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <FontAwesome name="microphone" style={{ fontSize: 40, color: '#fff' }} />
                    )}
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => go('User')}>
                <FontAwesome name="user" style={{ opacity: state.index === 1 ? 1 : 0.3, fontSize: 32, color: themes.colors.primary }} />
            </TouchableOpacity>

            <SuccessModal
                visible={modalVisible}
                title="Anotação Gravada"
                message={savedNoteText}
                onClose={() => setModalVisible(false)}
            />
        </View>
    );
};

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', elevation: 8 },
    iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: themes.colors.secureGreen || '#198754', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 6 },
    subtitle: { fontSize: 16, color: themes.colors.secureGreen || '#198754', textAlign: 'center', marginBottom: 16, fontWeight: 'bold' },
    detailsContainer: { width: '100%', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    detailsText: { fontSize: 16, fontWeight: 'bold', color: '#333333', lineHeight: 22, textAlign: 'center' },
    closeButton: { width: '100%', backgroundColor: themes.colors.secureGreen || '#198754', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    closeText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});