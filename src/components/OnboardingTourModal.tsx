import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    Animated,
    Easing,
    ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { CustomNotificationModal } from '../components/CustomNotificationModal/CustomNotificationModal';
import { themes } from '../global/themes';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface OnboardingTourModalProps {
    visible: boolean;
    onClose: () => void;
}

const TOUR_STEPS = [
    {
        useLogoInHeader: true,
        color: themes.colors.primary || '#0052cc',
        title: 'BEM-VINDO AO KINDRED!',
        subtitle: 'Seu assistente de saúde e rotina.',
        questionText: 'Para que serve este aplicativo?',
        description: 'O Kindred foi feito para ajudar você a cuidar da sua rotina, tomar remédios no horário certo, anotar recados e manter sua segurança sempre em primeiro lugar. Vamos ver o que cada botão faz?',
        buttonText: 'INICIAR GUIA RÁPIDO',
    },
    {
        icon: 'alert-circle-outline',
        color: themes.colors.darkRed,
        title: 'BOTÃO DE EMERGÊNCIA',
        subtitle: 'Acesso rápido para momentos decisivos.',
        questionText: 'O que este botão faz?',
        description: 'Abre sua ficha médica vital (tipo sanguíneo, alergias e convênio) e permite ligar diretamente para seus contatos de emergência cadastrados com um único toque.',
        buttonText: 'ENTENDI, PRÓXIMO',
    },
    {
        icon: 'notebook-outline',
        color: themes.colors.orange,
        title: 'BOTÃO DE ANOTAÇÕES',
        subtitle: 'Anote recados e lembretes do dia a dia.',
        questionText: 'O que este botão faz?',
        description: 'Permite guardar orientações médicas, nomes de exames, sintomas ou avisos importantes de forma simples e organizada.',
        buttonText: 'ENTENDI, PRÓXIMO',
    },
    {
        icon: 'bell-outline',
        color: themes.colors.secureGreen,
        title: 'BOTÃO DE LEMBRETES',
        subtitle: 'Nunca mais perca o horário do seu remédio.',
        questionText: 'O que este botão faz?',
        description: 'Programe alarmes para seus medicamentos e consultas. Na hora exata, o aplicativo emitirá um som e mostrará um aviso na tela para você confirmar.',
        buttonText: 'ENTENDI, PRÓXIMO',
    },
    {
        icon: 'water-outline',
        color: themes.colors.primary,
        title: 'BOTÃO DE HIDRATAÇÃO',
        subtitle: 'Cuide da sua saúde bebendo água.',
        questionText: 'O que este botão faz?',
        description: 'Acompanhe quantos copos de água você já bebeu no dia, veja seu progresso e receba lembretes para manter o corpo bem hidratado.',
        buttonText: 'ENTENDI, PRÓXIMO',
    },
    {
        icon: 'account-cog-outline',
        color: '#8B5CF6',
        isAccessibilityInteractive: true,
        title: 'PERFIL E ACESSIBILIDADE',
        subtitle: 'Deixe o aplicativo do seu jeito!',
        questionText: 'Como ajustar para enxergar melhor?',
        description: 'No seu Perfil você pode alterar o tamanho da fonte e ativar o modo de Alto Contraste para facilitar a leitura.',
        buttonText: 'COMEÇAR A USAR O APP',
    },
];

// Componente individual para animar a largura de cada dot
function AnimatedDot({ isActive, activeColor }: { isActive: boolean; activeColor: string }) {
    const widthAnim = useRef(new Animated.Value(isActive ? 26 : 10)).current;

    useEffect(() => {
        Animated.timing(widthAnim, {
            toValue: isActive ? 26 : 10,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
        }).start();
    }, [isActive]);

    return (
        <Animated.View
            style={[
                styles.dot,
                {
                    width: widthAnim,
                    backgroundColor: isActive ? activeColor : '#CBD5E1',
                },
            ]}
        />
    );
}

export function OnboardingTourModal({ visible, onClose }: OnboardingTourModalProps) {
    const {
        fontScale,
        fontSizeMode,
        changeFontSize,
        isHighContrast,
        toggleHighContrast,
        theme,
    } = useAccessibility();

    const [currentStep, setCurrentStep] = useState(0);

    // Valores de Animação para o conteúdo da página
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    // Dispara a animação de transição a cada troca de passo
    useEffect(() => {
        fadeAnim.setValue(0);
        slideAnim.setValue(20);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 280,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [currentStep]);

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

    const handleIncreaseFont = () => {
        if (fontSizeMode === 'normal') changeFontSize('large');
        else if (fontSizeMode === 'large') changeFontSize('xlarge');
    };

    const handleDecreaseFont = () => {
        if (fontSizeMode === 'xlarge') changeFontSize('large');
        else if (fontSizeMode === 'large') changeFontSize('normal');
    };

    if (!visible) return null;

    const step = TOUR_STEPS[currentStep];

    const renderHeaderLogo = () => (
        <Image
            source={require('../assets/kindred-logo.png')}
            style={styles.headerLogoImage}
            resizeMode="contain"
        />
    );

    const activeColor = isHighContrast ? theme.buttonPrimary : step.color;

    return (
        <CustomNotificationModal
            visible={visible}
            title={step.title}
            subtitle={step.subtitle}
            iconName={step.useLogoInHeader ? undefined : step.icon}
            customIcon={step.useLogoInHeader ? renderHeaderLogo() : undefined}
            iconColor={step.useLogoInHeader ? '#FFFFFF' : activeColor}
            iconBackgroundColor={step.useLogoInHeader ? '#FFFFFF' : undefined}
            closeText={currentStep === 0 ? "PULAR INTRODUÇÃO" : "PULAR TUTORIAL"}
            closeButtonColor={isHighContrast ? undefined : '#CBD5E1'}
            onClose={handleSkip}
        >
            <View style={styles.container}>
                {/* ScrollView encapsula o conteúdo editável para não quebrar em telas baixas */}
                <ScrollView 
                    style={styles.scrollWrapper}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* CONTEÚDO DA PÁGINA COM ANIMAÇÃO DE FADE + SLIDE */}
                    <Animated.View
                        style={[
                            styles.animatedContent,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateX: slideAnim }],
                            },
                        ]}
                    >
                        {/* Pergunta Guia/Tutorial */}
                        <Text
                            style={[
                                styles.questionText,
                                { fontSize: 17 * fontScale, color: activeColor },
                            ]}
                        >
                            {step.questionText}
                        </Text>

                        {/* Texto descritivo da funcionalidade */}
                        <Text
                            style={[
                                styles.descriptionText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.textSecondary },
                            ]}
                        >
                            {step.description}
                        </Text>

                        {/* BLOCO INTERATIVO DE TESTE PRÁTICO (PASSO DE ACESSIBILIDADE) */}
                        {step.isAccessibilityInteractive && (
                            <View
                                style={[
                                    styles.interactiveBox,
                                    isHighContrast && {
                                        backgroundColor: theme.cardBackground,
                                        borderColor: theme.border,
                                        borderWidth: 1.5,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.interactiveTitle,
                                        { fontSize: 15 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                    ]}
                                >
                                    👇 Clique abaixo para ver como fica na prática:
                                </Text>

                                {/* BOTÃO TESTAR ALTO CONTRASTE */}
                                <TouchableOpacity
                                    style={[
                                        styles.testButton,
                                        isHighContrast
                                            ? { backgroundColor: '#FFFF00', borderColor: '#FFFFFF', borderWidth: 2 }
                                            : { backgroundColor: '#8B5CF6' },
                                    ]}
                                    onPress={toggleHighContrast}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons
                                        name={isHighContrast ? "eye-off-outline" : "eye-outline"}
                                        size={22}
                                        color={isHighContrast ? "#000000" : "#FFFFFF"}
                                    />
                                    <Text
                                        style={[
                                            styles.testButtonText,
                                            { fontSize: 15 * fontScale },
                                            isHighContrast ? { color: "#000000" } : { color: "#FFFFFF" },
                                        ]}
                                    >
                                        {isHighContrast ? "Desativar Alto Contraste" : "Ativar Alto Contraste"}
                                    </Text>
                                </TouchableOpacity>

                                {/* CONTROLES TESTAR TAMANHO DA FONTE */}
                                <View style={styles.fontControlsRow}>
                                    <Text
                                        style={[
                                            styles.fontLabelText,
                                            { fontSize: 14 * fontScale },
                                            isHighContrast && { color: theme.textPrimary },
                                        ]}
                                        numberOfLines={2}
                                    >
                                        Tamanho da Fonte:
                                    </Text>

                                    <View style={styles.fontButtonsGroup}>
                                        <TouchableOpacity
                                            style={[
                                                styles.fontControlBtn,
                                                fontSizeMode === 'normal' && { opacity: 0.5 },
                                                isHighContrast && {
                                                    backgroundColor: theme.buttonPrimary,
                                                    borderColor: theme.border,
                                                },
                                            ]}
                                            onPress={handleDecreaseFont}
                                            disabled={fontSizeMode === 'normal'}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.fontControlBtnText,
                                                    isHighContrast && { color: theme.buttonText },
                                                ]}
                                            >
                                                A-
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.fontControlBtn,
                                                fontSizeMode === 'xlarge' && { opacity: 0.5 },
                                                isHighContrast && {
                                                    backgroundColor: theme.buttonPrimary,
                                                    borderColor: theme.border,
                                                },
                                            ]}
                                            onPress={handleIncreaseFont}
                                            disabled={fontSizeMode === 'xlarge'}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.fontControlBtnText,
                                                    isHighContrast && { color: theme.buttonText },
                                                ]}
                                            >
                                                A+
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}
                    </Animated.View>
                </ScrollView>

                {/* Indicador de Progresso (PONTOS / DOTS) FIXOS NA PARTE INFERIOR */}
                <View style={styles.dotsContainer}>
                    {TOUR_STEPS.map((_, idx) => (
                        <AnimatedDot
                            key={idx}
                            isActive={idx === currentStep}
                            activeColor={activeColor}
                        />
                    ))}
                </View>

                {/* Botão de Ação Principal FIXO */}
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        { backgroundColor: activeColor },
                    ]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text
                        style={[
                            styles.actionButtonText,
                            { fontSize: 17 * fontScale },
                            isHighContrast && { color: theme.buttonText },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                    >
                        {step.buttonText}
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
        paddingTop: 4,
        maxHeight: 480, // Limita altura para telas de celulares menores
    },
    scrollWrapper: {
        width: '100%',
        maxHeight: 320, // Mantém o Scroll contido na área do texto
    },
    scrollContent: {
        alignItems: 'center',
        paddingHorizontal: 2,
        paddingBottom: 8,
    },
    animatedContent: {
        width: '100%',
        alignItems: 'center',
    },
    headerLogoImage: {
        width: 46,
        height: 46,
    },
    questionText: {
        fontSize: 17,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    descriptionText: {
        fontSize: 16,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 16,
    },
    interactiveBox: {
        width: '100%',
        backgroundColor: '#f0f0f0',
        borderRadius: 18,
        padding: 14,
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    interactiveTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#6B21A8',
        textAlign: 'center',
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        elevation: 2,
    },
    testButtonText: {
        fontSize: 15,
        fontWeight: '900',
        flexShrink: 1, // Permite encolher em telas pequenas
        textAlign: 'center',
    },
    fontControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 4,
        flexWrap: 'wrap', // Permite quebra de linha caso o texto fique gigante
        gap: 8,
    },
    fontLabelText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#5B21B6',
        flex: 1, // Ocupa espaço proporcional
    },
    fontButtonsGroup: {
        flexDirection: 'row',
        gap: 8,
    },
    fontControlBtn: {
        backgroundColor: '#8B5CF6',
        width: 44,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fontControlBtnText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
        marginBottom: 14,
    },
    dot: {
        height: 10,
        borderRadius: 5,
    },
    actionButton: {
        width: '100%',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 12,
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
        textAlign: 'center',
    },
});