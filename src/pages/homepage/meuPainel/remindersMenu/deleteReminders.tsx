import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

// Firebase
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';
import { themes } from '../../../../global/themes';

// Serviço de Notificações
import { NotificationService } from '../../../../services/NotificationService';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

interface Reminder {
    id: string;
    title: string;
    subtitle: string;
    iconFamily?: string;
    iconName?: string;
    dataAgendamento?: string | null;
    dadosFormulario?: Record<string, any>;
    criadoEm?: string;
    notificationId?: string | null;
}

interface CustomDeleteModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    onClose: () => void;
    onDelete: () => void;
}

const formatSimpleDate = (isoString?: string | null) => {
    if (!isoString) return 'Data não definida';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} às ${hours}:${minutes}`;
};

function CustomDeleteModal({ visible, title, subtitle, onClose, onDelete }: CustomDeleteModalProps) {
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

    const isBigFont = fontScale > 1.2;

    const handleCloseModal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    const handleDeleteModal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDelete();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCloseModal}>
            <View style={modalStyles.overlay}>
                <View style={[
                    modalStyles.modalCard,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                ]}>
                    <View style={[
                        modalStyles.iconCircle,
                        isHighContrast && { backgroundColor: theme.border }
                    ]}>
                        <Feather name="alert-triangle" size={40} color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                    </View>

                    <Text style={[
                        modalStyles.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>{title}</Text>
                    
                    <Text style={[
                        modalStyles.subtitle,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>{subtitle}</Text>

                    <View style={[modalStyles.buttonRow, isBigFont && { flexDirection: 'column' }]}>
                        <TouchableOpacity 
                            style={[
                                modalStyles.cancelButton,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                            ]} 
                            onPress={handleCloseModal} 
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                modalStyles.cancelText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>CANCELAR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[
                                modalStyles.deleteButtonModal,
                                isHighContrast && { backgroundColor: '#000000', borderWidth: 2, borderColor: theme.border }
                            ]} 
                            onPress={handleDeleteModal} 
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                modalStyles.deleteTextModal,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.buttonPrimary }
                            ]}>SIM, EXCLUIR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export function DeleteReminders() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    const currentUserUid = auth.currentUser?.uid || '';
    const activeUserId = route.params?.targetUserId || route.params?.activeUserId || route.params?.userId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);
    const [isDependentTarget, setIsDependentTarget] = useState<boolean>(false);

    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [reminderToDelete, setReminderToDelete] = useState<{ id: string; title: string } | null>(null);

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

    // Função utilitária para resolver o caminho correto dos lembretes no Firestore
    const getRemindersCollectionPath = useCallback(() => {
        if (isDependentTarget && currentUserUid !== activeUserId) {
            return ['users', currentUserUid, 'dependentes', activeUserId, 'reminders'];
        }
        return ['users', activeUserId, 'reminders'];
    }, [currentUserUid, activeUserId, isDependentTarget]);

    // Identificação do perfil selecionado
    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                if (!currentUserUid) return;

                try {
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents = Array.isArray(currentUserData.dependentes) && currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    if (activeUserId) {
                        if (activeUserId === currentUserUid) {
                            if (isMounted) {
                                setTargetUserName('Meu Perfil (Responsável)');
                                setIsDependentTarget(false);
                            }
                        } else {
                            const dependentDoc = await getDoc(doc(db, 'users', currentUserUid, 'dependentes', activeUserId));
                            if (dependentDoc.exists() && isMounted) {
                                const data = dependentDoc.data();
                                setTargetUserName(data.apelido || data.nome || 'Dependente');
                                setIsDependentTarget(true);
                            } else {
                                const targetUserDoc = await getDoc(doc(db, 'users', activeUserId));
                                if (targetUserDoc.exists() && isMounted) {
                                    const data = targetUserDoc.data();
                                    setTargetUserName(data.apelido || data.nome || 'Dependente');
                                    setIsDependentTarget(false);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao verificar perfil selecionado no DeleteReminders:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [activeUserId, currentUserUid])
    );

    // Listagem usando o caminho resolvido dinamicamente
    useFocusEffect(
        useCallback(() => {
            if (!activeUserId) {
                setLoading(false);
                return;
            }

            let unsubscribe: (() => void) | null = null;

            const setupListener = async () => {
                try {
                    const pathSegments = getRemindersCollectionPath();
                    const remindersRef = collection(db, pathSegments[0], ...pathSegments.slice(1));
                    const q = query(remindersRef, orderBy('criadoEm', 'desc'));

                    unsubscribe = onSnapshot(q, (snapshot) => {
                        const fetchedReminders = snapshot.docs.map(docSnap => ({
                            id: docSnap.id,
                            ...docSnap.data()
                        })) as Reminder[];

                        setReminders(fetchedReminders);
                        setLoading(false);
                    }, (error) => {
                        console.error('Erro ao buscar lembretes:', error);
                        Alert.alert('Erro', 'Não foi possível carregar os lembretes.');
                        setLoading(false);
                    });
                } catch (e) {
                    console.error('Erro ao configurar listener de exclusão:', e);
                    setLoading(false);
                }
            };

            setupListener();

            return () => {
                if (unsubscribe) unsubscribe();
            };
        }, [activeUserId, getRemindersCollectionPath])
    );

    const confirmDelete = (reminderId: string, reminderTitle: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setReminderToDelete({ id: reminderId, title: reminderTitle });
        setModalVisible(true);
    };

    // Exclusão no caminho resolvido dinamicamente
    const handleDeleteExecute = async () => {
        if (!reminderToDelete || !activeUserId) return;

        const idToDelete = reminderToDelete.id;

        // 1. Atualização Otimista
        setReminders((prev) => prev.filter((item) => item.id !== idToDelete));
        setModalVisible(false);
        setReminderToDelete(null);

        try {
            const pathSegments = getRemindersCollectionPath();
            const reminderRef = doc(db, pathSegments[0], ...pathSegments.slice(1), idToDelete);

            // 2. Cancela notificação local
            const reminderSnap = await getDoc(reminderRef);
            if (reminderSnap.exists()) {
                const data = reminderSnap.data();
                if (data.notificationId) {
                    await NotificationService.cancelReminder(data.notificationId);
                }
            }

            // 3. Deleta do Firestore
            await deleteDoc(reminderRef);
        } catch (error) {
            console.error("Erro ao excluir lembrete:", error);
            Alert.alert('Erro', 'Não foi possível excluir o lembrete.');
        }
    };

    const formatDateBr = (isoString?: string | null) => {
        if (!isoString) return 'Data não definida';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(' de ', ' ');
    };

    return (
        <View style={[style.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView 
                style={[
                    style.container,
                    isHighContrast && { backgroundColor: theme.background }
                ]} 
                edges={['top', 'left', 'right']}
            >
                {/* CABEÇALHO */}
                <View style={[
                    style.header,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderBottomColor: theme.border, borderBottomWidth: 1 }
                ]}>
                    <TouchableOpacity 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.goBack();
                        }} 
                        style={style.backButton}
                    >
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        style.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>EXCLUIR LEMBRETES</Text>
                </View>

                {/* AVISO VISUAL */}
                <View style={[
                    style.warningBanner,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                ]}>
                    <MaterialCommunityIcons 
                        name="alert-circle-outline" 
                        size={24} 
                        color={isHighContrast ? theme.buttonPrimary : "#856404"} 
                    />
                    <Text style={[
                        style.warningText,
                        { fontSize: 14 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>Atenção: Os itens apagados não poderão ser recuperados.</Text>
                </View>

                {/* LISTA DE LEMBRETES */}
                <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                    {isResponsavel && targetUserName ? (
                        <View
                            style={[
                                style.profileBadge,
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
                                    style.profileBadgeText,
                                    { fontSize: 14 * fontScale },
                                    isHighContrast && { color: theme.textPrimary },
                                ]}
                            >
                                Perfil selecionado:{' '}
                                <Text style={style.profileBadgeName}>{targetUserName}</Text>
                            </Text>
                        </View>
                    ) : null}

                    {loading ? (
                        <ActivityIndicator size="large" color={isHighContrast ? theme.buttonPrimary : "#d9534f"} style={{ marginTop: 50 }} />
                    ) : reminders.length === 0 ? (
                        <View style={style.emptyState}>
                            <MaterialCommunityIcons name="bell-off-outline" size={60} color={isHighContrast ? theme.textSecondary : "#CCC"} />
                            <Text style={[
                                style.emptyStateText,
                                { fontSize: 18 * fontScale },
                                isHighContrast && { color: theme.textSecondary }
                            ]}>Sua lista está vazia. Não há lembretes para excluir.</Text>
                        </View>
                    ) : (
                        reminders.map((reminder) => {
                            const payload = reminder.dadosFormulario || {};
                            const labelsMap: Record<string, string> = {
                                nomeRemedio: 'Medicamento',
                                tipoExame: 'Exame',
                                especialidadeMedico: 'Especialidade',
                                medico: 'Médico',
                                time: 'Horário',
                                horario: 'Horário',
                                horas: 'Horário',
                                date: 'Data',
                                datetime: 'Data e Hora',
                                data: 'Data',
                                dataConsulta: 'Data marcada',
                                exigeJejum: 'Exige Jejum',
                                jejum: 'Exige Jejum',
                                repetirDiario: 'Repetir diariamente',
                                repetirTodoDia: 'Repetir diariamente',
                                repetirDiariamente: 'Repetir diariamente',
                                levarExames: 'Levar exames anteriores',
                                levarExamesAnteriores: 'Levar exames anteriores',
                                tipoConsulta: 'Profissional',
                            };

                            return (
                                <View 
                                    key={reminder.id} 
                                    style={[
                                        style.noteCard,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                                    ]}
                                >
                                    <View style={style.noteInfo}>
                                        <Text style={[
                                            style.noteTypeTitle,
                                            { fontSize: 18 * fontScale },
                                            isHighContrast && { color: theme.textPrimary }
                                        ]}>{reminder.title || 'LEMBRETE'}</Text>

                                        <Text style={[
                                            style.noteDate,
                                            { fontSize: 14 * fontScale },
                                            isHighContrast && { color: theme.textSecondary }
                                        ]}>{formatDateBr(reminder.dataAgendamento)}</Text>

                                        <View style={style.noteDataArea}>
                                            {Object.entries(payload).map(([key, value]) => {
                                                if (value === undefined || value === null || value === '') return null;
                                                const labelFormatado = labelsMap[key] || key.toUpperCase();

                                                const renderValue = () => {
                                                    if (typeof value === 'boolean') {
                                                        return value ? 'Sim' : 'Não';
                                                    }
                                                    if (Array.isArray(value)) {
                                                        return value.join(', ');
                                                    }
                                                    const strValue = String(value);
                                                    if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('T')) {
                                                        return formatSimpleDate(value);
                                                    }
                                                    return strValue;
                                                };

                                                return (
                                                    <Text key={key} style={[
                                                        style.dataSummary,
                                                        { fontSize: 15 * fontScale },
                                                        isHighContrast && { color: theme.textSecondary }
                                                    ]}>
                                                        • {labelFormatado}: <Text style={[
                                                            { fontWeight: 'bold' },
                                                            isHighContrast && { color: theme.textPrimary }
                                                        ]}>{renderValue()}</Text>
                                                    </Text>
                                                );
                                            })}
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            style.deleteButton,
                                            isHighContrast && { backgroundColor: '#000000', borderWidth: 2, borderColor: theme.border }
                                        ]}
                                        activeOpacity={0.7}
                                        onPress={() => confirmDelete(reminder.id, reminder.title || 'Lembrete')}
                                    >
                                        <MaterialCommunityIcons 
                                            name="trash-can-outline" 
                                            size={36} 
                                            color={isHighContrast ? theme.buttonPrimary : "#FFFFFF"} 
                                        />
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                <CustomDeleteModal
                    visible={modalVisible}
                    title="Excluir Lembrete"
                    subtitle={`Tem certeza que deseja apagar permanentemente este lembrete: "${reminderToDelete?.title || ''}"?`}
                    onClose={() => setModalVisible(false)}
                    onDelete={handleDeleteExecute}
                />
            </SafeAreaView>

            <SafeAreaView edges={['bottom']} style={isHighContrast && { backgroundColor: theme.background }} />
        </View>
    );
}

const style = StyleSheet.create({
    mainWrapper: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
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
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#d9534f',
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    warningBanner: {
        flexDirection: 'row',
        backgroundColor: '#fff3cd',
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#ffeeba',
    },
    warningText: {
        color: '#856404',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
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
        maxWidth: '100%',
    },
    profileBadgeText: {
        color: '#333333',
        fontWeight: '500',
        flexShrink: 1, 
    },
    profileBadgeName: {
        fontWeight: '900',
    },
    noteCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'gray',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        alignItems: 'center',
    },
    noteInfo: {
        flex: 1,
        paddingRight: 15,
    },
    noteTypeTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    noteDate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#777',
        marginBottom: 8,
    },
    noteDataArea: {
        marginTop: 4,
    },
    dataSummary: {
        fontSize: 15,
        color: '#555',
        marginBottom: 2,
    },
    deleteButton: {
        backgroundColor: '#d9534f',
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#d9534f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyStateText: {
        fontSize: 18,
        color: '#888',
        textAlign: 'center',
        marginTop: 15,
        fontWeight: 'bold',
        paddingHorizontal: 20,
    }
});

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24
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
        shadowRadius: 6
    },
    iconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#d9534f',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.notBlack,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#555',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: 'transparent',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#DDD',
    },
    cancelText: {
        color: '#555',
        fontSize: 16,
        fontWeight: 'bold'
    },
    deleteButtonModal: {
        flex: 1,
        backgroundColor: '#d9534f',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center'
    },
    deleteTextModal: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
});