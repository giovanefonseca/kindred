import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { themes } from '../global/themes';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';

export function VoiceActionButton() {
    const { isListening, isProcessingAI, toggleListening } = useVoiceAssistant();

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[
                    styles.micButton,
                    isListening && styles.micButtonListening
                ]}
                activeOpacity={0.8}
                onPress={toggleListening}
                disabled={isProcessingAI}
                accessibilityRole="button"
                accessibilityLabel="Assistente de Voz"
                accessibilityHint="Toque para falar com o assistente inteligente"
            >
                {isProcessingAI ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                    <Feather 
                        name="mic" 
                        size={32} 
                        color={isListening ? '#FF4444' : '#FFFFFF'} 
                    />
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -30, // Elevação sobre a TabBar conforme a imagem
    },
    micButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#0056b3', // Azul da imagem
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        borderWidth: 4,
        borderColor: '#FFFFFF', // Borda branca ao redor
    },
    micButtonListening: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FF4444',
    },
});