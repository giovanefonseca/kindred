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
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../../../config/firebaseConfig';
import { themes } from '../../../../../global/themes';
import { BooleanToggle } from '../../../../../components/BooleanToggle';

export interface SubformProps {
    editingReminder?: any;
    onSaveSuccess: (details?: string) => void;
    onSaveError: (errorMessage?: string) => void;
}

export function ConsultaForm({ editingReminder, onSaveSuccess, onSaveError }: SubformProps) {
    const [loading, setLoading] = useState(false);

    const [especialidade, setEspecialidade] = useState(editingReminder?.dadosFormulario?.especialidade || '');
    const [dataConsulta, setDataConsulta] = useState<Date>(
        editingReminder?.dataAgendamento ? new Date(editingReminder.dataAgendamento) : new Date()
    );
    const [advanceHours, setAdvanceHours] = useState<number>(editingReminder?.dadosFormulario?.advanceHours || 2);
    const [levarExames, setLevarExames] = useState<boolean>(editingReminder?.dadosFormulario?.levarExames ?? true);

    const [showDatePickerIOS, setShowDatePickerIOS] = useState(false);

    // Método seguro para abrir o seletor no Android (Data -> Hora)
    const openDateTimePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: dataConsulta,
                mode: 'date',
                onChange: (event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                        const newDate = new Date(selectedDate);
                        
                        // Após selecionar a data, abre a seleção de horário
                        DateTimePickerAndroid.open({
                            value: newDate,
                            mode: 'time',
                            is24Hour: true,
                            onChange: (timeEvent, selectedTime) => {
                                if (timeEvent.type === 'set' && selectedTime) {
                                    newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
                                    setDataConsulta(newDate);
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
        if (!especialidade.trim()) {
            onSaveError('Por favor, informe a especialidade ou nome do médico.');
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            onSaveError('Utilizador não autenticado.');
            return;
        }

        setLoading(true);
        try {
            const triggerDate = new Date(dataConsulta);
            if (advanceHours > 0) {
                triggerDate.setHours(triggerDate.getHours() - advanceHours);
            }

            const payload = {
                title: 'LEMBRETE: CONSULTA',
                subtitle: especialidade.toUpperCase(),
                categoryKey: 'consulta',
                iconFamily: 'MaterialCommunityIcons',
                iconName: 'doctor',
                dataAgendamento: triggerDate.toISOString(),
                criadoEm: new Date().toISOString(),
                dadosFormulario: {
                    especialidade,
                    advanceHours,
                    levarExames,
                },
            };

            if (editingReminder?.id) {
                await updateDoc(doc(db, 'users', userId, 'reminders', editingReminder.id), payload);
            } else {
                const newDocRef = doc(db, 'users', userId, 'reminders', `rem_${Date.now()}`);
                await setDoc(newDocRef, payload);
            }

            const dateStr = dataConsulta.toLocaleDateString('pt-BR');
            const timeStr = dataConsulta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            onSaveSuccess(`• Especialidade: ${especialidade}\n• Data: ${dateStr} às ${timeStr}`);
        } catch (error) {
            console.error('Erro ao salvar consulta:', error);
            onSaveError('Não foi possível guardar a consulta.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>ESPECIALIDADE OU MÉDICO</Text>
            <View style={styles.inputBox}>
                <MaterialCommunityIcons name="doctor" size={24} color={themes.colors.secureGreen} />
                <TextInput
                    style={styles.input}
                    placeholder="Ex: Cardiologista - Dr. Silva"
                    placeholderTextColor="#94A3B8"
                    value={especialidade}
                    onChangeText={setEspecialidade}
                />
            </View>

            <Text style={styles.label}>DATA E HORA DA CONSULTA</Text>
            <TouchableOpacity style={styles.inputBox} onPress={openDateTimePicker} activeOpacity={0.8}>
                <MaterialCommunityIcons name="calendar-clock" size={24} color={themes.colors.secureGreen} />
                <Text style={styles.inputValueText}>
                    {dataConsulta.toLocaleDateString('pt-BR')} às {dataConsulta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && showDatePickerIOS && (
                <DateTimePicker
                    value={dataConsulta}
                    mode="datetime"
                    display="spinner"
                    onChange={(e, d) => {
                        setShowDatePickerIOS(false);
                        if (d) setDataConsulta(d);
                    }}
                />
            )}

            <Text style={styles.label}>AVISAR COM ANTECEDÊNCIA?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {[0, 1, 2, 3, 4, 6, 12, 24].map((h) => (
                    <TouchableOpacity
                        key={h}
                        style={[styles.chip, advanceHours === h && styles.chipSelected]}
                        onPress={() => setAdvanceHours(h)}
                    >
                        <Text style={[styles.chipText, advanceHours === h && styles.chipTextSelected]}>
                            {h === 0 ? 'Na Hora' : `${h}h antes`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.label}>LEVAR EXAMES ANTERIORES?</Text>
            <BooleanToggle value={levarExames} onChange={setLevarExames} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editingReminder ? 'ATUALIZAR' : 'SALVAR CONSULTA'}</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 14 },
    label: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 6 },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
    },
    input: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    inputValueText: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    chipsRow: { gap: 8, paddingVertical: 4 },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
    },
    chipSelected: { backgroundColor: themes.colors.secureGreen, borderColor: 'transparent' },
    chipText: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
    chipTextSelected: { color: '#FFFFFF' },
    saveBtn: {
        backgroundColor: themes.colors.primary,
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 16,
        elevation: 3,
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});