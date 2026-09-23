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
const parseTime = (val: string | undefined): Date => {
    const d = new Date();
    if (!val || typeof val !== 'string' || !/^\d{2}:\d{2}$/.test(val)) return d;
    const [h, m] = val.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
};

const formatTime = (date: Date): string => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
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
// Wrapper Compartilhado (DRY)
// ---------------------------------------------------------------------------
const FieldWrapper: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        {children}
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

// ---------------------------------------------------------------------------
// TimePickerButton (Relógio Nativo Android/iOS)
// ---------------------------------------------------------------------------
const TimePickerButton: React.FC<{
    value: string;
    error?: string;
    onChange: (v: string) => void;
}> = ({ value, error, onChange }) => {
    const [showPickerIOS, setShowPickerIOS] = useState(false);
    const [iosTime, setIosTime] = useState<Date>(() => parseTime(value));

    const openAndroid = useCallback(() => {
        const current = parseTime(value);
        DateTimePickerAndroid.open({
            value: current,
            mode: 'time',
            is24Hour: true,
            onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
                if (event.type === 'set' && selectedDate) {
                    onChange(formatTime(selectedDate));
                }
            },
        });
    }, [value, onChange]);

    const handleOpen = useCallback(() => {
        if (Platform.OS === 'android') {
            openAndroid();
        } else {
            setIosTime(parseTime(value));
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
                <MaterialCommunityIcons name="clock-outline" size={26} color={themes.colors.primary} />
                <Text style={[styles.inputValue, !value && styles.placeholderText]}>
                    {value || 'Toque para escolher o horário'}
                </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
                <Modal visible={showPickerIOS} transparent animationType="slide" onRequestClose={() => setShowPickerIOS(false)}>
                    <View style={iModal.overlay}>
                        <View style={iModal.sheet}>
                            <DateTimePicker
                                value={iosTime}
                                mode="time"
                                display="spinner"
                                is24Hour={true}
                                onChange={(_event, selected?: Date) => {
                                    if (selected) setIosTime(selected);
                                }}
                                locale="pt-BR"
                            />
                            <TouchableOpacity
                                style={iModal.confirmBtn}
                                onPress={() => {
                                    onChange(formatTime(iosTime));
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
// DateButton
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
                return (
                    <TimePickerButton
                        value={(value as string) || ''}
                        error={error}
                        onChange={onChange}
                    />
                );

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

const iModal = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, paddingTop: 12 },
    confirmBtn: { marginHorizontal: 24, marginTop: 12, backgroundColor: GREEN, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});