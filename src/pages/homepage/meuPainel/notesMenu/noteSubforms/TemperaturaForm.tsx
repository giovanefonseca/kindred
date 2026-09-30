import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { themes } from '../../../../../global/themes';
import { BaseSubformProps, TemperaturaFormData } from './types';

// Importando o contexto de acessibilidade
import { useAccessibility } from '../../../../../contexts/AccessibilityContext';

const SINTOMAS_OPCOES = [
    'Calafrios',
    'Suor frio / excessivo',
    'Dor no corpo',
    'Dor de cabeça',
    'Fraqueza / Cansaço',
];

export function TemperaturaForm({ data, onChange, errors }: BaseSubformProps<TemperaturaFormData>) {
    const [showDetails, setShowDetails] = useState(false);

    // Extraindo dados de acessibilidade do Contexto
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const handleToggleDetails = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowDetails(!showDetails);
    };

    const handleSelectOption = (field: keyof TemperaturaFormData, value: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange({ ...data, [field]: value });
    };

    const toggleSintoma = (sintoma: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const currentList = data.sintomasAssociados || [];
        const exists = currentList.includes(sintoma);
        let updated: string[];
        if (exists) {
            updated = currentList.filter((s) => s !== sintoma);
        } else {
            updated = [...currentList, sintoma];
        }
        onChange({ ...data, sintomasAssociados: updated });
    };

    return (
        <View style={styles.container}>
            {/* Valor da Temperatura */}
            <View style={styles.fieldSection}>
                <Text style={[
                    styles.fieldLabel,
                    { fontSize: 18 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    TEMPERATURA CORPORAL (°C) <Text style={[styles.requiredMark, isHighContrast && { color: theme.buttonPrimary }]}>*</Text>
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
                        !!errors.valorCelsius && (isHighContrast ? { borderColor: theme.buttonPrimary, borderWidth: 2.5 } : styles.inputErrorBorder)
                    ]}
                    placeholder="Ex: 36.5 ou 38.2"
                    placeholderTextColor={isHighContrast ? theme.textSecondary : "#999"}
                    value={data.valorCelsius || ''}
                    onChangeText={(val) => onChange({ ...data, valorCelsius: val })}
                    keyboardType="numeric"
                    accessibilityLabel="Temperatura corporal em graus celsius"
                />
                {errors.valorCelsius && (
                    <Text style={[
                        styles.errorText,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.buttonPrimary }
                    ]}>{errors.valorCelsius}</Text>
                )}
            </View>

            {/* BOTÃO PARA EXPANDIR OPCIONAIS */}
            <TouchableOpacity 
                style={styles.expandButton} 
                onPress={handleToggleDetails}
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
                    {/* Local da Medição */}
                    <View style={styles.fieldSection}>
                        <Text style={[
                            styles.fieldLabel,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>LOCAL DA MEDIÇÃO</Text>
                        <View style={styles.gridRow}>
                            {(['Axila', 'Boca', 'Ouvido', 'Testa'] as const).map((local) => {
                                const isSelected = data.localMedicao === local;
                                return (
                                    <TouchableOpacity
                                        key={local}
                                        style={[
                                            styles.gridPillButton,
                                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                            isSelected && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.pillButtonSelected)
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => handleSelectOption('localMedicao', local)}
                                    >
                                        <Text style={[
                                            styles.pillText,
                                            { fontSize: 18 * fontScale },
                                            isHighContrast && { color: theme.textPrimary },
                                            isSelected && (isHighContrast ? { color: theme.buttonText } : styles.pillTextSelected)
                                        ]}>
                                            {local.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Uso Prévio de Antitérmicos */}
                    <View style={styles.fieldSection}>
                        <Text style={[
                            styles.fieldLabel,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>USO PRÉVIO DE ANTITÉRMICOS?</Text>
                        <View style={styles.pillRow}>
                            <TouchableOpacity
                                style={[
                                    styles.pillButton,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                    data.usoAntitermicos === true && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.pillButtonSelected),
                                ]}
                                activeOpacity={0.8}
                                onPress={() => handleSelectOption('usoAntitermicos', true)}
                            >
                                <Text
                                    style={[
                                        styles.pillText,
                                        { fontSize: 18 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                        data.usoAntitermicos === true && (isHighContrast ? { color: theme.buttonText } : styles.pillTextSelected),
                                    ]}
                                >
                                    SIM
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.pillButton,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                    data.usoAntitermicos === false && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.pillButtonSelected),
                                ]}
                                activeOpacity={0.8}
                                onPress={() => handleSelectOption('usoAntitermicos', false)}
                            >
                                <Text
                                    style={[
                                        styles.pillText,
                                        { fontSize: 18 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                        data.usoAntitermicos === false && (isHighContrast ? { color: theme.buttonText } : styles.pillTextSelected),
                                    ]}
                                >
                                    NÃO
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Seleção Múltipla para Sintomas Associados */}
                    <View style={styles.fieldSection}>
                        <Text style={[
                            styles.fieldLabel,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>SINTOMAS ASSOCIADOS</Text>
                        <View style={styles.multiSelectColumn}>
                            {SINTOMAS_OPCOES.map((sintoma) => {
                                const isChecked = (data.sintomasAssociados || []).includes(sintoma);
                                return (
                                    <TouchableOpacity
                                        key={sintoma}
                                        style={[
                                            styles.checkboxRow,
                                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                            isChecked && (isHighContrast ? { borderColor: theme.buttonPrimary } : styles.checkboxRowChecked),
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => toggleSintoma(sintoma)}
                                    >
                                        <View
                                            style={[
                                                styles.checkboxBox,
                                                isHighContrast && { borderColor: theme.textSecondary, backgroundColor: theme.cardBackground },
                                                isChecked && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.checkboxBoxChecked),
                                            ]}
                                        >
                                            {isChecked && <Text style={[styles.checkmarkText, isHighContrast && { color: theme.buttonText }]}>✓</Text>}
                                        </View>
                                        <Text
                                            style={[
                                                styles.checkboxText,
                                                { fontSize: 18 * fontScale },
                                                isHighContrast && { color: theme.textPrimary },
                                                isChecked && styles.checkboxTextChecked,
                                            ]}
                                        >
                                            {sintoma}
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
    multiSelectColumn: {
        gap: 10,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    checkboxRowChecked: {
        backgroundColor: '#FFF4E5',
        borderColor: themes.colors.orange,
    },
    checkboxBox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: themes.colors.orange,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxBoxChecked: {
        backgroundColor: themes.colors.orange,
    },
    checkmarkText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
        marginTop: -2,
    },
    checkboxText: {
        fontSize: 18,
        color: themes.colors.notBlack,
        fontWeight: '500',
    },
    checkboxTextChecked: {
        fontWeight: 'bold',
    },
    errorText: {
        color: themes.colors.darkRed,
        fontSize: 18,
        marginTop: 6,
        marginLeft: 10,
        fontWeight: 'bold',
    },
});