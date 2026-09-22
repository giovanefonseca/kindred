import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { themes } from '../../global/themes';
import { BooleanToggle } from '../BooleanToggle';

// ---------------------------------------------------------------------------
// Tipagens (Eliminação de `any`)
// ---------------------------------------------------------------------------
export type FieldType = 'date' | 'datetime' | 'time' | 'boolean' | 'number' | 'text';

export interface FieldDef {
    type: FieldType;
    label: string;
    placeholder?: string;
}

export interface DynamicFieldProps {
    field: FieldDef;
    value: string | number | boolean | undefined;
    error?: string;
    onChange: (v: any) => void;
}

const GREEN = themes.colors.secureGreen;  // #198754

// ---------------------------------------------------------------------------
// Helpers (Puros e performáticos)
// ---------------------------------------------------------------------------
const parseTime = (val: string): { h: number; m: number } => {
    if (!val || typeof val !== 'string' || !/^\d{2}:\d{2}$/.test(val)) return { h: 0, m: 0 };
    const [h, m] = val.split(':').map(Number);
    return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
};

const formatTime = (h: number, m: number): string => {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getSafeDate = (val: string | undefined): Date => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
};

const formatDisplayDate = (val: string | undefined, mode: 'date' | 'datetime'): string => {
    if (!val) return 'Toque para escolher a data';
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Toque para escolher a data';
    try {
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            ...(mode === 'datetime' && { hour: '2-digit', minute: '2-digit' }),
        });
    } catch {
        return 'Toque para escolher a data';
    }
};

// ---------------------------------------------------------------------------
// Wrapper Compartilhado (DRY) - Remove repetição de labels e erros
// ---------------------------------------------------------------------------
const FieldWrapper: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        {children}
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

// ---------------------------------------------------------------------------
// TimeStepper
// ---------------------------------------------------------------------------
const TimeStepper: React.FC<{ value: string; onChange: (v: string) => void }> = React.memo(({ value, onChange }) => {
    const { h, m } = parseTime(value);

    const changeMinutes = useCallback((deltaMinutes: number) => {
        const totalMins = h * 60 + m;
        const newTotal = (totalMins + deltaMinutes + 24 * 60) % (24 * 60);
        const newH = Math.floor(newTotal / 60);
        const newM = newTotal % 60;
        onChange(formatTime(newH, newM));
    }, [h, m, onChange]);

    return (
        <View style={ts.row}>
            <TouchableOpacity
                style={ts.arrowBtn}
                onPress={() => changeMinutes(-15)}
                activeOpacity={0.7}
                accessibilityLabel="Subtrair 5 minutos"
            >
                <Text style={ts.arrow}>{'<'}</Text>
            </TouchableOpacity>

            <View style={ts.valueBox}>
                <Text style={ts.valueText}>{String(h).padStart(2, '0')}</Text>
            </View>
            <Text style={ts.colon}>:</Text>
            <View style={ts.valueBox}>
                <Text style={ts.valueText}>{String(m).padStart(2, '0')}</Text>
            </View>

            <TouchableOpacity
                style={ts.arrowBtn}
                onPress={() => changeMinutes(15)}
                activeOpacity={0.7}
                accessibilityLabel="Adicionar 5 minutos"
            >
                <Text style={ts.arrow}>{'>'}</Text>
            </TouchableOpacity>
        </View>
    );
});

// ---------------------------------------------------------------------------
// DateButton (SRP: Apenas gerencia lógica do botão/modal de data)
// ---------------------------------------------------------------------------
const DateButton: React.FC<{
    mode: 'date' | 'datetime';
    value: string;
    error?: string;
    onChange: (v: string) => void;
}> = ({ mode, value, error, onChange }) => {
    const [showPickerIOS, setShowPickerIOS] = useState(false);
    const [iosDate, setIosDate] = useState<Date>(() => getSafeDate(value));

    const openAndroid = useCallback(() => {
        const current = getSafeDate(value);
        DateTimePickerAndroid.open({
            value: current,
            mode: 'date',
            minimumDate: new Date(),
            onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
                if (event.type !== 'set' || !selectedDate) return;

                if (mode === 'datetime') {
                    DateTimePickerAndroid.open({
                        value: selectedDate,
                        mode: 'time',
                        is24Hour: true,
                        onChange: (evTime: DateTimePickerEvent, finalDate?: Date) => {
                            if (evTime.type === 'set' && finalDate) {
                                onChange(finalDate.toISOString());
                            }
                        },
                    });
                } else {
                    onChange(selectedDate.toISOString());
                }
            },
        });
    }, [value, mode, onChange]);

    const handleOpen = useCallback(() => {
        if (Platform.OS === 'android') {
            openAndroid();
        } else {
            setIosDate(getSafeDate(value));
            setShowPickerIOS(true);
        }
    }, [openAndroid, value]);

    return (
        <>
            <TouchableOpacity
                style={[styles.inputWrapper, error && styles.inputError]}
                onPress={handleOpen}
                activeOpacity={0.7}
            >
                <MaterialCommunityIcons name="calendar-clock" size={26} color={themes.colors.primary} />
                <Text style={[styles.inputValue, !value && styles.placeholderText]}>
                    {formatDisplayDate(value, mode)}
                </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
                <Modal visible={showPickerIOS} transparent animationType="slide" onRequestClose={() => setShowPickerIOS(false)}>
                    <View style={iModal.overlay}>
                        <View style={iModal.sheet}>
                            <DateTimePicker
                                value={iosDate}
                                mode={mode}
                                display="spinner"
                                onChange={(_event, selected?: Date) => {
                                    if (selected) setIosDate(selected);
                                }}
                                minimumDate={new Date()}
                                locale="pt-BR"
                            />
                            <TouchableOpacity
                                style={iModal.confirmBtn}
                                onPress={() => {
                                    onChange(iosDate.toISOString());
                                    setShowPickerIOS(false);
                                }}
                            >
                                <Text style={iModal.confirmText}>CONFIRMAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </>
    );
};

// ---------------------------------------------------------------------------
// Componente Principal - Roteador de Renderização
// ---------------------------------------------------------------------------
export function DynamicFieldRenderer({ field, value, error, onChange }: DynamicFieldProps) {
    
    const renderField = () => {
        switch (field.type) {
            case 'date':
            case 'datetime':
                return (
                    <DateButton
                        mode={field.type}
                        value={value as string}
                        error={error}
                        onChange={onChange}
                    />
                );

            case 'time':
                return <TimeStepper value={(value as string) || '00:00'} onChange={onChange} />;

            case 'boolean':
                return <BooleanToggle value={value === undefined ? false : Boolean(value)} onChange={onChange} />;

            case 'number':
                return (
                    <View style={[styles.inputWrapper, error && styles.inputError]}>
                        <TextInput
                            style={styles.textInput}
                            value={value !== undefined && value !== null ? String(value) : ''}
                            onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
                            placeholder={field.placeholder || ''}
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                        />
                    </View>
                );

            case 'text':
            default:
                return (
                    <View style={[styles.inputWrapper, error && styles.inputError]}>
                        <TextInput
                            style={styles.textInput}
                            value={(value as string) || ''}
                            onChangeText={onChange}
                            placeholder={field.placeholder || ''}
                            placeholderTextColor="#999"
                        />
                    </View>
                );
        }
    };

    return (
        <FieldWrapper label={field.label} error={error}>
            {renderField()}
        </FieldWrapper>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 16, width: '100%' },
    label: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 6, marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA',
        borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 16,
        paddingVertical: 14, paddingHorizontal: 16, minHeight: 52,
    },
    inputError: { borderColor: '#d9534f' },
    textInput: { flex: 1, fontSize: 16, color: '#333' },
    inputValue: { fontSize: 16, color: '#333', marginLeft: 12, flex: 1 },
    placeholderText: { color: '#999' },
    errorText: { color: '#d9534f', fontSize: 12, fontWeight: 'bold', marginTop: 4, marginLeft: 4 },
});

const ts = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    arrowBtn: { width: 48, height: 58, alignItems: 'center', justifyContent: 'center' },
    arrow: { marginTop: -18, fontSize: 60, fontWeight: 'bold', color: GREEN },
    valueBox: {
        width: 68, height: 68, borderRadius: 16, borderWidth: 2, borderColor: GREEN,
        backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center',
    },
    valueText: { fontSize: 30, fontWeight: 'bold', color: '#111' },
    colon: { fontSize: 30, fontWeight: 'bold', color: '#111', marginHorizontal: 6 },
});

const iModal = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, paddingTop: 12 },
    confirmBtn: { marginHorizontal: 24, marginTop: 12, backgroundColor: GREEN, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});