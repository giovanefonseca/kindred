import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { themes } from '../../global/themes';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../contexts/AccessibilityContext';

export interface CustomNotificationModalProps {
    visible: boolean;
    title: string;
    subtitle?: string;
    iconFamily?: 'MaterialCommunityIcons' | 'FontAwesome5';
    iconName?: string;
    iconColor?: string;
    customIcon?: React.ReactNode;
    iconBackgroundColor?: string;
    pulseIcon?: boolean; // Opção para ativar pulso animado no ícone
    animationType?: 'spring' | 'fade'; // Tipo da animação de entrada
    queueCount?: number;
    closeText?: string;
    closeButtonColor?: string;
    hideDefaultButtons?: boolean;
    children?: React.ReactNode;
    onClose: () => void;
    onDelete?: () => void;
}

export function CustomNotificationModal({
    visible,
    title,
    subtitle,
    iconFamily = 'MaterialCommunityIcons',
    iconName = 'bell-outline',
    iconColor,
    customIcon,
    iconBackgroundColor,
    pulseIcon = false,
    animationType = 'spring',
    queueCount = 1,
    closeText,
    closeButtonColor,
    hideDefaultButtons = false,
    children,
    onClose,
    onDelete,
}: CustomNotificationModalProps) {

    // Contexto de Acessibilidade
    const { fontScale, isHighContrast, theme } = useAccessibility();

    // Controle de Visibilidade com Animação de Fechamento
    const [modalVisible, setModalVisible] = useState(visible);

    // Valores Animados
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Dispara animações de entrada e saída conforme prop `visible`
    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            opacityAnim.setValue(0);
            scaleAnim.setValue(0.85);

            const entranceAnimations = [
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ];

            if (animationType === 'spring') {
                entranceAnimations.push(
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 6,
                        tension: 80,
                        useNativeDriver: true,
                    })
                );
            } else {
                entranceAnimations.push(
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 200,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    })
                );
            }

            Animated.parallel(entranceAnimations).start();
        } else {
            Animated.parallel([
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setModalVisible(false);
            });
        }
    }, [visible]);

    // Animação Contínua de Pulso no Ícone
    useEffect(() => {
        let pulseLoop: Animated.CompositeAnimation | null = null;

        if (visible && pulseIcon) {
            pulseLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.12,
                        duration: 600,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 600,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseLoop.start();
        } else {
            pulseAnim.setValue(1);
        }

        return () => {
            if (pulseLoop) pulseLoop.stop();
        };
    }, [visible, pulseIcon]);

    const primaryColor = iconColor || (themes.colors.secureGreen || '#198754');
    const buttonBgColor = closeButtonColor || primaryColor;

    const isLightButtonBg = closeButtonColor === '#F0F0F0' || 
                            closeButtonColor === themes.colors.lightGray || 
                            closeButtonColor === '#FFFFFF';

    const renderIcon = () => {
        if (customIcon) return customIcon;

        const color = isHighContrast ? '#000000' : '#FFFFFF';
        const finalIconName = (isHighContrast && iconFamily === 'MaterialCommunityIcons' && iconName === 'alert-circle-outline')
            ? 'alert-circle'
            : iconName;

        if (iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={finalIconName as any} size={36} color={color} />;
        }
        return <MaterialCommunityIcons name={finalIconName as any} size={40} color={color} />;
    };

    const handleDeletePress = () => {
        if (onDelete) onDelete();
    };

    const handleClosePress = () => {
        onClose();
    };

    if (!modalVisible) return null;

    return (
        <Modal
            visible={modalVisible}
            transparent
            animationType="none" // Desativa a animação nativa do Modal para usar as animações do Animated
            onRequestClose={onClose}
        >
            <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
                <Animated.View style={[
                    styles.modalCard,
                    {
                        transform: [{ scale: scaleAnim }],
                    },
                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                ]}>
                    
                    {/* Indicador visual se houver mais lembretes pendentes */}
                    {queueCount > 1 && (
                        <View style={[
                            styles.badgeContainer,
                            isHighContrast && { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }
                        ]}>
                            <Text style={[
                                styles.badgeText,
                                { fontSize: 13 * fontScale },
                                isHighContrast && { color: theme.buttonPrimary }
                            ]}>
                                + {queueCount - 1} LEMBRETE(S) RESTANTE(S)
                            </Text>
                        </View>
                    )}

                    {/* ÍCONE DE CABEÇALHO ANIMADO */}
                    <Animated.View style={[
                        styles.iconCircle,
                        {
                            backgroundColor: iconBackgroundColor || primaryColor,
                            transform: [{ scale: pulseAnim }],
                        },
                        isHighContrast && !iconBackgroundColor && { backgroundColor: theme.border }
                    ]}>
                        {renderIcon()}
                    </Animated.View>

                    {/* TÍTULO */}
                    <Text style={[
                        styles.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>{title}</Text>

                    {/* SUBTÍTULO */}
                    {subtitle ? (
                        <Text style={[
                            styles.subtitle,
                            { fontSize: 16 * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>{subtitle}</Text>
                    ) : null}

                    {/* CHILDREN PARA ELEMENTOS PERSONALIZADOS */}
                    {children && <View style={styles.childrenContainer}>{children}</View>}

                    {/* BOTÕES DE AÇÃO PADRÃO */}
                    {!hideDefaultButtons && (
                        <View style={styles.buttonGroup}>
                            {onDelete && (
                                <TouchableOpacity 
                                    style={[
                                        styles.deleteButton,
                                        isHighContrast && { backgroundColor: '#000000', borderWidth: 2, borderColor: theme.border }
                                    ]} 
                                    onPress={handleDeletePress} 
                                    activeOpacity={0.8}
                                >
                                    <Text style={[
                                        styles.deleteText,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.buttonPrimary }
                                    ]}>EXCLUIR</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity 
                                style={[
                                    styles.closeButton,
                                    { backgroundColor: buttonBgColor },
                                    isHighContrast && { backgroundColor: theme.buttonPrimary }
                                ]} 
                                onPress={handleClosePress} 
                                activeOpacity={0.8}
                            >
                                <Text style={[
                                    styles.closeText,
                                    { fontSize: 18 * fontScale },
                                    isHighContrast 
                                        ? { color: theme.buttonText } 
                                        : isLightButtonBg 
                                            ? { color: '#1A1A1A' } 
                                            : { color: '#FFFFFF' }
                                ]}>
                                    {closeText || (queueCount > 1 ? 'PRÓXIMO' : 'FECHAR')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
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
        shadowRadius: 6,
    },
    badgeContainer: {
        backgroundColor: '#FFE6D5',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    badgeText: {
        color: themes.colors.orange || '#D97706',
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    iconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#555',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    childrenContainer: {
        width: '100%',
        alignItems: 'center',
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    closeButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    deleteButton: {
        flex: 1,
        backgroundColor: themes.colors.darkRed || '#D9534F',
        borderWidth: 1.5,
        borderColor: 'transparent',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    deleteText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});