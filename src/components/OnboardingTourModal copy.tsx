import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibility } from '../contexts/AccessibilityContext';

const { width } = Dimensions.get('window');

interface OnboardingTourModalProps {
    visible: boolean;
    onClose: () => void;
}

const TOUR_STEPS = [
    {
        icon: 'qrcode-scan',
        title: 'Seu QR Code de Emergência',
        description: 'Ele armazena informações vitais, como contatos de emergência e tipo sanguíneo, para serem lidos em momentos de necessidade.',
    },
    {
        icon: 'account-box-outline',
        title: 'Sua Foto de Perfil',
        description: 'Adicione uma foto nítida e recente para facilitar sua identificação por cuidadores, familiares e socorristas.',
    },
    {
        icon: 'shield-check-outline',
        title: 'Segurança e Praticidade',
        description: 'Tudo fica salvo em nuvem com sincronização automática. Seus dados estão sempre acessíveis quando você precisar!',
    },
];

export function OnboardingTourModal({ visible, onClose }: OnboardingTourModalProps) {
    const { fontScale, isHighContrast, theme } = useAccessibility();
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = async () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            await AsyncStorage.setItem('@has_seen_tour', 'true');
            onClose();
        }
    };

    const handleSkip = async () => {
        await AsyncStorage.setItem('@has_seen_tour', 'true');
        onClose();
    };

    if (!visible) return null;

    const step = TOUR_STEPS[currentStep];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
            <View style={styles.overlay}>
                <View style={[
                    styles.card,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                ]}>
                    {/* Botão de Pular */}
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                        <Text style={[
                            styles.skipText,
                            { fontSize: 14 * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>
                            PULAR
                        </Text>
                    </TouchableOpacity>

                    {/* Ícone Ilustrativo */}
                    <View style={[
                        styles.iconCircle,
                        isHighContrast && { backgroundColor: theme.buttonPrimary }
                    ]}>
                        <MaterialCommunityIcons 
                            name={step.icon as any} 
                            size={56} 
                            color={isHighContrast ? theme.buttonText : "#FFFFFF"} 
                        />
                    </View>

                    {/* Título e Descrição */}
                    <Text style={[
                        styles.title,
                        { fontSize: 22 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>
                        {step.title}
                    </Text>

                    <Text style={[
                        styles.description,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>
                        {step.description}
                    </Text>

                    {/* Indicador de Passos (Dots) */}
                    <View style={styles.dotsContainer}>
                        {TOUR_STEPS.map((_, idx) => (
                            <View
                                key={idx}
                                style={[
                                    styles.dot,
                                    idx === currentStep && styles.activeDot,
                                    isHighContrast && idx === currentStep && { backgroundColor: theme.buttonPrimary }
                                ]}
                            />
                        ))}
                    </View>

                    {/* Botão Avançar / Concluir */}
                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                        ]}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.nextButtonText,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.buttonText }
                        ]}>
                            {currentStep === TOUR_STEPS.length - 1 ? 'ENTENDI, COMEÇAR!' : 'PRÓXIMO'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        elevation: 8,
        position: 'relative',
    },
    skipButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 6,
    },
    skipText: {
        color: '#666',
        fontWeight: 'bold',
    },
    iconCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#0052cc',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#DCDCDC',
    },
    activeDot: {
        width: 24,
        backgroundColor: '#0052cc',
    },
    nextButton: {
        width: '100%',
        backgroundColor: '#0052cc',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});