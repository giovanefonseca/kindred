import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Modal,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { themes } from '../../../../global/themes';
import {
    getReminderCategories,
    getReminderCategoryByKey,
    ReminderCategoryConfig,
    createInitialCategoryState,
    validateCategoryPayload,
} from '../../../../config/reminderFormConfig';
import { DynamicFieldRenderer } from '../../../../components/DynamicForm/DynamicFieldRenderer';
import { scheduleLocalReminder } from '../../../../components/Notify';
import { auth } from '../../../../config/firebaseConfig';
import { createReminder, updateReminder } from '../../../../repositories/firestoreReminders';

// ---------------------------------------------------------------------------
// Tipo de um lembrete já existente, usado para popular o modo edição
// ---------------------------------------------------------------------------
export interface ExistingReminder {
    id: string;                       // ID do documento no Firestore
    categoryKey: string;
    dadosFormulario: Record<string, any>;
    notificationId?: string | null;   // ID da notificação agendada anteriormente
}

interface SetReminderViewProps {
    onSaveSuccess?: () => void;
    editingReminder?: ExistingReminder | null; // se vier preenchido, é edição
}

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO DE SUCESSO
// ---------------------------------------------------------------------------
interface SuccessModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    details: string;
    onClose: () => void;
}

function SuccessModal({ visible, title, subtitle, details, onClose }: SuccessModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={modalStyles.iconCircle}>
                        <MaterialCommunityIcons name="check" size={40} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={modalStyles.subtitle}>{subtitle}</Text>

                    {details ? (
                        <View style={modalStyles.detailsContainer}>
                            <Text style={modalStyles.detailsText}>{details}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity style={modalStyles.closeButton} onPress={onClose} activeOpacity={0.8}>
                        <Text style={modalStyles.closeText}>CONCLUIR</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// HELPER / DOMÍNIO
// ---------------------------------------------------------------------------
function extractTriggerDate(payload: Record<string, any>): Date | null {
    const baseDateVal = payload.date || payload.datetime || payload.data || payload.dataConsulta;
    const timeStr = payload.time || payload.horario || payload.horas;

    if (!baseDateVal && !timeStr) return null;

    let finalDate: Date;
    if (baseDateVal) {
        finalDate = new Date(baseDateVal);
        if (isNaN(finalDate.getTime())) finalDate = new Date();
    } else {
        finalDate = new Date();
    }

    if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            finalDate.setHours(hours, minutes, 0, 0);
        }
    }

    if (!baseDateVal && timeStr && finalDate.getTime() <= Date.now()) {
        finalDate.setDate(finalDate.getDate() + 1);
    }

    return finalDate;
}

// ---------------------------------------------------------------------------
// APRESENTAÇÃO / COMPONENTE
// ---------------------------------------------------------------------------
export function SetReminderView({ onSaveSuccess, editingReminder }: SetReminderViewProps) {
    const navigation = useNavigation<any>();
    const categories = getReminderCategories();
    const isEditMode = Boolean(editingReminder);

    const initialCategory = editingReminder
        ? getReminderCategoryByKey(editingReminder.categoryKey) || categories[0]
        : categories[0];

    const [selectedCategory, setSelectedCategory] = useState<ReminderCategoryConfig>(initialCategory);
    const [formValues, setFormValues] = useState<Record<string, any>>(() =>
        editingReminder
            ? { ...createInitialCategoryState(initialCategory), ...editingReminder.dadosFormulario }
            : createInitialCategoryState(initialCategory)
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [modalDetailsText, setModalDetailsText] = useState('');
    const [modalTitleText, setModalTitleText] = useState('');

    const handleCategoryChange = (category: ReminderCategoryConfig) => {
        if (isEditMode) return;
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
            Alert.alert('Atenção', 'Por favor, preencha corretamente os campos destacados em vermelho antes de salvar.');
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

        const triggerDate = extractTriggerDate(cleanPayload);

        setIsSaving(true);
        try {
            let newNotificationId: string | null = null;

            if (scheduleLocalReminder && triggerDate) {
                const isRepeatDaily = Boolean(formValues.repetirDiario ?? false);

                const result = await scheduleLocalReminder({
                    title: `Lembrete: ${selectedCategory.label}`,
                    subtitle: subtitleStr,
                    date: triggerDate,
                    repeatDaily: isRepeatDaily,
                });
                newNotificationId = result ?? null;
            }

            const reminderData = {
                title: `LEMBRETE: ${selectedCategory.label.toUpperCase()}`,
                subtitle: subtitleStr,
                categoryKey: selectedCategory.key,
                iconFamily: selectedCategory.iconFamily || 'MaterialCommunityIcons',
                iconName: selectedCategory.iconName || 'bell-outline',
                dadosFormulario: cleanPayload,
                dataAgendamento: triggerDate ? triggerDate.toISOString() : null,
                notificationId: newNotificationId,
                criadoEm: new Date().toISOString(),
                isRead: false,
            };

            if (isEditMode && editingReminder) {
                await updateReminder(
                    userId,
                    editingReminder.id,
                    editingReminder.notificationId,
                    reminderData
                );
            } else {
                await createReminder(userId, reminderData);
            }

            const details = Object.entries(cleanPayload as Record<string, any>)
                .map(([k, v]) => `• ${k}: ${typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v}`)
                .join('\n');

            setModalTitleText(
                isEditMode ? `Lembrete Atualizado (${selectedCategory.label})` : `Lembrete Salvo (${selectedCategory.label})`
            );
            setSuccessModalVisible(true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            console.error('[SetReminderView] Erro ao salvar lembrete:', errorMessage);
            Alert.alert('Erro', 'Não foi possível salvar o lembrete no banco de dados.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        setSuccessModalVisible(false);
        if (onSaveSuccess) {
            onSaveSuccess();
        } else {
            navigation.goBack();
        }
    };

    const renderCategoryIcon = (cat: ReminderCategoryConfig) => {
        if (cat.iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={cat.iconName as any} size={24} color="#FFFFFF" />;
        }
        return <MaterialCommunityIcons name={cat.iconName as any} size={26} color="#FFFFFF" />;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* CABEÇALHO COM BOTÃO VOLTAR E TÍTULO SEGURO */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isEditMode ? 'EDITAR LEMBRETE' : 'DEFINIR LEMBRETE'}
                </Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* BANNER ESTÁTICO CORRIGIDO (UI/UX) */}
                <View
                    style={[
                        styles.newReminderBanner,
                        isEditMode ? styles.newReminderBannerDisabled : undefined,
                    ]}
                >
                    <Text style={styles.newReminderBannerText}>
                        {isEditMode ? 'EDITANDO LEMBRETE' : 'NOVO LEMBRETE'}
                    </Text>
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
                        <Text style={styles.saveButtonText}>
                            {isEditMode ? 'ATUALIZAR LEMBRETE' : 'SALVAR LEMBRETE'}
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Modal de Sucesso Customizado */}
            <SuccessModal
                visible={successModalVisible}
                title={modalTitleText}
                subtitle="Salvo com sucesso!"
                details={modalDetailsText}
                onClose={handleCloseModal}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        position: 'relative',
        zIndex: 10,
    },
    backButton: {
        position: 'absolute',
        left: 20,
        padding: 4,
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.notBlack,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    /* BANNER ESTÁTICO CORRIGIDO */
    newReminderBanner: {
        width: '100%',
        backgroundColor: themes.colors.secureGreen || '#198754',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    newReminderBannerDisabled: {
        opacity: 0.5,
    },
    newReminderBannerText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
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
        backgroundColor: themes.colors.secureGreen || '#198754',
        borderRadius: 20,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: 0.50,
        borderWidth: 2,
        borderColor: 'transparent',
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

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DO MODAL DE SUCESSO
// ---------------------------------------------------------------------------
const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 2,
        borderColor: 'transparent',
        padding: 24,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    iconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: themes.colors.secureGreen || '#198754',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 16,
        color: themes.colors.secureGreen || '#198754',
        textAlign: 'center',
        marginBottom: 16,
    },
    detailsContainer: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    detailsText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 22,
    },
    closeButton: {
        width: '100%',
        backgroundColor: themes.colors.secureGreen || '#198754',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});