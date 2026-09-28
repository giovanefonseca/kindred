import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Importação dos Subforms
import { RemedioForm } from './remindersSubforms/RemedioForm';
import { ConsultaForm } from './remindersSubforms/ConsultaForm';
import { ExameForm } from './remindersSubforms/ExameForm';
import { OutrosForm } from './remindersSubforms/OutrosForm';

export type ReminderCategoryType = 'remedio' | 'consulta' | 'exame' | 'outros';

// Interface compartilhada para todos os Subforms
export interface SubformProps {
    editingReminder?: any;
    onSaveSuccess: (details?: string) => void;
    onSaveError: (errorMessage?: string) => void;
}

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL REUTILIZÁVEL (SUCESSO / ERRO)
// ---------------------------------------------------------------------------
interface StatusModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    details?: string;
    isError?: boolean;
    onClose: () => void;
}

function StatusModal({ visible, title, subtitle, details, isError = false, onClose }: StatusModalProps) {
    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={[modalStyles.iconCircle, isError && modalStyles.iconCircleError]}>
                        <MaterialCommunityIcons
                            name={isError ? 'close' : 'check'}
                            size={40}
                            color="#FFFFFF"
                        />
                    </View>

                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={[modalStyles.subtitle, isError && modalStyles.subtitleError]}>
                        {subtitle}
                    </Text>

                    {details ? (
                        <View style={modalStyles.detailsContainer}>
                            <Text style={modalStyles.detailsText}>{details}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[modalStyles.closeButton, isError && modalStyles.closeButtonError]}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text style={modalStyles.closeText}>{isError ? 'ENTENDIDO' : 'CONCLUIR'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// PÁGINA PRINCIPAL / ORQUESTRADOR
// ---------------------------------------------------------------------------
export function SetReminderView() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const editingReminder = route.params?.editingReminder || null;

    // Categoria selecionada
    const [selectedCategory, setSelectedCategory] = useState<ReminderCategoryType>(
        editingReminder?.categoryKey || 'remedio'
    );

    // Estado do Modal único
    const [modalState, setModalState] = useState<{
        visible: boolean;
        title: string;
        subtitle: string;
        details?: string;
        isError: boolean;
    }>({
        visible: false,
        title: '',
        subtitle: '',
        details: '',
        isError: false,
    });

    const categories = [
        { key: 'remedio', label: 'Remédio', icon: 'pill' },
        { key: 'consulta', label: 'Consulta', icon: 'doctor' },
        { key: 'exame', label: 'Exame', icon: 'file-document-outline' },
        { key: 'outros', label: 'Outros', icon: 'bell-outline' },
    ];

    // Callbacks de disparo
    const handleSaveSuccess = (title: string, details?: string) => {
        setModalState({
            visible: true,
            title,
            subtitle: 'Salvo com sucesso!',
            details,
            isError: false,
        });
    };

    const handleSaveError = (title: string, errorMessage?: string) => {
        setModalState({
            visible: true,
            title,
            subtitle: 'Atenção',
            details: errorMessage,
            isError: true,
        });
    };

    const handleCloseModal = () => {
        const wasSuccess = !modalState.isError;
        setModalState((prev) => ({ ...prev, visible: false }));

        if (wasSuccess) {
            navigation.goBack();
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* CABEÇALHO */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.headerBackButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {editingReminder ? 'EDITAR LEMBRETE' : 'NOVO LEMBRETE'}
                </Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* SELETOR DE CATEGORIA (BOTÕES SUPERIORES) */}
                <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>PARA O QUE É O SEU LEMBRETE?</Text>
                    <View style={styles.categoriesRow}>
                        {categories.map((cat) => {
                            const isSelected = cat.key === selectedCategory;
                            return (
                                <TouchableOpacity
                                    key={cat.key}
                                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                                    activeOpacity={0.8}
                                    disabled={!!editingReminder}
                                    onPress={() => setSelectedCategory(cat.key as ReminderCategoryType)}
                                >
                                    <MaterialCommunityIcons
                                        name={cat.icon as any}
                                        size={26}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.categoryText}>{cat.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* SUBFORM ATIVO COM PARÂMETROS TIPADOS */}
                <View style={styles.subformContainer}>
                    {selectedCategory === 'remedio' && (
                        <RemedioForm
                            editingReminder={editingReminder}
                            onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete de Remédio', details)}
                            onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Remédio', err)}
                        />
                    )}
                    {selectedCategory === 'consulta' && (
                        <ConsultaForm
                            editingReminder={editingReminder}
                            onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete de Consulta', details)}
                            onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Consulta', err)}
                        />
                    )}
                    {selectedCategory === 'exame' && (
                        <ExameForm
                            editingReminder={editingReminder}
                            onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete de Exame', details)}
                            onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Exame', err)}
                        />
                    )}
                    {selectedCategory === 'outros' && (
                        <OutrosForm
                            editingReminder={editingReminder}
                            onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete Agendado', details)}
                            onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Lembrete', err)}
                        />
                    )}
                </View>
            </ScrollView>

            {/* MODAL DE STATUS */}
            <StatusModal
                visible={modalState.visible}
                title={modalState.title}
                subtitle={modalState.subtitle}
                details={modalState.details}
                isError={modalState.isError}
                onClose={handleCloseModal}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    headerBackButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },

    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
    fieldSection: { marginBottom: 20 },
    fieldLabel: { fontSize: 18, fontWeight: 'bold', color: themes.colors.notBlack, marginBottom: 10 },
    categoriesRow: { flexDirection: 'row', gap: 10 },
    categoryCard: {
        flex: 1,
        backgroundColor: themes.colors.secureGreen || '#198754',
        borderRadius: 18,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: 0.45,
    },
    categoryCardSelected: { opacity: 1, elevation: 3 },
    categoryText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    subformContainer: { width: '100%' },
});

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
    iconCircleError: {
        backgroundColor: themes.colors.darkRed || '#DC3545',
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
        fontWeight: 'bold',
    },
    subtitleError: {
        color: themes.colors.darkRed || '#DC3545',
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
        fontSize: 15,
        color: '#333333',
        lineHeight: 22,
        textAlign: 'center',
    },
    closeButton: {
        width: '100%',
        backgroundColor: themes.colors.secureGreen || '#198754',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeButtonError: {
        backgroundColor: themes.colors.darkRed || '#DC3545',
    },
    closeText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});