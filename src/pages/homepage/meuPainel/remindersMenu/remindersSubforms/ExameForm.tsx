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
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
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

function getInitialExameDate(reminder: any): Date {
    const saved = reminder?.dadosFormulario?.dataExame;
    if (saved) return new Date(saved);

    if (reminder?.dataAgendamento) {
        const advance = reminder?.dadosFormulario?.advanceHours ?? 0;
        return new Date(new Date(reminder.dataAgendamento).getTime() + advance * HOUR_MS);
    }

    return new Date(Date.now() + DAY_MS);
}

export function ExameForm({ editingReminder, activeUserId, onSaveSuccess, onSaveError }: SubformProps) {
    const [loading, setLoading] = useState(false);
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const [tipoExame, setTipoExame] = useState<string>(editingReminder?.dadosFormulario?.tipoExame || '');
    const [dataExame, setDataExame] = useState<Date>(() => getInitialExameDate(editingReminder));
    const [advanceHours, setAdvanceHours] = useState<number>(
        editingReminder?.dadosFormulario?.advanceHours ?? 2
    );
    const [exigeJejum, setExigeJejum] = useState<boolean>(
        editingReminder?.dadosFormulario?.exigeJejum ?? false
    );
    const [showDatePickerIOS, setShowDatePickerIOS] = useState(false);

    const openDateTimePicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: dataExame,
                mode: 'date',
                minimumDate: new Date(),
                onChange: (event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                        const newDate = new Date(selectedDate);
                        DateTimePickerAndroid.open({
                            value: newDate,
                            mode: 'time',
                            is24Hour: true,
                            onChange: (timeEvent, selectedTime) => {
                                if (timeEvent.type === 'set' && selectedTime) {
                                    newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
                                    setDataExame(newDate);
                                }
                            },
                        });
                    }
                },
            });
        } else {
            setShowDatePickerIOS(true);
        }
    };

    const handleSave = async () => {
        if (loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const exameLimpo = tipoExame.trim();
        if (!exameLimpo) {
            onSaveError('Por favor, informe o tipo de exame.');
            return;
        }

        const targetUid = activeUserId || auth.currentUser?.uid;
        if (!targetUid) {
            onSaveError('Usuário não autenticado.');
            return;
        }

        if (dataExame.getTime() <= Date.now()) {
            onSaveError('A data e hora do exame já passaram. Escolha uma data futura.');
            return;
        }

        const triggerDate = new Date(dataExame.getTime() - advanceHours * HOUR_MS);
        const title = 'LEMBRETE: EXAME';
        const subtitle = exameLimpo.toUpperCase();

        setLoading(true);
        let newNotificationId: string | null = null;

        try {
            // 1. Agendamento da notificação
            newNotificationId = await NotificationService.scheduleReminder(title, subtitle, triggerDate);

            // 2. Gravação/Atualização no Firestore
            const basePayload = {
                title,
                subtitle,
                categoryKey: 'exame',
                iconFamily: 'MaterialCommunityIcons',
                iconName: 'file-document-outline',
                dataAgendamento: triggerDate.toISOString(),
                notificationId: newNotificationId,
                dadosFormulario: {
                    tipoExame: exameLimpo,
                    advanceHours,
                    exigeJejum,
                    dataExame: dataExame.toISOString(),
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

            // 3. Cancelamento da notificação anterior em caso de reagendamento
            const oldId = editingReminder?.notificationId;
            if (oldId && oldId !== newNotificationId) {
                await NotificationService.cancelReminder(oldId);
            }

            const dateStr = dataExame.toLocaleDateString('pt-BR');
            const timeStr = dataExame.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const jejumText = exigeJejum ? ' (Requer Jejum)' : '';
            let details = `• Exame: ${exameLimpo}${jejumText}\n• Data: ${dateStr} às ${timeStr}`;

            if (!newNotificationId) {
                details += '\n\nAtenção: o aviso não foi agendado (o horário do aviso já passou ou a permissão de notificações está desativada).';
            }

            onSaveSuccess(details);
        } catch (error) {
            console.error('Erro ao salvar exame:', error);
            if (newNotificationId) {
                await NotificationService.cancelReminder(newNotificationId);
            }
            onSaveError('Não foi possível salvar o exame.');
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
    const dateLabel = `${dataExame.toLocaleDateString('pt-BR')} às ${dataExame.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    return (
        <View style={styles.container}>
            <Text style={labelStyle}>TIPO DE EXAME / PROCEDIMENTO</Text>
            <View style={[styles.inputBox, inputBoxHC]}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color={iconColor} />
                <TextInput
                    style={[styles.input, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}
                    placeholder="Ex: Hemograma Completo"
                    placeholderTextColor={isHighContrast ? theme.textSecondary : '#94A3B8'}
                    value={tipoExame}
                    onChangeText={setTipoExame}
                    accessibilityLabel="Tipo de exame ou procedimento"
                />
            </View>

            <Text style={labelStyle}>DATA E HORA DO EXAME</Text>
            <TouchableOpacity
                style={[styles.inputBox, inputBoxHC]}
                onPress={openDateTimePicker}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Data e hora do exame: ${dateLabel}`}
                accessibilityHint="Toque para alterar"
            >
                <MaterialCommunityIcons name="calendar-clock" size={24} color={iconColor} />
                <Text style={[styles.inputValueText, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>
                    {dateLabel}
                </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && showDatePickerIOS && (
                <View>
                    <DateTimePicker
                        value={dataExame}
                        mode="datetime"
                        display="spinner"
                        minimumDate={new Date()}
                        onChange={(_, d) => {
                            if (d) setDataExame(d);
                        }}
                    />
                    <TouchableOpacity
                        style={[styles.confirmPickerBtn, isHighContrast && { backgroundColor: theme.buttonPrimary }]}
                        onPress={() => setShowDatePickerIOS(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Confirmar data e hora"
                    >
                        <Text style={[styles.saveBtnText, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.buttonText }]}>
                            CONFIRMAR
                        </Text>
                    </TouchableOpacity>
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

            <Text style={labelStyle}>EXIGE JEJUM PRÉVIO?</Text>
            <BooleanToggle value={exigeJejum} onChange={setExigeJejum} />

            <TouchableOpacity
                style={[styles.saveBtn, isHighContrast && { backgroundColor: theme.buttonPrimary }, loading && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={editingReminder ? 'Atualizar exame' : 'Salvar exame'}
                accessibilityState={{ disabled: loading, busy: loading }}
            >
                {loading ? (
                    <ActivityIndicator color={isHighContrast ? theme.buttonText : '#FFF'} />
                ) : (
                    <Text style={[styles.saveBtnText, { fontSize: 18 * fontScale }, isHighContrast && { color: theme.buttonText }]}>
                        {editingReminder ? 'ATUALIZAR' : 'SALVAR EXAME'}
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