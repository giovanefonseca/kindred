import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { themes } from '../../global/themes'; // Ajuste o caminho

interface CustomNotificationModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    iconFamily?: string;
    iconName?: string;
    onClose: () => void;
    onDelete?: () => void;
}

export function CustomNotificationModal({
    visible,
    title,
    subtitle,
    iconFamily = 'MaterialCommunityIcons',
    iconName = 'bell-outline',
    onClose,
    onDelete,
}: CustomNotificationModalProps) {

    const renderIcon = () => {
        const color = themes.colors.secureGreen || '#198754';
        if (iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={iconName as any} size={36} color={color} />;
        }
        return <MaterialCommunityIcons name={iconName as any} size={42} color={color} />;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalCard}>
                    
                    {/* ÍCONE DE CABEÇALHO */}
                    <View style={styles.iconCircle}>
                        {renderIcon()}
                    </View>

                    {/* TÍTULO E SUBTÍTULO */}
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>

                    {/* BOTÕES DE AÇÃO */}
                    <View style={styles.buttonGroup}>
                        {onDelete && (
                            <TouchableOpacity 
                                style={styles.deleteButton} 
                                onPress={onDelete} 
                                activeOpacity={0.8}
                            >
                                <Text style={styles.deleteText}>EXCLUIR</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                            style={styles.closeButton} 
                            onPress={onClose} 
                            activeOpacity={0.8}
                        >
                            <Text style={styles.closeText}>FECHAR</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)', // Fundo escurecido
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
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.secureGreen || '#198754',
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    closeButton: {
        flex: 1,
        backgroundColor: themes.colors.secureGreen || '#198754',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    deleteButton: {
        flex: 1,
        backgroundColor: themes.colors.darkRed,
        borderWidth: 1.5,
        borderColor: 'transparent',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    deleteText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});