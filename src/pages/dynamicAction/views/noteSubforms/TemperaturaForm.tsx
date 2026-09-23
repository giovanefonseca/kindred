import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../../../global/themes';
import { BaseSubformProps, TemperaturaFormData } from './types';

const SINTOMAS_OPCOES = [
    'Calafrios',
    'Suor frio / excessivo',
    'Dor no corpo',
    'Dor de cabeça',
    'Fraqueza / Cansaço',
];

export function TemperaturaForm({ data, onChange, errors }: BaseSubformProps<TemperaturaFormData>) {
    const [showDetails, setShowDetails] = useState(false);

    const toggleSintoma = (sintoma: string) => {
        const exists = data.sintomasAssociados.includes(sintoma);
        let updated: string[];
        if (exists) {
            updated = data.sintomasAssociados.filter((s) => s !== sintoma);
        } else {
            updated = [...data.sintomasAssociados, sintoma];
        }
        onChange({ ...data, sintomasAssociados: updated });
    };

    return (
        <View style={styles.container}>
            {/* Valor da Temperatura */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    TEMPERATURA CORPORAL (°C) <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    style={[styles.input, !!errors.valorCelsius && styles.inputErrorBorder]}
                    placeholder="Ex: 36.5 ou 38.2"
                    placeholderTextColor="#999"
                    value={data.valorCelsius}
                    onChangeText={(val) => onChange({ ...data, valorCelsius: val })}
                    keyboardType="numeric"
                    accessibilityLabel="Temperatura corporal em graus celsius"
                />
                {errors.valorCelsius && <Text style={styles.errorText}>{errors.valorCelsius}</Text>}
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
                    {/* Local da Medição */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>LOCAL DA MEDIÇÃO</Text>
                        <View style={styles.gridRow}>
                            {(['Axila', 'Boca', 'Ouvido', 'Testa'] as const).map((local) => {
                                const isSelected = data.localMedicao === local;
                                return (
                                    <TouchableOpacity
                                        key={local}
                                        style={[
                                            styles.gridPillButton,
                                            isSelected && styles.pillButtonSelected,
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, localMedicao: local })}
                                    >
                                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                            {local.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Uso Prévio de Antitérmicos */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>USO PRÉVIO DE ANTITÉRMICOS?</Text>
                        <View style={styles.pillRow}>
                            <TouchableOpacity
                                style={[
                                    styles.pillButton,
                                    data.usoAntitermicos === true && styles.pillButtonSelected,
                                ]}
                                activeOpacity={0.8}
                                onPress={() => onChange({ ...data, usoAntitermicos: true })}
                            >
                                <Text
                                    style={[
                                        styles.pillText,
                                        data.usoAntitermicos === true && styles.pillTextSelected,
                                    ]}
                                >
                                    SIM
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.pillButton,
                                    data.usoAntitermicos === false && styles.pillButtonSelected,
                                ]}
                                activeOpacity={0.8}
                                onPress={() => onChange({ ...data, usoAntitermicos: false })}
                            >
                                <Text
                                    style={[
                                        styles.pillText,
                                        data.usoAntitermicos === false && styles.pillTextSelected,
                                    ]}
                                >
                                    NÃO
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Seleção Múltipla para Sintomas Associados */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>SINTOMAS ASSOCIADOS</Text>
                        <View style={styles.multiSelectColumn}>
                            {SINTOMAS_OPCOES.map((sintoma) => {
                                const isChecked = data.sintomasAssociados.includes(sintoma);
                                return (
                                    <TouchableOpacity
                                        key={sintoma}
                                        style={[
                                            styles.checkboxRow,
                                            isChecked && styles.checkboxRowChecked,
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => toggleSintoma(sintoma)}
                                    >
                                        <View
                                            style={[
                                                styles.checkboxBox,
                                                isChecked && styles.checkboxBoxChecked,
                                            ]}
                                        >
                                            {isChecked && <Text style={styles.checkmarkText}>✓</Text>}
                                        </View>
                                        <Text
                                            style={[
                                                styles.checkboxText,
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