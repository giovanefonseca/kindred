import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { NotificationService } from '../../../services/NotificationService';
import { themes } from '../../../global/themes';
import {
    getReminderCategories,
    ReminderCategoryConfig,
    createInitialCategoryState,
    validateCategoryPayload,
} from '../../../config/reminderFormConfig';
import { DynamicFieldRenderer } from '../../../components/DynamicForm/DynamicFieldRenderer';

// Firebase
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../../config/firebaseConfig';

interface SetReminderViewProps {
    onSaveSuccess?: () => void;
}


// ---------------------------------------------------------------------------
// INFRAESTRUTURA / REPOSITÓRIO (Clean Architecture: Isola o banco de dados)
// ---------------------------------------------------------------------------

/**
 * Remove propriedades com valor 'undefined' recursivamente.
 * O Firestore não suporta 'undefined' e gera um erro silencioso se tentar salvar.
 */
function sanitizeForFirestore(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([_, v]) => v !== undefined) // O segredo está aqui: o Firestore aceita null, mas odeia undefined
            .map(([k, v]) => [k, sanitizeForFirestore(v)]) 
    );
}

async function saveReminderToFirestore(userId: string, reminderData: Record<string, any>): Promise<void> {
    const cleanData = sanitizeForFirestore(reminderData);
    const remindersRef = collection(db, 'users', userId, 'reminders');
    await addDoc(remindersRef, cleanData);
}

// ---------------------------------------------------------------------------
// HELPER / DOMÍNIO (Clean Architecture: Isola regras de negócio temporal)
// ---------------------------------------------------------------------------
function extractTriggerDate(payload: Record<string, any>): Date | null {
    // 1. Captura os valores independentemente dos nomes dinâmicos gerados pelo form
    const baseDateStr = payload.datetime || payload.date;
    const timeStr = payload.time || payload.horario;

    // Se nenhum campo de data/hora existir, aborta
    if (!baseDateStr && !timeStr) return null;

    // 2. Inicializa a data com o valor base (ou a data atual se só tivermos a hora)
    const finalDate = baseDateStr ? new Date(baseDateStr) : new Date();

    if (isNaN(finalDate.getTime())) return null;

    // 3. Se houver um campo de hora explícito, sobrepõe as horas locais da data
    if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            finalDate.setHours(hours, minutes, 0, 0);
        }
    }

    // 4. Se o usuário forneceu APENAS a hora e ela já passou hoje, agenda para o mesmo horário amanhã
    if (!baseDateStr && timeStr && finalDate.getTime() < Date.now()) {
        finalDate.setDate(finalDate.getDate() + 1);
    }

    return finalDate;
}

// ---------------------------------------------------------------------------
// APRESENTAÇÃO / COMPONENTE
// ---------------------------------------------------------------------------
export function SetReminderView({ onSaveSuccess }: SetReminderViewProps) {
    const categories = getReminderCategories();

    const [selectedCategory, setSelectedCategory] = useState<ReminderCategoryConfig>(categories[0]);
    const [formValues, setFormValues] = useState<Record<string, any>>(() =>
        createInitialCategoryState(categories[0])
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const handleCategoryChange = (category: ReminderCategoryConfig) => {
        if (category.key === selectedCategory.key) return;
        setSelectedCategory(category);
        setFormValues(createInitialCategoryState(category));
        setErrors({});
    };

    const handleFieldChange = (fieldName: string, value: any) => {
        setFormValues((prev) => ({ ...prev, [fieldName]: value }));

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
            Alert.alert(
                'Atenção',
                'Por favor, preencha corretamente os campos destacados em vermelho antes de salvar.'
            );
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            Alert.alert('Erro', 'Utilizador não autenticado.');
            return;
        }

        const payloadValues = Object.values(cleanPayload as Record<string, any>);
        const firstPayloadValue = payloadValues.find((val) => val !== '' && val != null);
        const subtitleStr = firstPayloadValue
            ? String(firstPayloadValue).toUpperCase()
            : 'NOVO LEMBRETE CONFIGURADO';

        setIsSaving(true);

        try {
            const payloadRecord = cleanPayload as Record<string, any>;
            
            // UTILIZAÇÃO DA FUNÇÃO AQUI
            const triggerDate = extractTriggerDate(payloadRecord);

            // 1. DISPARO DO AGENDAMENTO LOCAL (POPUP)
            if (triggerDate) {
                if (triggerDate.getTime() > Date.now()) {
                    await NotificationService.scheduleReminder(
                        `Lembrete: ${selectedCategory.label}`,
                        subtitleStr,
                        triggerDate
                    );
                } else {
                    console.warn('[SetReminderView] Data no passado. Agendamento ignorado.', triggerDate);
                }
            }

            // 2. SALVAR NO REPOSITÓRIO (FIREBASE)
            const reminderData = {
                title: `LEMBRETE: ${selectedCategory.label.toUpperCase()}`,
                subtitle: subtitleStr,
                categoryKey: selectedCategory.key,
                iconFamily: selectedCategory.iconFamily || 'MaterialCommunityIcons',
                iconName: selectedCategory.iconName || 'bell-outline',
                dadosFormulario: cleanPayload,
                dataAgendamento: triggerDate ? triggerDate.toISOString() : null,
                criadoEm: new Date().toISOString(),
                isRead: false,
            };

            await saveReminderToFirestore(userId, reminderData);

            // 3. MENSAGEM DE SUCESSO
            const details = Object.entries(payloadRecord)
                .map(([k, v]) => `• ${k}: ${typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v}`)
                .join('\n');

            Alert.alert(
                `Lembrete Salvo (${selectedCategory.label})`,
                `Dados registrados com sucesso:\n\n${details}`,
                [{ text: 'Concluir', onPress: onSaveSuccess }]
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            console.error("[SetReminderView] Erro ao salvar lembrete:", errorMessage);
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
                                key={cat.key}
                                style={[
                                    styles.categoryCard,
                                    isSelected ? styles.categoryCardSelected : undefined,
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
                        onChange={(value: any) => handleFieldChange(field.name, value)}
                    />
                ))}
            </View>

            <TouchableOpacity
                style={[styles.saveButton, isSaving ? { opacity: 0.7 } : undefined]}
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
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    categoriesRow: { flexDirection: 'row', gap: 12 },
    categoryCard: {
        flex: 1,
        backgroundColor: themes.colors.secureGreen,
        borderRadius: 25,
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
    categoryText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
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
    saveButtonText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', letterSpacing: 0.5 },
});