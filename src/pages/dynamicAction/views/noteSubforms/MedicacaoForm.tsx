import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../../../global/themes';
import { BaseSubformProps, MedicacaoFormData, getCurrentTimeString } from './types';

export function MedicacaoForm({ data, onChange, errors }: BaseSubformProps<MedicacaoFormData>) {
    const [showDetails, setShowDetails] = useState(false);

    // Atualiza automaticamente o horário de inserção se estiver vazio ao carregar
    useEffect(() => {
        if (!data.horarioInsercao) {
            onChange({ ...data, horarioInsercao: getCurrentTimeString() });
        }
        if (!data.horarioPlanejado) {
            onChange({ ...data, horarioPlanejado: getCurrentTimeString() });
        }
    }, []);

    // Cálculo comparativo simples de tempo entre horário inserido e planejado
    const renderComparisonBadge = () => {
        if (!data.horarioInsercao || !data.horarioPlanejado) return null;

        const [actH, actM] = data.horarioInsercao.split(':').map(Number);
        const [planH, planM] = data.horarioPlanejado.split(':').map(Number);

        if (isNaN(actH) || isNaN(actM) || isNaN(planH) || isNaN(planM)) return null;

        const actTotal = actH * 60 + actM;
        const planTotal = planH * 60 + planM;
        const diff = actTotal - planTotal;

        let badgeText = '';
        let isWarning = false;

        if (Math.abs(diff) <= 15) {
            badgeText = 'Tomado no horário correto ✓';
        } else if (diff > 15) {
            const hours = Math.floor(diff / 60);
            const mins = diff % 60;
            const timeStr = hours > 0 ? `${hours}h e ${mins}min` : `${mins}min`;
            badgeText = `Tomado com ${timeStr} de atraso ⚠️`;
            isWarning = true;
        } else {
            const absDiff = Math.abs(diff);
            const hours = Math.floor(absDiff / 60);
            const mins = absDiff % 60;
            const timeStr = hours > 0 ? `${hours}h e ${mins}min` : `${mins}min`;
            badgeText = `Tomado ${timeStr} antes do horário ℹ️`;
        }

        return (
            <View style={[styles.comparisonBadge, isWarning && styles.comparisonBadgeWarning]}>
                <Text style={[styles.comparisonText, isWarning && styles.comparisonTextWarning]}>
                    {badgeText}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Nome do Medicamento */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    NOME DO MEDICAMENTO <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    style={[styles.input, !!errors.nomeMedicamento && styles.inputErrorBorder]}
                    placeholder="Ex: Insulina, Losartana, Dipirona..."
                    placeholderTextColor="#999"
                    value={data.nomeMedicamento}
                    onChangeText={(val) => onChange({ ...data, nomeMedicamento: val })}
                    accessibilityLabel="Nome do medicamento"
                />
                {errors.nomeMedicamento && (
                    <Text style={styles.errorText}>{errors.nomeMedicamento}</Text>
                )}
            </View>

            {/* Dosagem */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                    DOSAGEM <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                    style={[styles.input, !!errors.dosagem && styles.inputErrorBorder]}
                    placeholder="Ex: 50mg, 1 comprimido, 10 UI..."
                    placeholderTextColor="#999"
                    value={data.dosagem}
                    onChangeText={(val) => onChange({ ...data, dosagem: val })}
                    accessibilityLabel="Dosagem do medicamento"
                />
                {errors.dosagem && <Text style={styles.errorText}>{errors.dosagem}</Text>}
            </View>

            {/* Horários com foco em seleção fácil */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>HORÁRIO DA TOMADA</Text>
                <View style={styles.timeColumn}>
                    {/* Horário Atual */}
                    <View style={styles.timeBox}>
                        <Text style={styles.timeBoxLabel}>HORÁRIO ATUAL (AUTOMÁTICO)</Text>
                        <Text style={styles.timeBoxValue}>{data.horarioInsercao || getCurrentTimeString()}</Text>
                    </View>

                    {/* Horário Planejado Selecionável */}
                    <View style={styles.timeBoxSelectable}>
                        <Text style={styles.timeBoxLabel}>HORÁRIO PLANEJADO (TOQUE PARA ALTERAR)</Text>
                        <TextInput
                            style={styles.timeInput}
                            placeholder="08:00"
                            placeholderTextColor="#999"
                            value={data.horarioPlanejado}
                            onChangeText={(val) => {
                                // Remove tudo o que não for número
                                const numbers = val.replace(/\D/g, '');
                                let formatted = numbers;

                                // Se passar de 2 números, insere os dois-pontos automaticamente
                                if (numbers.length > 2) {
                                    formatted = `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
                                }

                                onChange({ ...data, horarioPlanejado: formatted });
                            }}
                            keyboardType="numeric"
                            maxLength={5} // Limita para aceitar no máximo 4 números + 1 dois-pontos
                            accessibilityLabel="Horário planejado para tomar o remédio"
                        />
                    </View>
                </View>

                {/* Card Comparativo só aparece se houver um horário planejado preenchido */}
                {!!data.horarioPlanejado && renderComparisonBadge()}
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
                    {/* Reações Adversas */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>REAÇÕES ADVERSAS SENTIDAS</Text>
                        <View style={styles.gridRow}>
                            {(['Nenhuma', 'Tontura', 'Enjoo', 'Dor de cabeça', 'Outras'] as const).map((reacao) => {
                                const isSelected = data.reacoesAdversas === reacao;
                                return (
                                    <TouchableOpacity
                                        key={reacao}
                                        style={[
                                            styles.gridPillButton,
                                            isSelected && styles.pillButtonSelected,
                                        ]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, reacoesAdversas: reacao })}
                                    >
                                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                            {reacao.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Alívio dos Sintomas */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>ALÍVIO DOS SINTOMAS COM O REMÉDIO</Text>
                        <View style={styles.pillRow}>
                            {(['Sim', 'Parcial', 'Não'] as const).map((alivio) => {
                                const isSelected = data.alivioSintomas === alivio;
                                return (
                                    <TouchableOpacity
                                        key={alivio}
                                        style={[styles.pillButton, isSelected && styles.pillButtonSelected]}
                                        activeOpacity={0.8}
                                        onPress={() => onChange({ ...data, alivioSintomas: alivio })}
                                    >
                                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                            {alivio.toUpperCase()}
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
    timeColumn: {
        flexDirection: 'column',
        gap: 12,
    },
    timeBox: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 20,
        padding: 14,
        alignItems: 'center',
    },
    timeBoxSelectable: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: themes.colors.orange,
        borderRadius: 20,
        padding: 14,
        alignItems: 'center',
    },
    timeBoxLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 6,
        textAlign: 'center',
    },
    timeBoxValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },
    timeInput: {
        fontSize: 22,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        textAlign: 'center',
        padding: 0,
        width: '100%',
    },
    comparisonBadge: {
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#C8E6C9',
    },
    comparisonBadgeWarning: {
        backgroundColor: '#FFF3E0',
        borderColor: '#FFE0B2',
    },
    comparisonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2E7D32',
        textAlign: 'center',
    },
    comparisonTextWarning: {
        color: '#E65100',
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
        gap: 10,
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