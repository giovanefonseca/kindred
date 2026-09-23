import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { themes } from '../../../../global/themes';
import { BaseSubformProps, GlicemiaFormData } from './types';
import { BooleanToggle } from '../../../../components/BooleanToggle';

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

            {/* Foi em Jejum? */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    A MEDIÇÃO FOI FEITA EM JEJUM? <Text style={styles.requiredMark}>*</Text>
                </Text>

                {/* Contentor centralizado para estabilizar a UX/UI do botão */}
                <View style={styles.toggleWrapper}>
                    <BooleanToggle
                        value={data.emJejum ?? false} // <-- AQUI: garante que sempre será true ou false
                        onChange={(v) => onChange({ ...data, emJejum: v })}
                        labels={['SIM', 'NÃO']}
                    />
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
        paddingVertical: 12,
        fontSize: 18,
        color: themes.colors.notBlack,
        backgroundColor: '#FFFFFF',
    },
    inputErrorBorder: {
        borderColor: themes.colors.darkRed,
        backgroundColor: '#FFF5F5',
    },
    errorText: {
        color: themes.colors.darkRed,
        fontSize: 18,
        marginTop: 6,
        marginLeft: 10,
        fontWeight: 'bold',
    },
    toggleWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 10,
    },
});