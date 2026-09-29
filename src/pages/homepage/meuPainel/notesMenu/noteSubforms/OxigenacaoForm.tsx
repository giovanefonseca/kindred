import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../../../../global/themes';
import { BaseSubformProps, OxigenacaoFormData } from './types';

// Importando o contexto de acessibilidade
import { useAccessibility } from '../../../../../contexts/AccessibilityContext';

export function OxigenacaoForm({ data, onChange, errors }: BaseSubformProps<OxigenacaoFormData>) {
    const [showDetails, setShowDetails] = useState(false);
    const bpmInputRef = useRef<TextInput>(null);

    // Extraindo dados de acessibilidade do Contexto
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const handleSpO2Change = (val: string) => {
        onChange({ ...data, spO2: val });
        // Avança automaticamente para o próximo campo ao preencher 2 ou 3 dígitos (ex: 98 ou 100)
        if (val.length >= 2) {
            bpmInputRef.current?.focus();
        }
    };

    return (
        <View style={styles.container}>
            {/* NÍVEL DE OXIGÊNIO (%) */}
            <View style={styles.fieldSection}>
                <Text style={[
                    styles.fieldLabel,
                    { fontSize: 18 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    NÍVEL DE OXIGÊNIO (%) <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { 
                            backgroundColor: theme.cardBackground, 
                            color: theme.textPrimary, 
                            borderColor: theme.border, 
                            borderWidth: 2 
                        },
                        !!errors.spO2 && styles.inputErrorBorder
                    ]}
                    placeholder="Ex: 98"
                    placeholderTextColor={isHighContrast ? theme.textSecondary : "#999"}
                    value={data.spO2}
                    onChangeText={handleSpO2Change}
                    keyboardType="numeric"
                    maxLength={3}
                    accessibilityLabel="Porcentagem de oxigenação do sangue SpO2"
                />
                {errors.spO2 && (
                    <Text style={[
                        styles.errorText,
                        { fontSize: 18 * fontScale }
                    ]}>{errors.spO2}</Text>
                )}
            </View>

            {/* BATIMENTOS DO CORAÇÃO (BPM) */}
            <View style={styles.fieldSection}>
                <Text style={[
                    styles.fieldLabel,
                    { fontSize: 18 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    BATIMENTOS DO CORAÇÃO (BPM) <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    ref={bpmInputRef}
                    style={[
                        styles.input,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { 
                            backgroundColor: theme.cardBackground, 
                            color: theme.textPrimary, 
                            borderColor: theme.border, 
                            borderWidth: 2 
                        },
                        !!errors.frequenciaCardiacaBpm && styles.inputErrorBorder
                    ]}
                    placeholder="Ex: 72"
                    placeholderTextColor={isHighContrast ? theme.textSecondary : "#999"}
                    value={data.frequenciaCardiacaBpm}
                    onChangeText={(val) => onChange({ ...data, frequenciaCardiacaBpm: val })}
                    keyboardType="numeric"
                    maxLength={3}
                    accessibilityLabel="Frequência cardíaca em batimentos por minuto"
                />
                {errors.frequenciaCardiacaBpm && (
                    <Text style={[
                        styles.errorText,
                        { fontSize: 18 * fontScale }
                    ]}>{errors.frequenciaCardiacaBpm}</Text>
                )}
            </View>

            {/* BOTÃO PARA EXPANDIR OPCIONAIS */}
            <TouchableOpacity 
                style={styles.expandButton} 
                onPress={() => setShowDetails(!showDetails)}
                activeOpacity={0.7}
            >
                <Text style={[
                    styles.expandButtonText,
                    { fontSize: 18 * fontScale },
                    isHighContrast && { color: theme.buttonPrimary }
                ]}>
                    {showDetails ? '- OCULTAR DETALHES' : '+ ADICIONAR DETALHES DA MEDIÇÃO (OPCIONAL)'}
                </Text>
            </TouchableOpacity>

            {/* SESSÃO OPCIONAL EXPANDÍVEL */}
            {showDetails && (
                <View style={[
                    styles.optionalSection,
                    isHighContrast && { borderTopColor: theme.border }
                ]}>
                    {/* Nível de Atividade */}
                    <View style={styles.fieldSection}>
                        <Text style={[
                            styles.fieldLabel,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>NÍVEL DE ATIVIDADE NO MOMENTO</Text>
                        <View style={styles.pillRow}>
                            {(['Repouso', 'Pós-esforço'] as const).map((nivel) => {
                                const isSelected = data.nivelAtividade === nivel;
                                return (
                                    <TouchableOpacity
                                        key={nivel}
                                        style={[
                                            styles.pillButton,
                                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                            isSelected && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.pillButtonSelected)
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, nivelAtividade: nivel })}
                                    >
                                        <Text style={[
                                            styles.pillText,
                                            { fontSize: 18 * fontScale },
                                            isHighContrast && { color: theme.textPrimary },
                                            isSelected && (isHighContrast ? { color: theme.buttonText } : styles.pillTextSelected)
                                        ]}>
                                            {nivel.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Sintomas Respiratórios */}
                    <View style={styles.fieldSection}>
                        <Text style={[
                            styles.fieldLabel,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>SINTOMAS RESPIRATÓRIOS</Text>
                        <View style={styles.gridRow}>
                            {(['Nenhum', 'Falta de ar', 'Tosse', 'Cansaço'] as const).map((sintoma) => {
                                const isSelected = data.sintomasRespiratorios === sintoma;
                                return (
                                    <TouchableOpacity
                                        key={sintoma}
                                        style={[
                                            styles.gridPillButton,
                                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                            isSelected && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.pillButtonSelected),
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, sintomasRespiratorios: sintoma })}
                                    >
                                        <Text style={[
                                            styles.pillText,
                                            { fontSize: 18 * fontScale },
                                            isHighContrast && { color: theme.textPrimary },
                                            isSelected && (isHighContrast ? { color: theme.buttonText } : styles.pillTextSelected)
                                        ]}>
                                            {sintoma.toUpperCase()}
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
        gap: 12,
    },
    gridRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    pillButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridPillButton: {
        width: '48%',
        paddingVertical: 14,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillButtonSelected: {
        backgroundColor: themes.colors.orange,
        borderColor: themes.colors.orange,
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