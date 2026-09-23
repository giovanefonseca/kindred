import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../../../global/themes';
import { BaseSubformProps, PressaoFormData } from './types';

export function PressaoForm({ data, onChange, errors }: BaseSubformProps<PressaoFormData>) {
    const [showDetails, setShowDetails] = useState(false);
    const diastolicaInputRef = useRef<TextInput>(null);

    const handleSistolicaChange = (val: string) => {
        onChange({ ...data, sistolica: val });
        // Pula automaticamente para o próximo campo ao preencher 3 dígitos (ex: 120)
        if (val.length >= 3) {
            diastolicaInputRef.current?.focus();
        }
    };

    return (
        <View style={styles.container}>
            {/* NÚMERO MAIOR (SISTÓLICA) */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    NÚMERO MAIOR (Máxima) <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    style={[styles.input, !!errors.sistolica && styles.inputErrorBorder]}
                    placeholder="Ex: 120 (ou 12)"
                    placeholderTextColor="#999"
                    value={data.sistolica}
                    onChangeText={handleSistolicaChange}
                    keyboardType="numeric"
                    maxLength={3}
                    accessibilityLabel="Número maior da pressão arterial"
                />
                {errors.sistolica && <Text style={styles.errorText}>{errors.sistolica}</Text>}
            </View>

            {/* NÚMERO MENOR (DIASTÓLICA) */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    NÚMERO MENOR (Mínima) <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    ref={diastolicaInputRef}
                    style={[styles.input, !!errors.diastolica && styles.inputErrorBorder]}
                    placeholder="Ex: 80 (ou 8)"
                    placeholderTextColor="#999"
                    value={data.diastolica}
                    onChangeText={(val) => onChange({ ...data, diastolica: val })}
                    keyboardType="numeric"
                    maxLength={3}
                    accessibilityLabel="Número menor da pressão arterial"
                />
                {errors.diastolica && <Text style={styles.errorText}>{errors.diastolica}</Text>}
            </View>

            {/* BOTÃO PARA EXPANDIR OPCIONAIS */}
            <TouchableOpacity 
                style={styles.expandButton} 
                onPress={() => setShowDetails(!showDetails)}
                activeOpacity={0.7}
            >
                <Text style={styles.expandButtonText}>
                    {showDetails ? '- OCULTAR DETALHES' : '+ ADICIONAR DETALHES DA MEDIÇÃO (OPCIONAL)'}
                </Text>
            </TouchableOpacity>

            {/* SESSÃO OPCIONAL EXPANDÍVEL */}
            {showDetails && (
                <View style={styles.optionalSection}>
                    {/* Seletores Rápidos de Postura */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>POSTURA NO MOMENTO DA MEDIÇÃO</Text>
                        <View style={styles.pillRow}>
                            {(['Sentado', 'Deitado'] as const).map((postura) => {
                                const isSelected = data.postura === postura;
                                return (
                                    <TouchableOpacity
                                        key={postura}
                                        style={[styles.pillButton, isSelected && styles.pillButtonSelected]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, postura })}
                                    >
                                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                            {postura.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Seletores Rápidos de Braço Utilizado */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>BRAÇO UTILIZADO</Text>
                        <View style={styles.pillRow}>
                            {(['Direito', 'Esquerdo'] as const).map((braco) => {
                                const isSelected = data.braco === braco;
                                return (
                                    <TouchableOpacity
                                        key={braco}
                                        style={[styles.pillButton, isSelected && styles.pillButtonSelected]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, braco })}
                                    >
                                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                            {braco.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Seletores Rápidos de Estado Emocional */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>ESTADO EMOCIONAL NO MOMENTO</Text>
                        <View style={styles.pillRow}>
                            {(['Calmo', 'Estresse', 'Dor'] as const).map((estado) => {
                                const isSelected = data.estadoEmocional === estado;
                                return (
                                    <TouchableOpacity
                                        key={estado}
                                        style={[styles.pillButton, isSelected && styles.pillButtonSelected]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, estadoEmocional: estado })}
                                    >
                                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                            {estado.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    fieldSection: {
        marginBottom: 18,
    },
    fieldLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    requiredMark: {
        color: themes.colors.darkRed,
        fontWeight: 'bold',
    },
    input: {
        borderWidth: 1.5,
        borderColor: themes.colors.orange,
        borderRadius: 25,
        paddingHorizontal: 18,
        paddingVertical: 14,
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        backgroundColor: '#FFFFFF',
    },
    inputErrorBorder: {
        borderColor: themes.colors.darkRed,
        backgroundColor: '#FFF5F5',
    },
    expandButton: {
        paddingVertical: 12,
        marginBottom: 16,
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: 50,
    },
    expandButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.orange,
        textAlign: 'center',
    },
    optionalSection: {
        marginTop: 8,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    pillRow: {
        flexDirection: 'row',
        gap: 10,
    },
    pillButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        borderWidth: 1.5,
        borderColor: themes.colors.orange,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillButtonSelected: {
        backgroundColor: themes.colors.orange,
    },
    pillText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },
    pillTextSelected: {
        color: '#FFFFFF',
    },
    errorText: {
        color: themes.colors.darkRed,
        fontSize: 18,
        marginTop: 6,
        marginLeft: 10,
        fontWeight: 'bold',
    },
});