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

export function ExameForm({ editingReminder, onSaveSuccess, onSaveError }: SubformProps) {
    const [loading, setLoading] = useState(false);

    const [tipoExame, setTipoExame] = useState(editingReminder?.dadosFormulario?.tipoExame || '');
    const [dataExame, setDataExame] = useState<Date>(
        editingReminder?.dataAgendamento ? new Date(editingReminder.dataAgendamento) : new Date()
    );
    const [advanceHours, setAdvanceHours] = useState<number>(editingReminder?.dadosFormulario?.advanceHours || 2);
    const [exigeJejum, setExigeJejum] = useState<boolean>(editingReminder?.dadosFormulario?.exigeJejum ?? false);

    const [showDatePickerIOS, setShowDatePickerIOS] = useState(false);

    const openDateTimePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: dataExame,
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
        if (!tipoExame.trim()) {
            onSaveError('Por favor, informe o tipo de exame.');
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            onSaveError('Utilizador não autenticado.');
            return;
        }

        setLoading(true);
        try {
            const triggerDate = new Date(dataExame);
            if (advanceHours > 0) {
                triggerDate.setHours(triggerDate.getHours() - advanceHours);
            }

            const payload = {
                title: 'LEMBRETE: EXAME',
                subtitle: tipoExame.toUpperCase(),
                categoryKey: 'exame',
                iconFamily: 'MaterialCommunityIcons',
                iconName: 'file-document-outline',
                dataAgendamento: triggerDate.toISOString(),
                criadoEm: new Date().toISOString(),
                dadosFormulario: {
                    tipoExame,
                    advanceHours,
                    exigeJejum,
                },
            };

            if (editingReminder?.id) {
                await updateDoc(doc(db, 'users', userId, 'reminders', editingReminder.id), payload);
            } else {
                const newDocRef = doc(db, 'users', userId, 'reminders', `rem_${Date.now()}`);
                await setDoc(newDocRef, payload);
            }

            const dateStr = dataExame.toLocaleDateString('pt-BR');
            const timeStr = dataExame.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const jejumText = exigeJejum ? ' (Requer Jejum)' : '';
            onSaveSuccess(`• Exame: ${tipoExame}${jejumText}\n• Data: ${dateStr} às ${timeStr}`);
        } catch (error) {
            console.error('Erro ao salvar exame:', error);
            onSaveError('Não foi possível guardar o exame.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>TIPO DE EXAME / PROCEDIMENTO</Text>
            <View style={styles.inputBox}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color={themes.colors.secureGreen} />
                <TextInput
                    style={styles.input}
                    placeholder="Ex: Hemograma Completo"
                    placeholderTextColor="#94A3B8"
                    value={tipoExame}
                    onChangeText={setTipoExame}
                />
            </View>

            <Text style={styles.label}>DATA E HORA DO EXAME</Text>
            <TouchableOpacity style={styles.inputBox} onPress={openDateTimePicker} activeOpacity={0.8}>
                <MaterialCommunityIcons name="calendar-clock" size={24} color={themes.colors.secureGreen} />
                <Text style={styles.inputValueText}>
                    {dataExame.toLocaleDateString('pt-BR')} às {dataExame.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && showDatePickerIOS && (
                <DateTimePicker
                    value={dataExame}
                    mode="datetime"
                    display="spinner"
                    onChange={(e, d) => {
                        setShowDatePickerIOS(false);
                        if (d) setDataExame(d);
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

            <Text style={styles.label}>EXIGE JEJUM PRÉVIO?</Text>
            <BooleanToggle value={exigeJejum} onChange={setExigeJejum} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editingReminder ? 'ATUALIZAR' : 'SALVAR EXAME'}</Text>}
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