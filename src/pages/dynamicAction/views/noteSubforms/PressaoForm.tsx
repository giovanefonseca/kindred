import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../../../global/themes';
import { BaseSubformProps, PressaoFormData } from './types';

export function PressaoForm({ data, onChange, errors }: BaseSubformProps<PressaoFormData>) {
    return (
        <View style={styles.container}>
            {/* Valores de Pressão Arterial */}
            <View style={styles.row}>
                <View style={[styles.fieldSection, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                        SISTÓLICA (MÁXIMA) <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, !!errors.sistolica && styles.inputErrorBorder]}
                        placeholder="Ex: 120"
                        placeholderTextColor="#999"
                        value={data.sistolica}
                        onChangeText={(val) => onChange({ ...data, sistolica: val })}
                        keyboardType="numeric"
                        accessibilityLabel="Pressão Sistólica Máxima em mmHg"
                    />
                    {errors.sistolica && <Text style={styles.errorText}>{errors.sistolica}</Text>}
                </View>

                <View style={[styles.fieldSection, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                        DIASTÓLICA (MÍNIMA) <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, !!errors.diastolica && styles.inputErrorBorder]}
                        placeholder="Ex: 80"
                        placeholderTextColor="#999"
                        value={data.diastolica}
                        onChangeText={(val) => onChange({ ...data, diastolica: val })}
                        keyboardType="numeric"
                        accessibilityLabel="Pressão Diastólica Mínima em mmHg"
                    />
                    {errors.diastolica && <Text style={styles.errorText}>{errors.diastolica}</Text>}
                </View>
            </View>

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
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`Postura ${postura}`}
                                accessibilityState={{ selected: isSelected }}
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
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`Braço ${braco}`}
                                accessibilityState={{ selected: isSelected }}
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
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`Estado emocional ${estado}`}
                                accessibilityState={{ selected: isSelected }}
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
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    fieldSection: {
        marginBottom: 16,
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
    pillRow: {
        flexDirection: 'row',
        gap: 10,
    },
    pillButton: {
        flex: 1,
        paddingVertical: 12,
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
        fontSize: 13,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },
    pillTextSelected: {
        color: '#FFFFFF',
    },
    errorText: {
        color: themes.colors.darkRed,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 10,
        fontWeight: 'bold',
    },
});

