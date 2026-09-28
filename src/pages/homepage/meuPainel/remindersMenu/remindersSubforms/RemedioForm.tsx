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
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../../../config/firebaseConfig';
import { themes } from '../../../../../global/themes';
import { BooleanToggle } from '../../../../../components/BooleanToggle';

export interface SubformProps {
    editingReminder?: any;
    onSaveSuccess: (details?: string) => void;
    onSaveError: (errorMessage?: string) => void;
}

export function RemedioForm({ editingReminder, onSaveSuccess, onSaveError }: SubformProps) {
    const [loading, setLoading] = useState(false);

    const [nomeRemedio, setNomeRemedio] = useState(editingReminder?.dadosFormulario?.nomeRemedio || '');
    const [horario, setHorario] = useState(editingReminder?.dadosFormulario?.time || '08:00');
    const [advanceHours, setAdvanceHours] = useState<number>(editingReminder?.dadosFormulario?.advanceHours || 0);
    const [repetirDiariamente, setRepetirDiariamente] = useState<boolean>(editingReminder?.dadosFormulario?.repetirDiariamente ?? true);

    const [showTimePicker, setShowTimePicker] = useState(false);

    const handleSave = async () => {
        if (!nomeRemedio.trim()) {
            onSaveError('Por favor, informe o nome do medicamento.');
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            onSaveError('Utilizador não autenticado.');
            return;
        }

        setLoading(true);
        try {
            const now = new Date();
            const [h, m] = horario.split(':').map(Number);
            const triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

            if (triggerDate.getTime() <= Date.now()) {
                triggerDate.setDate(triggerDate.getDate() + 1);
            }

            if (advanceHours > 0) {
                triggerDate.setHours(triggerDate.getHours() - advanceHours);
            }

            const payload = {
                title: 'LEMBRETE: REMÉDIO',
                subtitle: nomeRemedio.toUpperCase(),
                categoryKey: 'remedio',
                iconFamily: 'MaterialCommunityIcons',
                iconName: 'pill',
                dataAgendamento: triggerDate.toISOString(),
                criadoEm: new Date().toISOString(),
                dadosFormulario: {
                    nomeRemedio,
                    time: horario,
                    advanceHours,
                    repetirDiariamente,
                },
            };

            if (editingReminder?.id) {
                await updateDoc(doc(db, 'users', userId, 'reminders', editingReminder.id), payload);
            } else {
                const newDocRef = doc(db, 'users', userId, 'reminders', `rem_${Date.now()}`);
                await setDoc(newDocRef, payload);
            }

            const advanceText = advanceHours > 0 ? ` (Avisar ${advanceHours}h antes)` : '';
            onSaveSuccess(`• Medicamento: ${nomeRemedio}\n• Horário: ${horario}${advanceText}`);
        } catch (error) {
            console.error('Erro ao salvar remédio:', error);
            onSaveError('Não foi possível guardar o lembrete.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>NOME DO MEDICAMENTO</Text>
            <View style={styles.inputBox}>
                <MaterialCommunityIcons name="pill" size={24} color={themes.colors.secureGreen} />
                <TextInput
                    style={styles.input}
                    placeholder="Ex: Paracetamol 500mg"
                    placeholderTextColor="#94A3B8"
                    value={nomeRemedio}
                    onChangeText={setNomeRemedio}
                />
            </View>

            <Text style={styles.label}>HORÁRIO DA MEDICAÇÃO</Text>
            <TouchableOpacity
                style={styles.inputBox}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.8}
            >
                <MaterialCommunityIcons name="clock-outline" size={24} color={themes.colors.secureGreen} />
                <Text style={styles.inputValueText}>{horario}</Text>
            </TouchableOpacity>

            {showTimePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowTimePicker(false);
                        if (date) {
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            setHorario(`${hours}:${minutes}`);
                        }
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

            <Text style={styles.label}>REPETIR DIARIAMENTE?</Text>
            <BooleanToggle
                value={repetirDiariamente}
                onChange={setRepetirDiariamente}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
                {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.saveBtnText}>{editingReminder ? 'ATUALIZAR' : 'SALVAR REMÉDIO'}</Text>
                )}
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