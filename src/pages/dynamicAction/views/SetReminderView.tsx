import { NotificationService } from '../../../services/NotificationService';
import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator
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
import { useReminders } from '../../../contexts/ReminderContext';

// Novas importações do Firebase
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../../config/firebaseConfig';

interface SetReminderViewProps {
    onSaveSuccess?: () => void;
}

export function SetReminderView({ onSaveSuccess }: SetReminderViewProps) {
    const categories = getReminderCategories();
    const { addReminder } = useReminders(); 

    const [selectedCategory, setSelectedCategory] = useState<ReminderCategoryConfig>(categories[0]);
    const [formValues, setFormValues] = useState<Record<string, any>>(() =>
        createInitialCategoryState(categories[0])
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    // Novo estado para o botão de carregamento
    const [isSaving, setIsSaving] = useState(false);

    const handleCategoryChange = (category: ReminderCategoryConfig) => {
        if (category.key === selectedCategory.key) return;
        setSelectedCategory(category);
        setFormValues(createInitialCategoryState(category));
        setErrors({});
    };

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

    const handleSave = async () => { 
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

        // Verifica o utilizador logado
        const userId = auth.currentUser?.uid;
        if (!userId) {
            return Alert.alert('Erro', 'Utilizador não autenticado.');
        }

        const firstPayloadValue = Object.values(cleanPayload).find(val => val !== '' && val != null);
        const subtitleStr = firstPayloadValue 
            ? String(firstPayloadValue).toUpperCase() 
            : 'NOVO LEMBRETE CONFIGURADO';

        setIsSaving(true);

        try {
            const reminderDate = cleanPayload.datetime || cleanPayload.date || cleanPayload.time; 
            let triggerDate: Date | null = null;
            
            // 1. DISPARO DO AGENDAMENTO LOCAL
            if (reminderDate) {
                triggerDate = new Date(reminderDate);
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

            // 2. SALVAR NO FIREBASE (Subcoleção 'reminders')
            const reminderData = {
                title: `LEMBRETE: ${selectedCategory.label.toUpperCase()}`,
                subtitle: subtitleStr,
                categoryKey: selectedCategory.key,
                iconFamily: selectedCategory.iconFamily || 'MaterialCommunityIcons',
                iconName: selectedCategory.iconName || 'bell-outline',
                dadosFormulario: cleanPayload,
                dataAgendamento: triggerDate ? triggerDate.toISOString() : null,
                criadoEm: new Date().toISOString(),
                isRead: false
            };

            const remindersRef = collection(db, 'users', userId, 'reminders');
            await addDoc(remindersRef, reminderData);

            // 3. ATUALIZAR O CONTEXTO GLOBAL (Para aparecer instantaneamente no painel)
            addReminder({
                title: reminderData.title,
                subtitle: reminderData.subtitle,
                categoryKey: reminderData.categoryKey,
                iconFamily: reminderData.iconFamily,
                iconName: reminderData.iconName,
            });

            // 4. MENSAGEM DE SUCESSO
            const details = Object.entries(cleanPayload)
                .map(([k, v]) => `• ${k}: ${typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v}`)
                .join('\n');

            Alert.alert(
                `Lembrete Salvo (${selectedCategory.label})`,
                `Dados registrados com sucesso:\n\n${details}`,
                [{ text: 'Concluir', onPress: onSaveSuccess }]
            );

        } catch (error) {
            console.error("Erro ao salvar lembrete:", error);
            Alert.alert('Erro', 'Não foi possível salvar o lembrete no banco de dados.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderCategoryIcon = (cat: ReminderCategoryConfig) => {
        if (cat.iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={cat.iconName as any} size={24} color="#FFFFFF" />;
        }
        return <MaterialCommunityIcons name={cat.iconName as any} size={26} color="#FFFFFF" />;
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBanner}>
                <Text style={styles.bannerTitle}>DEFINIR LEMBRETE</Text>
            </View>

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

            <TouchableOpacity
                style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
                activeOpacity={0.8}
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Salvar Lembrete"
            >
                {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                    <Text style={styles.saveButtonText}>SALVAR LEMBRETE</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%' },
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
    fieldSection: { marginBottom: 16 },
    fieldLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    categoriesRow: { flexDirection: 'row', gap: 12 },
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
    categoryText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: 'bold' },
    dynamicFieldsContainer: { width: '100%', marginVertical: 4 },
    saveButton: {
        backgroundColor: themes.colors.primary,
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
});