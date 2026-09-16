import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../../../global/themes';
import { BaseSubformProps, OxigenacaoFormData } from './types';

export function OxigenacaoForm({ data, onChange, errors }: BaseSubformProps<OxigenacaoFormData>) {
    return (
        <View style={styles.container}>
            {/* Oxigênio % e Frequência Cardíaca (BPM) na Mesma Tela */}
            <View style={styles.row}>
                <View style={[styles.fieldSection, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                        OXIGÊNIO (SpO2 %) <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, !!errors.spO2 && styles.inputErrorBorder]}
                        placeholder="Ex: 98"
                        placeholderTextColor="#999"
                        value={data.spO2}
                        onChangeText={(val) => onChange({ ...data, spO2: val })}
                        keyboardType="numeric"
                        accessibilityLabel="Porcentagem de oxigenação do sangue SpO2"
                    />
                    {errors.spO2 && <Text style={styles.errorText}>{errors.spO2}</Text>}
                </View>

                <View style={[styles.fieldSection, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                        BPM (BPM CARDÍACO) <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, !!errors.frequenciaCardiacaBpm && styles.inputErrorBorder]}
                        placeholder="Ex: 72"
                        placeholderTextColor="#999"
                        value={data.frequenciaCardiacaBpm}
                        onChangeText={(val) => onChange({ ...data, frequenciaCardiacaBpm: val })}
                        keyboardType="numeric"
                        accessibilityLabel="Frequência cardíaca em batimentos por minuto"
                    />
                    {errors.frequenciaCardiacaBpm && (
                        <Text style={styles.errorText}>{errors.frequenciaCardiacaBpm}</Text>
                    )}
                </View>
            </View>

            {/* Nível de Atividade */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>NÍVEL DE ATIVIDADE NO MOMENTO</Text>
                <View style={styles.pillRow}>
                    {(['Repouso', 'Pós-esforço'] as const).map((nivel) => {
                        const isSelected = data.nivelAtividade === nivel;
                        return (
                            <TouchableOpacity
                                key={nivel}
                                style={[styles.pillButton, isSelected && styles.pillButtonSelected]}
                                activeOpacity={0.8}
                                onPress={() => onChange({ ...data, nivelAtividade: nivel })}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`Nível de atividade ${nivel}`}
                                accessibilityState={{ selected: isSelected }}
                            >
                                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                    {nivel.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Sintomas Respiratórios */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>PRESENÇA DE SINTOMAS RESPIRATÓRIOS</Text>
                <View style={styles.gridRow}>
                    {(['Nenhum', 'Falta de ar', 'Tosse', 'Cansaço'] as const).map((sintoma) => {
                        const isSelected = data.sintomasRespiratorios === sintoma;
                        return (
                            <TouchableOpacity
                                key={sintoma}
                                style={[
                                    styles.gridPillButton,
                                    isSelected && styles.pillButtonSelected,
                                ]}
                                activeOpacity={0.8}
                                onPress={() => onChange({ ...data, sintomasRespiratorios: sintoma })}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`Sintoma respiratório ${sintoma}`}
                                accessibilityState={{ selected: isSelected }}
                            >
                                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                    {sintoma.toUpperCase()}
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
        gap: 16, // Aumentado levemente para dar mais respiro entre os dois campos
    },
    fieldSection: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 10,
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
        height: 48, // Altura fixa para garantir inputs idênticos em todas as abas
    },
    inputErrorBorder: {
        borderColor: themes.colors.darkRed,
        backgroundColor: '#FFF5F5',
    },
    pillRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    gridRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12, // Espaçamento vertical entre as linhas do grid
    },
    pillButton: {
        flex: 1,
        height: 46, // Altura fixa igual aos botões da primeira tela
        borderRadius: 20,
        backgroundColor: '#FFFFFF', // Mudado de #F0F0F0 para Branco (Padrão da tela 1)
        borderWidth: 1.5,
        borderColor: '#E5E7EB', // Borda cinza suave para botões não selecionados
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridPillButton: {
        width: '48%', // Garante duas colunas perfeitas alinhadas pelas extremidades
        height: 46,
        borderRadius: 20,
        backgroundColor: '#FFFFFF', // Mudado de #F0F0F0 para Branco
        borderWidth: 1.5,
        borderColor: '#E5E7EB', // Borda cinza suave
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillButtonSelected: {
        backgroundColor: themes.colors.orange,
        borderColor: themes.colors.orange, // Mantém a borda laranja quando ativo
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


