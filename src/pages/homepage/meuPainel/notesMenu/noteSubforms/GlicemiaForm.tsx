import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { themes } from '../../../../../global/themes';
import { BaseSubformProps, GlicemiaFormData } from './types';
import { BooleanToggle } from '../../../../../components/BooleanToggle';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../../contexts/AccessibilityContext';

export function GlicemiaForm({ data, onChange, errors }: BaseSubformProps<GlicemiaFormData>) {
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const isJejumError = !!errors.emJejum;
    const isValorError = !!errors.valorMgDl;

    const handleToggleJejum = (value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange({ ...data, emJejum: value });
    };

    return (
        <View style={styles.container}>
            {/* Valor da Glicemia */}
            <View style={styles.fieldSection}>
                <Text style={[
                    styles.fieldLabel,
                    { fontSize: 18 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    VALOR DA GLICEMIA (mg/dL) <Text style={[styles.requiredMark, isHighContrast && { color: theme.buttonPrimary }]}>*</Text>
                </Text>

                <TextInput
                    style={[
                        styles.input,
                        { fontSize: 18 * fontScale },
                        isHighContrast && {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.border,
                            color: theme.textPrimary
                        },
                        isValorError && (isHighContrast ? { borderColor: theme.buttonPrimary, borderWidth: 2.5 } : styles.inputErrorBorder)
                    ]}
                    placeholder="Ex: 95"
                    placeholderTextColor={isHighContrast ? theme.textSecondary : "#999"}
                    value={data.valorMgDl || ''}
                    onChangeText={(val) => onChange({ ...data, valorMgDl: val })}
                    keyboardType="numeric"
                    accessibilityLabel="Valor da Glicemia em miligramas por decilitro"
                />

                {isValorError && (
                    <Text style={[
                        styles.errorText,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.buttonPrimary }
                    ]}>
                        {errors.valorMgDl}
                    </Text>
                )}
            </View>

            {/* Foi em Jejum? */}
            <View style={styles.fieldSection}>
                <Text style={[
                    styles.fieldLabel,
                    { fontSize: 18 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    A MEDIÇÃO FOI FEITA EM JEJUM? <Text style={[styles.requiredMark, isHighContrast && { color: theme.buttonPrimary }]}>*</Text>
                </Text>

                {/* Contentor centralizado para o botão alternador */}
                <View style={styles.toggleWrapper}>
                    <BooleanToggle
                        value={data.emJejum ?? true}
                        onChange={handleToggleJejum}
                        labels={['SIM', 'NÃO']}
                    />
                </View>

                {isJejumError && (
                    <Text style={[
                        styles.errorText,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.buttonPrimary }
                    ]}>
                        {errors.emJejum}
                    </Text>
                )}
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