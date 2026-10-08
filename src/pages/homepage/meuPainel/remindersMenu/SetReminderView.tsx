import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Firebase Auth e Firestore
import { auth, db } from '../../../../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Modal Padronizado Reutilizável
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Serviço de Logs Diários
import { DailyLogService, DailyLogType } from '../../../../services/DailyLogService';

// Subforms
import { RemedioForm } from './remindersSubforms/RemedioForm';
import { ConsultaForm } from './remindersSubforms/ConsultaForm';
import { ExameForm } from './remindersSubforms/ExameForm';
import { OutrosForm } from './remindersSubforms/OutrosForm';

// Tipos
import type { ReminderCategoryType } from './reminderTypes';
export type { ReminderCategoryType, SubformProps } from './reminderTypes';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const SUCCESS_COLOR = themes.colors.secureGreen || '#198754';
const ERROR_COLOR = '#DC3545';
const TEXT_COLOR = themes.colors.notBlack || '#1A1A1A';

const DEFAULT_THEME = {
    background: '#FFFFFF',
    cardBackground: '#FFFFFF',
    border: '#CBD5E1',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    buttonPrimary: '#198754',
    buttonText: '#FFFFFF',
};

const CATEGORIES: { key: ReminderCategoryType; label: string; icon: IconName }[] = [
    { key: 'remedio', label: 'Remédio', icon: 'pill' },
    { key: 'consulta', label: 'Consulta', icon: 'doctor' },
    { key: 'exame', label: 'Exame', icon: 'file-document-outline' },
    { key: 'outros', label: 'Outros', icon: 'bell-outline' },
];

interface ModalState {
    visible: boolean;
    title: string;
    subtitle: string;
    details?: string;
    isError: boolean;
}

export function SetReminderView() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const editingReminder = route.params?.editingReminder || null;

    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId: string =
        route.params?.targetUserId ||
        route.params?.activeUserId ||
        route.params?.userId ||
        editingReminder?.userId ||
        currentUserUid;

    const [targetUserName, setTargetUserName] = useState('');
    const [isResponsavel, setIsResponsavel] = useState(false);

    const accessibility = useAccessibility();
    const fontScale = accessibility?.fontScale ?? 1;
    const isHighContrast = accessibility?.isHighContrast ?? false;
    const theme = accessibility?.theme ?? DEFAULT_THEME;

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                if (!currentUserUid) return;

                if (isMounted) setTargetUserName('');

                try {
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents =
                            Array.isArray(currentUserData.dependentes) &&
                            currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    if (!selectedUserId) return;

                    if (selectedUserId === currentUserUid) {
                        if (isMounted) setTargetUserName('Meu Perfil (Responsável)');
                        return;
                    }

                    const dependentDoc = await getDoc(
                        doc(db, 'users', currentUserUid, 'dependentes', selectedUserId)
                    );
                    if (dependentDoc.exists()) {
                        const data = dependentDoc.data();
                        if (isMounted) setTargetUserName(data.apelido || data.nome || 'Dependente');
                        return;
                    }

                    const targetUserDoc = await getDoc(doc(db, 'users', selectedUserId));
                    if (targetUserDoc.exists() && isMounted) {
                        const data = targetUserDoc.data();
                        setTargetUserName(data.apelido || data.nome || 'Dependente');
                    }
                } catch (error) {
                    console.error('Erro ao buscar perfil selecionado no SetReminderView:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [selectedUserId, currentUserUid])
    );

    const [selectedCategory, setSelectedCategory] = useState<ReminderCategoryType>(
        editingReminder?.categoryKey || 'remedio'
    );

    const [modalState, setModalState] = useState<ModalState>({
        visible: false,
        title: '',
        subtitle: '',
        details: '',
        isError: false,
    });

    // Função centralizada para mapear a categoria para o tipo de dailyLog
    const mapCategoryToLogType = (category: ReminderCategoryType): DailyLogType => {
        switch (category) {
            case 'remedio':
                return 'remedio';
            default:
                return 'recado';
        }
    };

    // REFATORADO: Adicionado suporte ao parâmetro reminderId (refId)
    const handleSaveSuccess = useCallback(async (title: string, details?: string, reminderId?: string) => {
        try {
            // Registra automaticamente a ação no feed diário do dependente/usuário com o refId correto
            if (selectedUserId) {
                await DailyLogService.addLog({
                    dependentUid: selectedUserId,
                    tipo: mapCategoryToLogType(selectedCategory),
                    titulo: title,
                    descricao: details || '',
                    status: selectedCategory === 'remedio' ? 'pendente' : 'concluido',
                    refId: reminderId, // <-- Agora o refId do lembrete salvo é vinculado diretamente ao log
                });
            }
        } catch (error) {
            console.error('Erro ao gerar entrada no dailyLogs:', error);
        }

        setModalState({
            visible: true,
            title,
            subtitle: 'Salvo com sucesso!',
            details,
            isError: false,
        });
    }, [selectedUserId, selectedCategory]);

    const handleSaveError = useCallback((title: string, errorMessage?: string) => {
        setModalState({
            visible: true,
            title,
            subtitle: 'Atenção',
            details: errorMessage,
            isError: true,
        });
    }, []);

    const handleCloseModal = useCallback(() => {
        const wasSuccess = !modalState.isError;
        setModalState((prev) => ({ ...prev, visible: false }));

        if (wasSuccess) {
            navigation.goBack();
        }
    }, [modalState.isError, navigation]);

    const modalColor = modalState.isError
        ? isHighContrast ? theme.buttonPrimary : ERROR_COLOR
        : isHighContrast ? theme.buttonPrimary : SUCCESS_COLOR;

    return (
        <View style={[styles.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView
                style={[styles.container, isHighContrast && { backgroundColor: theme.background }]}
                edges={['top', 'left', 'right']}
            >
                {/* CABEÇALHO */}
                <View
                    style={[
                        styles.header,
                        isHighContrast && {
                            backgroundColor: theme.cardBackground,
                            borderBottomColor: theme.border,
                            borderBottomWidth: 1,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.headerBackButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                    >
                        <Feather
                            name="arrow-left"
                            size={28}
                            color={isHighContrast ? theme.textPrimary : TEXT_COLOR}
                        />
                    </TouchableOpacity>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.headerTitle,
                            { fontSize: 20 * fontScale },
                            isHighContrast && { color: theme.textPrimary },
                        ]}
                    >
                        {editingReminder ? 'EDITAR LEMBRETE' : 'NOVO LEMBRETE'}
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>

                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* BADGE DE PERFIL */}
                        {isResponsavel && targetUserName ? (
                            <View
                                style={[
                                    styles.profileBadge,
                                    isHighContrast && {
                                        backgroundColor: theme.cardBackground,
                                        borderColor: theme.border,
                                        borderWidth: 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="account"
                                    size={20}
                                    color={isHighContrast ? theme.textPrimary : themes.colors.primary}
                                />
                                <Text
                                    style={[
                                        styles.profileBadgeText,
                                        { fontSize: 14 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                    ]}
                                >
                                    Registrando para:{' '}
                                    <Text style={styles.profileBadgeName}>{targetUserName}</Text>
                                </Text>
                            </View>
                        ) : null}

                        {/* SELETOR DE CATEGORIA */}
                        <View style={styles.fieldSection}>
                            <Text
                                style={[
                                    styles.fieldLabel,
                                    { fontSize: 18 * fontScale },
                                    isHighContrast && { color: theme.textPrimary },
                                ]}
                            >
                                PARA O QUE É O SEU LEMBRETE?
                            </Text>
                            <View style={styles.categoriesRow}>
                                {CATEGORIES.map((cat) => {
                                    const isSelected = cat.key === selectedCategory;
                                    const isLocked = !!editingReminder;

                                    return (
                                        <TouchableOpacity
                                            key={cat.key}
                                            style={[
                                                styles.categoryCard,
                                                isSelected && styles.categoryCardSelected,
                                                isHighContrast && {
                                                    backgroundColor: theme.cardBackground,
                                                    borderWidth: 2,
                                                    borderColor: isSelected
                                                        ? theme.buttonPrimary
                                                        : theme.border,
                                                },
                                                isSelected &&
                                                    isHighContrast && {
                                                        backgroundColor: theme.buttonPrimary,
                                                    },
                                            ]}
                                            activeOpacity={0.8}
                                            disabled={isLocked}
                                            onPress={() => setSelectedCategory(cat.key)}
                                            accessibilityRole="button"
                                            accessibilityLabel={cat.label}
                                            accessibilityState={{
                                                selected: isSelected,
                                                disabled: isLocked,
                                            }}
                                        >
                                            <MaterialCommunityIcons
                                                name={cat.icon}
                                                size={26}
                                                color={
                                                    isHighContrast
                                                        ? isSelected
                                                            ? theme.buttonText
                                                            : theme.textPrimary
                                                        : '#FFFFFF'
                                                }
                                            />
                                            <Text
                                                style={[
                                                    styles.categoryText,
                                                    { fontSize: 15 * fontScale },
                                                    isHighContrast && {
                                                        color: isSelected
                                                            ? theme.buttonText
                                                            : theme.textPrimary,
                                                    },
                                                ]}
                                            >
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* SUBFORMS */}
                        <View style={styles.subformContainer}>
                            {selectedCategory === 'remedio' && (
                                <RemedioForm
                                    editingReminder={editingReminder}
                                    activeUserId={selectedUserId}
                                    onSaveSuccess={(details?: string, reminderId?: string) =>
                                        handleSaveSuccess('Lembrete de Remédio', details, reminderId)
                                    }
                                    onSaveError={(err?: string) =>
                                        handleSaveError('Erro ao Salvar Remédio', err)
                                    }
                                />
                            )}
                            {selectedCategory === 'consulta' && (
                                <ConsultaForm
                                    editingReminder={editingReminder}
                                    activeUserId={selectedUserId}
                                    onSaveSuccess={(details?: string, reminderId?: string) =>
                                        handleSaveSuccess('Lembrete de Consulta', details, reminderId)
                                    }
                                    onSaveError={(err?: string) =>
                                        handleSaveError('Erro ao Salvar Consulta', err)
                                    }
                                />
                            )}
                            {selectedCategory === 'exame' && (
                                <ExameForm
                                    editingReminder={editingReminder}
                                    activeUserId={selectedUserId}
                                    onSaveSuccess={(details?: string, reminderId?: string) =>
                                        handleSaveSuccess('Lembrete de Exame', details, reminderId)
                                    }
                                    onSaveError={(err?: string) =>
                                        handleSaveError('Erro ao Salvar Exame', err)
                                    }
                                />
                            )}
                            {selectedCategory === 'outros' && (
                                <OutrosForm
                                    editingReminder={editingReminder}
                                    activeUserId={selectedUserId}
                                    onSaveSuccess={(details?: string, reminderId?: string) =>
                                        handleSaveSuccess('Lembrete Agendado', details, reminderId)
                                    }
                                    onSaveError={(err?: string) =>
                                        handleSaveError('Erro ao Salvar Lembrete', err)
                                    }
                                />
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            <SafeAreaView
                edges={['bottom']}
                style={isHighContrast && { backgroundColor: theme.background }}
            />

            <CustomNotificationModal
                visible={modalState.visible}
                title={modalState.title}
                subtitle={modalState.subtitle}
                iconName={modalState.isError ? 'alert-circle-outline' : 'check-circle-outline'}
                iconColor={modalColor}
                closeText={modalState.isError ? 'ENTENDIDO' : 'CONCLUIR'}
                closeButtonColor={modalColor}
                onClose={handleCloseModal}
            >
                {modalState.details ? (
                    <View
                        style={[
                            styles.modalDetailsContainer,
                            isHighContrast && {
                                backgroundColor: theme.cardBackground,
                                borderColor: theme.border,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.modalDetailsText,
                                { fontSize: 15 * fontScale },
                                isHighContrast && { color: theme.textPrimary },
                            ]}
                        >
                            {modalState.details}
                        </Text>
                    </View>
                ) : null}
            </CustomNotificationModal>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    mainWrapper: { flex: 1, backgroundColor: '#FFFFFF' },
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    headerBackButton: { padding: 4 },
    headerSpacer: { width: 36 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF3FF',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 16,
        gap: 6,
    },
    profileBadgeText: { color: '#333333', fontWeight: '500', flexShrink: 1 },
    profileBadgeName: { fontWeight: '900' },
    fieldSection: { marginBottom: 20 },
    fieldLabel: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR, marginBottom: 10 },
    categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryCard: {
        flexBasis: '47%',
        flexGrow: 1,
        minHeight: 72,
        backgroundColor: SUCCESS_COLOR,
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: 0.45,
    },
    categoryCardSelected: { opacity: 1, elevation: 3 },
    categoryText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
    subformContainer: { width: '100%' },
    modalDetailsContainer: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 14,
        marginTop: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalDetailsText: { fontSize: 15, color: '#333333', lineHeight: 22, textAlign: 'center' },
});