import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FormFieldConfig, FieldType } from '../../config/reminderFormConfig';
import { themes } from '../../global/themes';

interface DynamicFieldProps {
    field: FormFieldConfig;
    value: any;
    error?: string;
    onChange: (value: any) => void;
}

/**
 * Renderizador de Campo de Texto
 */
function TextInputRenderer({ field, value, error, onChange }: DynamicFieldProps) {
    const hasError = !!error;

    return (
        <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
                {field.label} {field.required && <Text style={styles.requiredMark}>*</Text>}
            </Text>
            <TextInput
                style={[
                    styles.textInput,
                    hasError && styles.inputErrorBorder,
                ]}
                placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                placeholderTextColor="#999"
                value={value !== undefined && value !== null ? String(value) : ''}
                onChangeText={onChange}
                accessibilityLabel={field.label}
                accessibilityHint={field.placeholder}
            />
            {hasError && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

/**
 * Renderizador de Campo de Horário (< [ 14 ] : [ 30 ] >)
 */
function TimePickerRenderer({ field, value, error, onChange }: DynamicFieldProps) {
    // value esperado no formato 'HH:mm'
    const timeParts = typeof value === 'string' && value.includes(':')
        ? value.split(':')
        : ['14', '30'];

    let hours = parseInt(timeParts[0], 10) || 0;
    let minutes = parseInt(timeParts[1], 10) || 0;

    const updateTime = (h: number, m: number) => {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        onChange(`${hh}:${mm}`);
    };

    const increment = () => {
        let newMin = minutes + 15;
        let newHour = hours;
        if (newMin >= 60) {
            newMin = 0;
            newHour = (newHour + 1) % 24;
        }
        updateTime(newHour, newMin);
    };

    const decrement = () => {
        let newMin = minutes - 15;
        let newHour = hours;
        if (newMin < 0) {
            newMin = 45;
            newHour = (newHour - 1 + 24) % 24;
        }
        updateTime(newHour, newMin);
    };

    return (
        <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
                {field.label} {field.required && <Text style={styles.requiredMark}>*</Text>}
            </Text>
            <View style={styles.timePickerRow}>
                <TouchableOpacity
                    style={styles.timeArrowButton}
                    activeOpacity={0.7}
                    onPress={decrement}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir horário em 15 minutos"
                >
                    <Feather name="chevron-left" size={28} color={themes.colors.secureGreen} />
                </TouchableOpacity>

                <View style={styles.timeBox}>
                    <Text style={styles.timeText}>{hours.toString().padStart(2, '0')}</Text>
                </View>

                <Text style={styles.timeColon}>:</Text>

                <View style={styles.timeBox}>
                    <Text style={styles.timeText}>{minutes.toString().padStart(2, '0')}</Text>
                </View>

                <TouchableOpacity
                    style={styles.timeArrowButton}
                    activeOpacity={0.7}
                    onPress={increment}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar horário em 15 minutos"
                >
                    <Feather name="chevron-right" size={28} color={themes.colors.secureGreen} />
                </TouchableOpacity>
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

/**
 * Renderizador de Campo Booleano (SIM / NÃO)
 */
function BooleanToggleRenderer({ field, value, onChange }: DynamicFieldProps) {
    const isYes = value === true;

    return (
        <View style={styles.fieldContainer}>
            <View style={styles.booleanRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <View style={styles.pillToggle}>
                    <TouchableOpacity
                        style={[
                            styles.pillOption,
                            isYes && styles.pillOptionActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => onChange(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`${field.label}: SIM`}
                    >
                        <Text style={[styles.pillText, isYes && styles.pillTextActive]}>
                            SIM
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.pillOption,
                            !isYes && styles.pillOptionActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => onChange(false)}
                        accessibilityRole="button"
                        accessibilityLabel={`${field.label}: NÃO`}
                    >
                        <Text style={[styles.pillText, !isYes && styles.pillTextActive]}>
                            NÃO
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

/**
 * Factory de Renderizadores (Factory Pattern / Strategy Pattern)
 * Elimina if/else acoplados para desenhar os campos.
 */
const FIELD_RENDERER_FACTORY: Record<
    FieldType,
    React.ComponentType<DynamicFieldProps>
> = {
    text: TextInputRenderer,
    date: TextInputRenderer,
    number: TextInputRenderer,
    time: TimePickerRenderer,
    boolean: BooleanToggleRenderer,
};

/**
 * Componente principal que despacha a renderização com base no tipo do campo
 */
export function DynamicFieldRenderer(props: DynamicFieldProps) {
    const Renderer = FIELD_RENDERER_FACTORY[props.field.type] || TextInputRenderer;
    return <Renderer {...props} />;
}

const styles = StyleSheet.create({
    fieldContainer: {
        marginBottom: 16,
        width: '100%',
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    requiredMark: {
        color: themes.colors.darkRed,
        fontWeight: 'bold',
    },
    textInput: {
        borderWidth: 1.5,
        borderColor: themes.colors.secureGreen,
        borderRadius: 25,
        paddingHorizontal: 18,
        paddingVertical: 12,
        fontSize: 13.5,
        color: themes.colors.notBlack,
        backgroundColor: '#FFFFFF',
    },
    inputErrorBorder: {
        borderColor: themes.colors.darkRed,
        backgroundColor: '#FFF8F8',
    },
    errorText: {
        color: themes.colors.darkRed,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 12,
        fontWeight: '600',
    },
    timePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginVertical: 4,
    },
    timeArrowButton: {
        padding: 8,
    },
    timeBox: {
        borderWidth: 1.5,
        borderColor: '#CCCCCC',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#F5F5F5',
    },
    timeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },
    timeColon: {
        fontSize: 26,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },
    booleanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    pillToggle: {
        flexDirection: 'row',
        backgroundColor: '#E0E0E0',
        borderRadius: 20,
        padding: 3,
    },
    pillOption: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 18,
    },
    pillOptionActive: {
        backgroundColor: themes.colors.secureGreen,
    },
    pillText: {
        fontSize: 12.5,
        fontWeight: 'bold',
        color: '#666',
    },
    pillTextActive: {
        color: '#FFFFFF',
    },
});

