import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { CustomNotificationModal } from '../components/CustomNotificationModal/CustomNotificationModal';
import { themes } from '../global/themes';

interface OnboardingTourModalProps {
    visible: boolean;
    onClose: () => void;
}

const TOUR_STEPS = [
    {
        icon: 'alert-circle-outline',
        color: themes.colors.darkRed, // Vermelho Emergência
        title: 'EMERGÊNCIA',
        subtitle: 'Acesso rápido para momentos decisivos.',
        description: 'Sua ficha médica, contatos de emergência e tipo sanguíneo ficam prontos para socorristas e familiares acessarem.',
    },
    {
        icon: 'notebook-outline',
        color: themes.colors.orange, // Laranja Anotação
        title: 'ANOTAÇÕES',
        subtitle: 'Anote recados e lembretes do dia a dia.',
        description: 'Guarde observações médicas, sintomas ou pequenos avisos importantes de forma simples e organizada em um só lugar.',
    },
    {
        icon: 'bell-outline',
        color: themes.colors.secureGreen, // Verde Lembretes
        title: 'LEMBRETES',
        subtitle: 'Nunca mais perca o horário de um remédio.',
        description: 'Programe alarmes para seus medicamentos, consultas e compromissos diários com alertas sonoros em tempo real.',
    },
    {
        icon: 'water-outline',
        color: themes.colors.primary, // Azul Hidratação
        title: 'HIDRATAÇÃO',
        subtitle: 'Cuide da sua saúde bebendo água.',
        description: 'Acompanhe seu consumo diário de água, defina sua meta e receba lembretes periódicos para se manter sempre hidratado.',
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
            setCurrentStep(0);
            onClose();
        }
    };

    const handleSkip = async () => {
        await AsyncStorage.setItem('@has_seen_tour', 'true');
        setCurrentStep(0);
        onClose();
    };

    if (!visible) return null;

    const step = TOUR_STEPS[currentStep];

    return (
        <CustomNotificationModal
            visible={visible}
            title={step.title}
            subtitle={step.subtitle}
            iconName={step.icon}
            iconColor={isHighContrast ? theme.buttonPrimary : step.color}
            closeText="PULAR TOUR"
            closeButtonColor={isHighContrast ? undefined : '#CBD5E1'}
            onClose={handleSkip}
        >
            <View style={styles.container}>
                {/* Texto descritivo da funcionalidade */}
                <Text style={[
                    styles.descriptionText,
                    { fontSize: 16 * fontScale },
                    isHighContrast && { color: theme.textSecondary }
                ]}>
                    {step.description}
                </Text>

                {/* Indicador de Progresso (PONTOS / DOTS) */}
                <View style={styles.dotsContainer}>
                    {TOUR_STEPS.map((_, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.dot,
                                idx === currentStep && [
                                    styles.activeDot,
                                    { backgroundColor: isHighContrast ? theme.buttonPrimary : step.color }
                                ],
                            ]}
                        />
                    ))}
                </View>

                {/* Botão de Ação Principal (Avançar / Concluir) */}
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        { backgroundColor: isHighContrast ? theme.buttonPrimary : step.color }
                    ]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text style={[
                        styles.actionButtonText,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.buttonText }
                    ]}>
                        {currentStep === TOUR_STEPS.length - 1 ? 'CONCLUIR TOUR' : 'PRÓXIMO'}
                    </Text>
                </TouchableOpacity>
            </View>
        </CustomNotificationModal>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 8,
    },
    descriptionText: {
        fontSize: 16,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#CBD5E1',
    },
    activeDot: {
        width: 26,
        height: 10,
        borderRadius: 5,
    },
    actionButton: {
        width: '100%',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});