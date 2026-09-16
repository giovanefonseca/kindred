import { NotificationService } from '../../../services/NotificationService';
import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from 'react-native';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';

// Importações do ecossistema existente
import { themes } from '../../../global/themes';
import {
    getReminderCategories,
    ReminderCategoryConfig,
    createInitialCategoryState,
    validateCategoryPayload,
} from '../../../config/reminderFormConfig';
import { DynamicFieldRenderer } from '../../../components/DynamicForm/DynamicFieldRenderer';

// Injeção de dependência da camada de domínio (Context API)
import { useReminders } from '../../../contexts/ReminderContext';

interface SetReminderViewProps {
    onSaveSuccess?: () => void;
}

export function SetReminderView({ onSaveSuccess }: SetReminderViewProps) {
    // 1. Dependências Injetadas
    const categories = getReminderCategories();
    const { addReminder } = useReminders(); 

    // 2. Gerenciamento de Estado Local (Formulário)
    const [selectedCategory, setSelectedCategory] = useState<ReminderCategoryConfig>(categories[0]);
    
    const [formValues, setFormValues] = useState<Record<string, any>>(() =>
        createInitialCategoryState(categories[0])
    );
    
    const [errors, setErrors] = useState<Record<string, string>>({});

    /**
     * Alterna de categoria gerenciando a memória e limpando dados "fantasmas"
     */
    const handleCategoryChange = (category: ReminderCategoryConfig) => {
        if (category.key === selectedCategory.key) return;

        setSelectedCategory(category);
        // Reseta o estado apenas com os valores padrões da nova categoria selecionada
        setFormValues(createInitialCategoryState(category));
        // Limpa erros de validação anteriores
        setErrors({});
    };

    /**
     * Atualiza o valor de um campo e remove seu erro correspondente se válido
     */
    const handleFieldChange = (fieldName: string, value: any) => {
        setFormValues((prev) => ({
            ...prev,
            [fieldName]: value,
        }));

        if (errors[fieldName]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }
    };

    /**
     * Validação e submissão do payload para o Contexto Global
     */
const handleSave = async () => { // Transforme em assíncrona
        const { isValid, errors: validationErrors, cleanPayload } = validateCategoryPayload(
            selectedCategory,
            formValues
        );

        if (!isValid) {
            setErrors(validationErrors);
            return Alert.alert(
                'Atenção',
                'Por favor, preencha corretamente os campos destacados em vermelho antes de salvar.'
            );
        }

        const firstPayloadValue = Object.values(cleanPayload).find(val => val !== '' && val != null);
        const subtitleStr = firstPayloadValue 
            ? String(firstPayloadValue).toUpperCase() 
            : 'NOVO LEMBRETE CONFIGURADO';

        // 1. Injeção no Domínio Global (Context API)
        addReminder({
            title: `LEMBRETE: ${selectedCategory.label.toUpperCase()}`,
            subtitle: subtitleStr,
            categoryKey: selectedCategory.key,
            iconFamily: selectedCategory.iconFamily || 'MaterialCommunityIcons',
            iconName: selectedCategory.iconName || 'bell-outline',
        });

        // 2. DISPARO DO AGENDAMENTO (NOVO CÓDIGO)
        // Nota: Assumo que seu formValues ou cleanPayload tenha um campo que represente a Data/Hora.
        // Adapte 'cleanPayload.datetime' para a chave real que você utiliza no seu formulário dinâmico.
        const reminderDate = cleanPayload.datetime || cleanPayload.date || cleanPayload.time; 
        
        if (reminderDate) {
            // Converte o valor dinâmico para um objeto Date real, se já não for
            const triggerDate = new Date(reminderDate);
            
            // Valida se a data está no futuro antes de agendar
            if (triggerDate.getTime() > Date.now()) {
                await NotificationService.scheduleReminder(
                    `Lembrete: ${selectedCategory.label}`,
                    subtitleStr,
                    triggerDate
                );
            } else {
                console.warn('Data de agendamento no passado, notificação ignorada.');
            }
        }

        const details = Object.entries(cleanPayload)
            .map(([k, v]) => `• ${k}: ${typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v}`)
            .join('\n');

        Alert.alert(
            `Lembrete Salvo (${selectedCategory.label})`,
            `Dados registrados com sucesso:\n\n${details}`,
            [{ text: 'Concluir', onPress: onSaveSuccess }]
        );
    };

    // Helper estrutural para renderizar o ícone de categoria dinamicamente
    const renderCategoryIcon = (cat: ReminderCategoryConfig) => {
        if (cat.iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={cat.iconName as any} size={24} color="#FFFFFF" />;
        }
        return <MaterialCommunityIcons name={cat.iconName as any} size={26} color="#FFFFFF" />;
    };

    return (
        <View style={styles.container}>
            {/* Banner Superior Verde */}
            <View style={styles.topBanner}>
                <Text style={styles.bannerTitle}>DEFINIR LEMBRETE</Text>
            </View>

            {/* Seletor Dinâmico de Categorias (Data-Driven) */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>PARA O QUE É O SEU LEMBRETE?</Text>
                <View style={styles.categoriesRow}>
                    {categories.map((cat) => {
                        const isSelected = cat.key === selectedCategory.key;
                        return (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.categoryCard,
                                    isSelected && styles.categoryCardSelected,
                                ]}
                                activeOpacity={0.8}
                                onPress={() => handleCategoryChange(cat)}
                                accessibilityRole="button"
                                accessibilityLabel={`Categoria ${cat.label}`}
                                accessibilityState={{ selected: isSelected }}
                            >
                                {renderCategoryIcon(cat)}
                                <Text style={styles.categoryText}>{cat.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Injeção Dinâmica dos Campos com base na Categoria Selecionada */}
            <View style={styles.dynamicFieldsContainer}>
                {selectedCategory.fields.map((field) => (
                    <DynamicFieldRenderer
                        key={field.name}
                        field={field}
                        value={formValues[field.name]}
                        error={errors[field.name]}
                        onChange={(value) => handleFieldChange(field.name, value)}
                    />
                ))}
            </View>

            {/* Botão de Submissão com Validação Contextual */}
            <TouchableOpacity
                style={styles.saveButton}
                activeOpacity={0.8}
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel="Salvar Lembrete"
            >
                <Text style={styles.saveButtonText}>SALVAR LEMBRETE</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    topBanner: {
        width: '100%',
        backgroundColor: themes.colors.secureGreen,
        borderRadius: 50,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    fieldSection: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    categoriesRow: {
        flexDirection: 'row',
        gap: 12,
    },
    categoryCard: {
        flex: 1,
        backgroundColor: themes.colors.secureGreen,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: 0.75,
    },
    categoryCardSelected: {
        opacity: 1,
        borderWidth: 2,
        borderColor: '#004D25',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    categoryText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: 'bold',
    },
    dynamicFieldsContainer: {
        width: '100%',
        marginVertical: 4,
    },
    saveButton: {
        backgroundColor: themes.colors.primary,
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});