import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
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

// Modal Padronizado Reutilizável com children
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Importação dos Subforms
import { RemedioForm } from './remindersSubforms/RemedioForm';
import { ConsultaForm } from './remindersSubforms/ConsultaForm';
import { ExameForm } from './remindersSubforms/ExameForm';
import { OutrosForm } from './remindersSubforms/OutrosForm';

export type ReminderCategoryType = 'remedio' | 'consulta' | 'exame' | 'outros';

// Interface compartilhada para todos os Subforms
export interface SubformProps {
    editingReminder?: any;
    activeUserId?: string;
    onSaveSuccess: (details?: string) => void;
    onSaveError: (errorMessage?: string) => void;
}

// ---------------------------------------------------------------------------
// PÁGINA PRINCIPAL / ORQUESTRADOR
// ---------------------------------------------------------------------------
export function SetReminderView() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const editingReminder = route.params?.editingReminder || null;

    // Resgata o ID do usuário/dependente ativo com múltiplos fallbacks de rota
    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId = 
        route.params?.targetUserId || 
        route.params?.activeUserId || 
        route.params?.userId || 
        editingReminder?.userId ||
        currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

    // Contexto de Acessibilidade
    const accessibility = useAccessibility();
    const fontScale = accessibility?.fontScale ?? 1;
    const isHighContrast = accessibility?.isHighContrast ?? false;
    const theme = accessibility?.theme ?? {
        background: '#FFFFFF',
        cardBackground: '#FFFFFF',
        border: '#CBD5E1',
        textPrimary: '#1A1A1A',
        textSecondary: '#666666',
        buttonPrimary: '#198754',
        buttonText: '#FFFFFF',
    };

    // Identificação do perfil selecionado
    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                if (!currentUserUid) return;

                try {
                    // 1. Verifica se o usuário logado é responsável (tem dependentes)
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents = Array.isArray(currentUserData.dependentes) && currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    // 2. Busca o nome do perfil selecionado
                    if (selectedUserId) {
                        if (selectedUserId === currentUserUid) {
                            if (isMounted) setTargetUserName('Meu Perfil (Responsável)');
                        } else {
                            const dependentDoc = await getDoc(doc(db, 'users', currentUserUid, 'dependentes', selectedUserId));
                            if (dependentDoc.exists() && isMounted) {
                                const data = dependentDoc.data();
                                setTargetUserName(data.apelido || data.nome || 'Dependente');
                            } else {
                                const targetUserDoc = await getDoc(doc(db, 'users', selectedUserId));
                                if (targetUserDoc.exists() && isMounted) {
                                    const data = targetUserDoc.data();
                                    setTargetUserName(data.apelido || data.nome || 'Dependente');
                                }
                            }
                        }
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

    // Categoria selecionada
    const [selectedCategory, setSelectedCategory] = useState<ReminderCategoryType>(
        editingReminder?.categoryKey || 'remedio'
    );

    // Estado do Modal de Notificação
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

    // Callbacks de disparo dos formulários
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
        <View style={[styles.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView 
                style={[
                    styles.container,
                    isHighContrast && { backgroundColor: theme.background }
                ]} 
                edges={['top', 'left', 'right']}
            >
                {/* CABEÇALHO */}
                <View style={[
                    styles.header,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderBottomColor: theme.border, borderBottomWidth: 1 }
                ]}>
                    <TouchableOpacity
                        style={styles.headerBackButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        styles.headerTitle,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>
                        {editingReminder ? 'EDITAR LEMBRETE' : 'NOVO LEMBRETE'}
                    </Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    {/* BADGE DE PERFIL SELECIONADO */}
                    {isResponsavel && targetUserName ? (
                        <View style={[
                            styles.profileBadge,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                        ]}>
                            <MaterialCommunityIcons 
                                name="account" 
                                size={20} 
                                color={isHighContrast ? theme.textPrimary : themes.colors.primary} 
                            />
                            <Text style={[
                                styles.profileBadgeText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>
                                Registrando para: <Text style={{ fontWeight: '900' }}>{targetUserName}</Text>
                            </Text>
                        </View>
                    ) : null}

                    {/* SELETOR DE CATEGORIA */}
                    <View style={styles.fieldSection}>
                        <Text style={[
                            styles.fieldLabel,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>PARA O QUE É O SEU LEMBRETE?</Text>
                        <View style={styles.categoriesRow}>
                            {categories.map((cat) => {
                                const isSelected = cat.key === selectedCategory;
                                return (
                                    <TouchableOpacity
                                        key={cat.key}
                                        style={[
                                            styles.categoryCard, 
                                            isSelected && styles.categoryCardSelected,
                                            isHighContrast && { 
                                                backgroundColor: theme.cardBackground, 
                                                borderWidth: 2, 
                                                borderColor: isSelected ? theme.buttonPrimary : theme.border 
                                            },
                                            isSelected && isHighContrast && { backgroundColor: theme.buttonPrimary }
                                        ]}
                                        activeOpacity={0.8}
                                        disabled={!!editingReminder}
                                        onPress={() => setSelectedCategory(cat.key as ReminderCategoryType)}
                                    >
                                        <MaterialCommunityIcons
                                            name={cat.icon as any}
                                            size={26}
                                            color={isHighContrast ? (isSelected ? theme.buttonText : theme.textPrimary) : "#FFFFFF"}
                                        />
                                        <Text style={[
                                            styles.categoryText,
                                            { fontSize: 15 * fontScale },
                                            isHighContrast && { color: isSelected ? theme.buttonText : theme.textPrimary }
                                        ]}>{cat.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* SUBFORM ATIVO */}
                    <View style={styles.subformContainer}>
                        {selectedCategory === 'remedio' && (
                            <RemedioForm
                                editingReminder={editingReminder}
                                activeUserId={selectedUserId}
                                onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete de Remédio', details)}
                                onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Remédio', err)}
                            />
                        )}
                        {selectedCategory === 'consulta' && (
                            <ConsultaForm
                                editingReminder={editingReminder}
                                activeUserId={selectedUserId}
                                onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete de Consulta', details)}
                                onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Consulta', err)}
                            />
                        )}
                        {selectedCategory === 'exame' && (
                            <ExameForm
                                editingReminder={editingReminder}
                                activeUserId={selectedUserId}
                                onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete de Exame', details)}
                                onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Exame', err)}
                            />
                        )}
                        {selectedCategory === 'outros' && (
                            <OutrosForm
                                editingReminder={editingReminder}
                                activeUserId={selectedUserId}
                                onSaveSuccess={(details?: string) => handleSaveSuccess('Lembrete Agendado', details)}
                                onSaveError={(err?: string) => handleSaveError('Erro ao Salvar Lembrete', err)}
                            />
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>

            <SafeAreaView edges={['bottom']} style={isHighContrast && { backgroundColor: theme.background }} />

            <CustomNotificationModal
                visible={modalState.visible}
                title={modalState.title}
                subtitle={modalState.subtitle}
                iconName={modalState.isError ? "alert-circle-outline" : "check-circle-outline"}
                iconColor={modalState.isError 
                    ? (isHighContrast ? theme.buttonPrimary : "#DC3545") 
                    : (isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || "#198754"))
                }
                closeText={modalState.isError ? "ENTENDIDO" : "CONCLUIR"}
                closeButtonColor={modalState.isError 
                    ? (isHighContrast ? theme.buttonPrimary : "#DC3545") 
                    : (isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || "#198754"))
                }
                onClose={handleCloseModal}
            >
                {modalState.details ? (
                    <View style={[
                        styles.modalDetailsContainer,
                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                    ]}>
                        <Text style={[
                            styles.modalDetailsText,
                            { fontSize: 15 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>
                            {modalState.details}
                        </Text>
                    </View>
                ) : null}
            </CustomNotificationModal>
        </View>
    );
}

const styles = StyleSheet.create({
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
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: themes.colors.notBlack },
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
    profileBadgeText: { color: '#333333', fontWeight: '500' },
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