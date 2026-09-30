import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
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

    const primaryColor = iconColor || (themes.colors.secureGreen || '#198754');
    const buttonBgColor = closeButtonColor || primaryColor;

    // Determina se a cor de fundo do botão de fechar é clara (ex: #F0F0F0 ou cinza claro)
    const isLightButtonBg = closeButtonColor === '#F0F0F0' || 
                            closeButtonColor === themes.colors.lightGray || 
                            closeButtonColor === '#FFFFFF';

    const renderIcon = () => {
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

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[
                    styles.modalCard,
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

                    {/* ÍCONE DE CABEÇALHO */}
                    <View style={[
                        styles.iconCircle,
                        { backgroundColor: primaryColor },
                        isHighContrast && { backgroundColor: theme.border }
                    ]}>
                        {renderIcon()}
                    </View>

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

                    {/* BOTÕES DE AÇÃO */}
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

                </View>
            </View>
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