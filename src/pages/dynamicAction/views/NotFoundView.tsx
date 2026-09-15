import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { themes } from '../../../global/themes';

interface NotFoundViewProps {
    onGoBack: () => void;
}

export function NotFoundView({ onGoBack }: NotFoundViewProps) {
    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={72} color={themes.colors.darkRed} />
            </View>
            <Text style={styles.title}>Página Não Encontrada (404)</Text>
            <Text style={styles.description}>
                A rota solicitada não existe ou ainda não foi mapeada no sistema de configuração.
            </Text>
            <TouchableOpacity
                style={styles.backButton}
                activeOpacity={0.8}
                onPress={onGoBack}
                accessibilityRole="button"
                accessibilityLabel="Voltar para o início"
            >
                <Text style={styles.backButtonText}>VOLTAR PARA O INÍCIO</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
    },
    backButton: {
        backgroundColor: themes.colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 25,
        elevation: 2,
    },
    backButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

