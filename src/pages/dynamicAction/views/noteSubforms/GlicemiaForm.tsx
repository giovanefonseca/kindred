import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../../../global/themes';
import { BaseSubformProps, GlicemiaFormData } from './types';

export function GlicemiaForm({ data, onChange, errors }: BaseSubformProps<GlicemiaFormData>) {
    const isJejumError = !!errors.emJejum;
    const isValorError = !!errors.valorMgDl;

    return (
        <View style={styles.container}>
            {/* Valor da Glicemia */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    VALOR DA GLICEMIA (mg/dL) <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    style={[styles.input, isValorError && styles.inputErrorBorder]}
                    placeholder="Ex: 95"
                    placeholderTextColor="#999"
                    value={data.valorMgDl}
                    onChangeText={(val) => onChange({ ...data, valorMgDl: val })}
                    keyboardType="numeric"
                    accessibilityLabel="Valor da Glicemia em miligramas por decilitro"
                />
                {isValorError && <Text style={styles.errorText}>{errors.valorMgDl}</Text>}
            </View>

            {/* Foi em Jejum? (Campo Obrigatório) */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    A MEDIÇÃO FOI FEITA EM JEJUM? <Text style={styles.requiredMark}>*</Text>
                </Text>

                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            data.emJejum === true && styles.toggleButtonActive,
                            isJejumError && styles.toggleButtonError,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => onChange({ ...data, emJejum: true })}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Medição em Jejum: Sim"
                        accessibilityState={{ selected: data.emJejum === true }}
                    >
                        <Text
                            style={[
                                styles.toggleText,
                                data.emJejum === true && styles.toggleTextActive,
                            ]}
                        >
                            SIM (EM JEJUM)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            data.emJejum === false && styles.toggleButtonActive,
                            isJejumError && styles.toggleButtonError,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => onChange({ ...data, emJejum: false })}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Medição em Jejum: Não"
                        accessibilityState={{ selected: data.emJejum === false }}
                    >
                        <Text
                            style={[
                                styles.toggleText,
                                data.emJejum === false && styles.toggleTextActive,
                            ]}
                        >
                            NÃO (APÓS REFEIÇÃO)
                        </Text>
                    </TouchableOpacity>
                </View>
                {isJejumError && <Text style={styles.errorText}>{errors.emJejum}</Text>}
            </View>
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
        fontSize: 13,
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
        paddingVertical: 12,
        fontSize: 14,
        color: themes.colors.notBlack,
        backgroundColor: '#FFFFFF',
    },
    inputErrorBorder: {
        borderColor: themes.colors.darkRed,
        backgroundColor: '#FFF5F5',
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 12,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F0F0',
        borderWidth: 1.5,
        borderColor: themes.colors.orange,
    },
    toggleButtonActive: {
        backgroundColor: themes.colors.orange,
    },
    toggleButtonError: {
        borderColor: themes.colors.darkRed,
        backgroundColor: '#FFF5F5',
    },
    toggleText: {
        fontSize: 13.5,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    errorText: {
        color: themes.colors.darkRed,
        fontSize: 12,
        marginTop: 6,
        marginLeft: 10,
        fontWeight: 'bold',
    },
});

