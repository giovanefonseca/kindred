import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../../../config/firebaseConfig';
import { themes } from '../../../../../global/themes';
import { BooleanToggle } from '../../../../../components/BooleanToggle';
import { NotificationService } from '../../../../../services/NotificationService';
import { useAccessibility } from '../../../../../contexts/AccessibilityContext';
import type { SubformProps } from '../reminderTypes';

const ADVANCE_OPTIONS = [0, 1, 2, 3, 4, 6, 12, 24];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MIN_LEAD_MS = 3000;

function parseTime(value: string): { h: number; m: number } | null {
    const [h, m] = value.split(':').map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        return null;
    }
    return { h, m };
}

// Próxima ocorrência futura do horário do AVISO (horário do remédio menos a antecedência)
function getNextTriggerDate(h: number, m: number, advanceHours: number): Date {
    const base = new Date();
    base.setHours(h, m, 0, 0);
    let trigger = new Date(base.getTime() - advanceHours * HOUR_MS);
    while (trigger.getTime() <= Date.now() + MIN_LEAD_MS) {
        trigger = new Date(trigger.getTime() + DAY_MS);
    }
    return trigger;
}

export function RemedioForm({ editingReminder, activeUserId, onSaveSuccess, onSaveError }: SubformProps) {
    const [loading, setLoading] = useState(false);
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const [nomeRemedio, setNomeRemedio] = useState<string>(editingReminder?.dadosFormulario?.nomeRemedio || '');
    const [horario, setHorario] = useState<string>(editingReminder?.dadosFormulario?.time || '08:00');
    const [advanceHours, setAdvanceHours] = useState<number>(editingReminder?.dadosFormulario?.advanceHours ?? 0);
    const [repetirDiariamente, setRepetirDiariamente] = useState<boolean>(
        editingReminder?.dadosFormulario?.repetirDiariamente ?? true
    );
    const [showTimePicker, setShowTimePicker] = useState(false);

    // O seletor abre no horário escolhido, e não na hora atual
    const pickerValue = (() => {
        const t = parseTime(horario);
        const d = new Date();
        d.setHours(t?.h ?? 8, t?.m ?? 0, 0, 0);
        return d;
    })();

    const handleSave = async () => {
        if (loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const nomeLimpo = nomeRemedio.trim();
        if (!nomeLimpo) {
            onSaveError('Por favor, informe o nome do medicamento.');
            return;
        }

        const targetUid = activeUserId || auth.currentUser?.uid;
        if (!targetUid) {
            onSaveError('Utilizador não autenticado.');
            return;
        }

        const time = parseTime(horario);
        if (!time) {
            onSaveError('Horário inválido. Escolha novamente.');
            return;
        }

        const title = 'LEMBRETE: REMÉDIO';
        const subtitle = nomeLimpo.toUpperCase();
        const triggerDate = getNextTriggerDate(time.h, time.m, advanceHours);

        setLoading(true);
        let newNotificationId: string | null = null;

        try {
            // 1. Agenda o alarme (diário ou único)
            if (repetirDiariamente) {
                newNotificationId = await NotificationService.scheduleDailyReminder(
                    title,
                    subtitle,
                    triggerDate.getHours(),
                    triggerDate.getMinutes()
                );
            } else {
                newNotificationId = await NotificationService.scheduleReminder(title, subtitle, triggerDate);
            }

            // 2. Salva no Firestore
            const basePayload = {
                title,
                subtitle,
                categoryKey: 'remedio',
                iconFamily: 'MaterialCommunityIcons',
                iconName: 'pill',
                dataAgendamento: triggerDate.toISOString(), // próximo aviso
                notificationId: newNotificationId,
                dadosFormulario: {
                    nomeRemedio: nomeLimpo,
                    time: horario,
                    advanceHours,
                    repetirDiariamente,
                },
            };

            if (editingReminder?.id) {
                await updateDoc(doc(db, 'users', targetUid, 'reminders', editingReminder.id), basePayload);
            } else {
                await setDoc(doc(db, 'users', targetUid, 'reminders', `rem_${Date.now()}`), {
                    ...basePayload,
                    criadoEm: new Date().toISOString(),
                    isRead: false,
                });
            }

            // 3. Só agora cancela o alarme antigo
            const oldId = editingReminder?.notificationId;
            if (oldId && oldId !== newNotificationId) {
                await NotificationService.cancelReminder(oldId);
            }

            const advanceText = advanceHours > 0 ? ` (Avisar ${advanceHours}h antes)` : '';
            const repeatText = repetirDiariamente ? '\n• Repete todos os dias' : '';
            let details = `• Medicamento: ${nomeLimpo}\n• Horário: ${horario}${advanceText}${repeatText}`;
            if (!newNotificationId) {
                details +=
                    '\n\nAtenção: o alarme não foi agendado (permissão de notificações desativada).';
            }
            onSaveSuccess(details);
        } catch (error) {
            console.error('Erro ao salvar remédio:', error);
            // Evita alarme órfão se o salvamento falhou
            if (newNotificationId) {
                await NotificationService.cancelReminder(newNotificationId);
            }
            onSaveError('Não foi possível guardar o lembrete.');
        } finally {
            setLoading(false);
        }
    };

    const inputBoxHC = isHighContrast && {
        backgroundColor: theme.cardBackground,
        borderColor: theme.border,
        borderWidth: 1.5,
    };
    const iconColor = isHighContrast ? theme.buttonPrimary : themes.colors.secureGreen;
    const labelStyle = [styles.label, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }];

    return (
        <View style={styles.container}>
            <Text style={labelStyle}>NOME DO MEDICAMENTO</Text>
            <View style={[styles.inputBox, inputBoxHC]}>
                <MaterialCommunityIcons name="pill" size={24} color={iconColor} />
                <TextInput
                    style={[styles.input, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}
                    placeholder="Ex: Paracetamol 500mg"
                    placeholderTextColor={isHighContrast ? theme.textSecondary : '#94A3B8'}
                    value={nomeRemedio}
                    onChangeText={setNomeRemedio}
                    accessibilityLabel="Nome do medicamento"
                />
            </View>

            <Text style={labelStyle}>HORÁRIO DA MEDICAÇÃO</Text>
            <TouchableOpacity
                style={[styles.inputBox, inputBoxHC]}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Horário da medicação: ${horario}`}
                accessibilityHint="Toque para alterar"
            >
                <MaterialCommunityIcons name="clock-outline" size={24} color={iconColor} />
                <Text style={[styles.inputValueText, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>
                    {horario}
                </Text>
            </TouchableOpacity>

            {showTimePicker && (
                <View>
                    <DateTimePicker
                        value={pickerValue}
                        mode="time"
                        is24Hour={true}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                            // Android fecha sozinho; iOS fica aberto até o botão CONFIRMAR
                            if (Platform.OS === 'android') setShowTimePicker(false);
                            if (event.type === 'dismissed' || !date) return;
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            setHorario(`${hours}:${minutes}`);
                        }}
                    />
                    {Platform.OS === 'ios' && (
                        <TouchableOpacity
                            style={[styles.confirmPickerBtn, isHighContrast && { backgroundColor: theme.buttonPrimary }]}
                            onPress={() => setShowTimePicker(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Confirmar horário"
                        >
                            <Text style={[styles.saveBtnText, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.buttonText }]}>
                                CONFIRMAR
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <Text style={labelStyle}>AVISAR COM ANTECEDÊNCIA?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {ADVANCE_OPTIONS.map((h) => {
                    const isSelected = advanceHours === h;
                    const label = h === 0 ? 'Na Hora' : `${h}h antes`;
                    return (
                        <TouchableOpacity
                            key={h}
                            style={[
                                styles.chip,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                isSelected &&
                                    (isHighContrast
                                        ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary }
                                        : styles.chipSelected),
                            ]}
                            onPress={() => setAdvanceHours(h)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={label}
                            accessibilityState={{ selected: isSelected }}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    { fontSize: 14 * fontScale },
                                    isHighContrast && { color: theme.textPrimary },
                                    isSelected && (isHighContrast ? { color: theme.buttonText } : styles.chipTextSelected),
                                ]}
                            >
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={labelStyle}>REPETIR DIARIAMENTE?</Text>
            <BooleanToggle value={repetirDiariamente} onChange={setRepetirDiariamente} />

            <TouchableOpacity
                style={[styles.saveBtn, isHighContrast && { backgroundColor: theme.buttonPrimary }, loading && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={editingReminder ? 'Atualizar lembrete de remédio' : 'Salvar lembrete de remédio'}
                accessibilityState={{ disabled: loading, busy: loading }}
            >
                {loading ? (
                    <ActivityIndicator color={isHighContrast ? theme.buttonText : '#FFF'} />
                ) : (
                    <Text style={[styles.saveBtnText, { fontSize: 18 * fontScale }, isHighContrast && { color: theme.buttonText }]}>
                        {editingReminder ? 'ATUALIZAR' : 'SALVAR REMÉDIO'}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 14 },
    label: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, minHeight: 56 },
    input: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    inputValueText: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    chipsRow: { gap: 8, paddingVertical: 4 },
    chip: { paddingHorizontal: 18, paddingVertical: 12, minHeight: 48, justifyContent: 'center', borderRadius: 24, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#CBD5E1' },
    chipSelected: { backgroundColor: themes.colors.secureGreen, borderColor: 'transparent' },
    chipText: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
    chipTextSelected: { color: '#FFFFFF' },
    confirmPickerBtn: { backgroundColor: themes.colors.secureGreen, paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 4 },
    saveBtn: { backgroundColor: themes.colors.primary, paddingVertical: 20, minHeight: 64, justifyContent: 'center', borderRadius: 20, alignItems: 'center', marginTop: 16, elevation: 3 },
    saveBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});