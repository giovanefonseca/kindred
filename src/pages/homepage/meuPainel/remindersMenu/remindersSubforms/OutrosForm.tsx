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
import { SubformProps } from '../SetReminderView';

export function OutrosForm({ editingReminder, activeUserId, onSaveSuccess, onSaveError }: SubformProps) {
    const [loading, setLoading] = useState(false);
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const [titulo, setTitulo] = useState(editingReminder?.dadosFormulario?.titulo || '');
    const [dataEvento, setDataEvento] = useState<Date>(
        editingReminder?.dataAgendamento ? new Date(editingReminder.dataAgendamento) : new Date()
    );
    const [advanceHours, setAdvanceHours] = useState<number>(editingReminder?.dadosFormulario?.advanceHours || 0);
    const [repetirDiariamente, setRepetirDiariamente] = useState<boolean>(
        editingReminder?.dadosFormulario?.repetirDiariamente ?? false
    );
    const [showDatePickerIOS, setShowDatePickerIOS] = useState(false);

    const openDateTimePicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: dataEvento,
                mode: 'date',
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
                                    setDataEvento(newDate);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!titulo.trim()) {
            onSaveError('Por favor, informe o título do lembrete.');
            return;
        }

        const targetUid = activeUserId || auth.currentUser?.uid;
        if (!targetUid) {
            onSaveError('Utilizador não autenticado.');
            return;
        }

        setLoading(true);
        try {
            const triggerDate = new Date(dataEvento);
            if (advanceHours > 0) {
                triggerDate.setHours(triggerDate.getHours() - advanceHours);
            }

            if (editingReminder?.notificationId) {
                await NotificationService.cancelReminder(editingReminder.notificationId);
            }

            const notificationId = await NotificationService.scheduleReminder(
                'LEMBRETE',
                titulo.toUpperCase(),
                triggerDate
            );

            const payload = {
                title: 'LEMBRETE',
                subtitle: titulo.toUpperCase(),
                categoryKey: 'outros',
                iconFamily: 'MaterialCommunityIcons',
                iconName: 'bell-outline',
                dataAgendamento: triggerDate.toISOString(),
                criadoEm: new Date().toISOString(),
                notificationId: notificationId || null,
                dadosFormulario: {
                    titulo,
                    advanceHours,
                    repetirDiariamente,
                },
            };

            let docRef;
            if (editingReminder?.id) {
                docRef = doc(db, 'users', targetUid, 'reminders', editingReminder.id);
                await updateDoc(docRef, payload);
            } else {
                const newDocId = `rem_${Date.now()}`;
                docRef = doc(db, 'users', targetUid, 'reminders', newDocId);
                await setDoc(docRef, payload);
            }

            const dateStr = dataEvento.toLocaleDateString('pt-BR');
            const timeStr = dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            onSaveSuccess(`• Título: ${titulo}\n• Data: ${dateStr} às ${timeStr}`);
        } catch (error) {
            console.error('Erro ao salvar lembrete:', error);
            onSaveError('Não foi possível guardar o lembrete.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>TÍTULO DO LEMBRETE</Text>
            <View style={[styles.inputBox, isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1.5 }]}>
                <MaterialCommunityIcons name="bell-outline" size={24} color={isHighContrast ? theme.buttonPrimary : themes.colors.secureGreen} />
                <TextInput
                    style={[styles.input, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}
                    placeholder="Ex: Medir Pressão / Caminhada"
                    placeholderTextColor={isHighContrast ? theme.textSecondary : "#94A3B8"}
                    value={titulo}
                    onChangeText={setTitulo}
                />
            </View>

            <Text style={[styles.label, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>DATA E HORA DO EVENTO</Text>
            <TouchableOpacity style={[styles.inputBox, isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1.5 }]} onPress={openDateTimePicker} activeOpacity={0.8}>
                <MaterialCommunityIcons name="calendar-clock" size={24} color={isHighContrast ? theme.buttonPrimary : themes.colors.secureGreen} />
                <Text style={[styles.inputValueText, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>
                    {dataEvento.toLocaleDateString('pt-BR')} às {dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && showDatePickerIOS && (
                <DateTimePicker
                    value={dataEvento}
                    mode="datetime"
                    display="spinner"
                    onChange={(e, d) => {
                        setShowDatePickerIOS(false);
                        if (d) setDataEvento(d);
                    }}
                />
            )}

            <Text style={[styles.label, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>AVISAR COM ANTECEDÊNCIA?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {[0, 1, 2, 3, 4, 6, 12, 24].map((h) => {
                    const isSelected = advanceHours === h;
                    return (
                        <TouchableOpacity
                            key={h}
                            style={[styles.chip, isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }, isSelected && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.chipSelected)]}
                            onPress={() => setAdvanceHours(h)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.chipText, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }, isSelected && (isHighContrast ? { color: theme.buttonText } : styles.chipTextSelected)]}>
                                {h === 0 ? 'Na Hora' : `${h}h antes`}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={[styles.label, { fontSize: 16 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>REPETIR DIARIAMENTE?</Text>
            <BooleanToggle value={repetirDiariamente} onChange={setRepetirDiariamente} />

            <TouchableOpacity style={[styles.saveBtn, isHighContrast && { backgroundColor: theme.buttonPrimary }]} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color={isHighContrast ? theme.buttonText : "#FFF"} /> : <Text style={[styles.saveBtnText, { fontSize: 18 * fontScale }, isHighContrast && { color: theme.buttonText }]}>{editingReminder ? 'ATUALIZAR' : 'SALVAR LEMBRETE'}</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 14 },
    label: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
    input: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    inputValueText: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    chipsRow: { gap: 8, paddingVertical: 4 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#CBD5E1' },
    chipSelected: { backgroundColor: themes.colors.secureGreen, borderColor: 'transparent' },
    chipText: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
    chipTextSelected: { color: '#FFFFFF' },
    saveBtn: { backgroundColor: themes.colors.primary, paddingVertical: 18, borderRadius: 20, alignItems: 'center', marginTop: 16, elevation: 3 },
    saveBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});