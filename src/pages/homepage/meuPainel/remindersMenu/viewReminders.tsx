import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Firebase
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

// Serviço de Notificações
import { NotificationService } from '../../../../services/NotificationService';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

interface ReminderItem {
    id: string;
    title: string;
    subtitle: string;
    categoryKey?: string;
    iconFamily?: string;
    iconName?: string;
    dataAgendamento?: string | null;
    dadosFormulario?: Record<string, any>;
    criadoEm?: string;
    notificationId?: string | null;
}

interface ToggleInfo {
    label: string;
    value: boolean;
}

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL (Estilos integrados e encapsulados)
// ---------------------------------------------------------------------------
interface CustomNotificationModalProps {
    visible: boolean;
    reminder: ReminderItem | null;
    onClose: () => void;
    onDelete: () => void;
}

function CustomNotificationModal({ visible, reminder, onClose, onDelete }: CustomNotificationModalProps) {
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

    if (!reminder) return null;

    const renderIcon = () => {
        const color = isHighContrast ? theme.buttonText : (themes.colors.secondary || '#ffffff');
        const family = reminder.iconFamily || 'MaterialCommunityIcons';
        const name = reminder.iconName || 'bell-outline';

        if (family === 'FontAwesome5') {
            return <FontAwesome5 name={name as any} size={36} color={color} />;
        }
        return <MaterialCommunityIcons name={name as any} size={42} color={color} />;
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={[
                    modalStyles.modalCard,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                ]}>
                    <View style={[
                        modalStyles.iconCircle,
                        isHighContrast && { backgroundColor: theme.buttonPrimary }
                    ]}>
                        {renderIcon()}
                    </View>

                    <Text style={[
                        modalStyles.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>
                        {reminder.title}
                    </Text>
                    <Text style={[
                        modalStyles.subtitle,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>
                        {reminder.subtitle}
                    </Text>

                    <View style={modalStyles.buttonGroup}>
                        <TouchableOpacity 
                            style={[
                                modalStyles.deleteButton,
                                isHighContrast && { backgroundColor: '#000000', borderWidth: 2, borderColor: theme.buttonPrimary }
                            ]} 
                            onPress={onDelete} 
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                modalStyles.deleteText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.buttonPrimary }
                            ]}>
                                EXCLUIR
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[
                                modalStyles.closeButton,
                                isHighContrast && { backgroundColor: theme.buttonPrimary }
                            ]} 
                            onPress={onClose} 
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                modalStyles.closeText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.buttonText }
                            ]}>
                                FECHAR
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// PÁGINA PRINCIPAL
// ---------------------------------------------------------------------------
export function ViewReminders() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    // Resgata o ID do usuário/dependente ativo
    const currentUserUid = auth.currentUser?.uid || '';
    const activeUserId = route.params?.targetUserId || route.params?.activeUserId || route.params?.userId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

    const [reminders, setReminders] = useState<ReminderItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Estado para Filtragem (Todos, Remedio, Consulta, Exame, Outros)
    const [selectedFilter, setSelectedFilter] = useState<string>('todos');

    // Contexto Global de Acessibilidade
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

    // Identificação e busca do nome do perfil ativo
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
                            if (isMounted) setTargetUserName('Meu Perfil (Responsável)');
                        } else {
                            const dependentDoc = await getDoc(doc(db, 'users', currentUserUid, 'dependentes', activeUserId));
                            if (dependentDoc.exists() && isMounted) {
                                const data = dependentDoc.data();
                                setTargetUserName(data.apelido || data.nome || 'Dependente');
                            } else {
                                const targetUserDoc = await getDoc(doc(db, 'users', activeUserId));
                                if (targetUserDoc.exists() && isMounted) {
                                    const data = targetUserDoc.data();
                                    setTargetUserName(data.apelido || data.nome || 'Dependente');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao verificar perfil selecionado no ViewReminders:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [activeUserId, currentUserUid])
    );

    useFocusEffect(
        useCallback(() => {
            if (!activeUserId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            let unsubscribe: (() => void) | null = null;

            const setupListener = async () => {
                let remindersRef;
                const loggedUserId = auth.currentUser?.uid;

                if (!loggedUserId) {
                    setLoading(false);
                    return;
                }

                try {
                    if (activeUserId !== loggedUserId) {
                        const depRef = collection(db, 'users', loggedUserId, 'dependentes', activeUserId, 'reminders');
                        const snap = await getDocs(depRef);
                        
                        if (!snap.empty) {
                            remindersRef = depRef;
                        }
                    } else {
                        const rootRef = collection(db, 'users', loggedUserId, 'reminders');
                        const rootSnap = await getDocs(rootRef);

                        if (!rootSnap.empty) {
                            remindersRef = rootRef;
                        } else {
                            remindersRef = rootRef;
                        }
                    }
                } catch (e) {
                    console.log("Erro ao determinar referência de lembretes:", e);
                }

                if (!remindersRef) {
                    remindersRef = collection(db, 'users', activeUserId, 'reminders');
                }

                const q = query(remindersRef, orderBy('criadoEm', 'desc'));

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const fetchedReminders = snapshot.docs.map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    })) as ReminderItem[];

                    setReminders(fetchedReminders);
                    setLoading(false);
                }, (error) => {
                    console.error('Erro ao buscar lembretes:', error);
                    Alert.alert('Erro', 'Não foi possível carregar os lembretes.');
                    setLoading(false);
                });
            };

            setupListener();

            return () => {
                if (unsubscribe) unsubscribe();
            };
        }, [activeUserId, currentUserUid])
    );

    const getReminderDetails = (item: ReminderItem) => {
        const payload = item.dadosFormulario || {};

        const nameValue = payload.nomeRemedio || payload.tipoExame || payload.especialidade || payload.medico || item.subtitle || 'Lembrete';
        
        let timeFormatted = '--:--';
        let dateFormatted = 'Data não definida';

        if (item.dataAgendamento) {
            const dateObj = new Date(item.dataAgendamento);
            if (!isNaN(dateObj.getTime())) {
                timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const today = new Date();
                const isToday = dateObj.toDateString() === today.toDateString();
                
                const tomorrow = new Date();
                tomorrow.setDate(today.getDate() + 1);
                const isTomorrow = dateObj.toDateString() === tomorrow.toDateString();

                if (isToday) {
                    dateFormatted = 'Hoje';
                } else if (isTomorrow) {
                    dateFormatted = 'Amanhã';
                } else {
                    dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                }
            }
        } else {
            const rawTime = payload.time || payload.horario || payload.horas;
            if (rawTime && typeof rawTime === 'string') {
                timeFormatted = rawTime;
            }
        }

        const toggleInfos: ToggleInfo[] = [];
        const toggleLabels: Record<string, string> = {
            jejum: 'Exige jejum?',
            repetirDiario: 'Repetir diariamente?',
            levarExames: 'Levar exames anteriores',
        };

        Object.entries(payload).forEach(([key, value]) => {
            if (typeof value === 'boolean') {
                const label = toggleLabels[key] || key;
                toggleInfos.push({ label, value });
            }
        });

        return {
            name: String(nameValue).toUpperCase(),
            time: timeFormatted,
            date: dateFormatted,
            toggleInfos
        };
    };

    const handleReminderPress = (reminder: ReminderItem) => {
        setSelectedReminder(reminder);
        setModalVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (!selectedReminder || !activeUserId) return;

        const reminderIdToDelete = selectedReminder.id;
        const responsibleId = auth.currentUser?.uid;

        setModalVisible(false);
        setSelectedReminder(null);

        setReminders((prev) => prev.filter((item) => item.id !== reminderIdToDelete));

        try {
            if (responsibleId && activeUserId !== responsibleId) {
                const depRef = doc(db, 'users', responsibleId, 'dependentes', activeUserId, 'reminders', reminderIdToDelete);
                const depSnap = await getDoc(depRef).catch(() => null);
                if (depSnap && depSnap.exists()) {
                    const data = depSnap.data();
                    if (data.notificationId) {
                        await NotificationService.cancelReminder(data.notificationId);
                    }
                    await deleteDoc(depRef);
                }
            }

            const mainRef = doc(db, 'users', activeUserId, 'reminders', reminderIdToDelete);
            const docSnap = await getDoc(mainRef).catch(() => null);

            if (docSnap && docSnap.exists()) {
                const data = docSnap.data();
                if (data.notificationId) {
                    await NotificationService.cancelReminder(data.notificationId);
                }
                await deleteDoc(mainRef);
            }
        } catch (error) {
            console.error('Erro ao deletar lembrete em segundo plano:', error);
            Alert.alert('Erro', 'Não foi possível excluir o lembrete.');
        }
    };

    const renderCategoryIcon = (reminder: ReminderItem) => {
        const color = isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754');
        const family = reminder.iconFamily || 'MaterialCommunityIcons';
        const name = reminder.iconName || 'bell-outline';

        if (family === 'FontAwesome5') {
            return <FontAwesome5 name={name as any} size={32} color={color} />;
        }
        return <MaterialCommunityIcons name={name as any} size={26} color={color} />;
    };

    // Lógica de Filtragem baseada na categoria (categoryKey)
    const filteredReminders = reminders.filter((item) => {
        if (selectedFilter === 'todos') return true;
        return item.categoryKey === selectedFilter;
    });

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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        styles.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>
                        MEUS LEMBRETES
                    </Text>
                </View>

                {/* FILTROS DO CABEÇALHO (UX/UI Semelhante ao ViewNotes) */}
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {[
                            { key: 'todos', label: 'Todos' },
                            { key: 'remedio', label: 'Remédios' },
                            { key: 'consulta', label: 'Consultas' },
                            { key: 'exame', label: 'Exames' },
                            { key: 'outros', label: 'Outros' },
                        ].map((filter) => {
                            const isSelected = selectedFilter === filter.key;
                            return (
                                <TouchableOpacity
                                    key={filter.key}
                                    style={[
                                        styles.filterChip,
                                        isSelected && styles.filterChipSelected,
                                        isHighContrast && { 
                                            backgroundColor: theme.cardBackground, 
                                            borderColor: theme.border, 
                                            borderWidth: 1.5 
                                        },
                                        isSelected && isHighContrast && { 
                                            backgroundColor: theme.buttonPrimary, 
                                            borderColor: theme.buttonPrimary 
                                        }
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() => setSelectedFilter(filter.key)}
                                >
                                    <Text style={[
                                        styles.filterText,
                                        { fontSize: 14 * fontScale },
                                        isSelected && styles.filterTextSelected,
                                        isHighContrast && { color: theme.textPrimary },
                                        isSelected && isHighContrast && { color: theme.buttonText }
                                    ]}>
                                        {filter.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    {/* INDICADOR VISUAL DO PERFIL SELECIONADO */}
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
                                Perfil selecionado: <Text style={{ fontWeight: '900' }}>{targetUserName}</Text>
                            </Text>
                        </View>
                    ) : null}

                    {loading ? (
                        <ActivityIndicator size="large" color={isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754')} style={{ marginTop: 50 }} />
                    ) : filteredReminders.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="bell-off-outline" size={60} color={isHighContrast ? theme.textSecondary : "#CCC"} />
                            <Text style={[
                                styles.emptyStateText,
                                { fontSize: 18 * fontScale },
                                isHighContrast && { color: theme.textSecondary }
                            ]}>
                                Nenhum lembrete encontrado.
                            </Text>
                        </View>
                    ) : (
                        filteredReminders.map((reminder) => {
                            const { name, time, date, toggleInfos } = getReminderDetails(reminder);

                            return (
                                <TouchableOpacity
                                    key={reminder.id}
                                    style={[
                                        styles.reminderCard,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() => handleReminderPress(reminder)}
                                >
                                    <View style={styles.mainInfoRow}>
                                        <View style={styles.categoryIconBadge}>
                                            {renderCategoryIcon(reminder)}
                                        </View>
                                        <Text 
                                            style={[
                                                styles.reminderTitle,
                                                { fontSize: 20 * fontScale },
                                                isHighContrast && { color: theme.textPrimary }
                                            ]} 
                                            numberOfLines={2}
                                        >
                                            {name}
                                        </Text>
                                    </View>

                                    {toggleInfos.length > 0 && (
                                        <View style={styles.toggleContainer}>
                                            {toggleInfos.map((info, idx) => (
                                                <View key={idx} style={styles.toggleItem}>
                                                    <MaterialCommunityIcons 
                                                        name={info.value ? "check-circle-outline" : "close-circle-outline"} 
                                                        size={22} 
                                                        color={info.value ? (isHighContrast ? theme.buttonPrimary : "#198754") : (isHighContrast ? theme.border : themes.colors.darkRed)} 
                                                    />
                                                    <Text style={[
                                                        styles.toggleText,
                                                        { fontSize: 18 * fontScale },
                                                        isHighContrast && { color: theme.textPrimary }
                                                    ]}>
                                                        {info.label}: <Text style={[
                                                            styles.toggleValueText,
                                                            { fontSize: 18 * fontScale },
                                                            { color: info.value ? (isHighContrast ? theme.buttonPrimary : '#198754') : (isHighContrast ? theme.border : themes.colors.darkRed) }
                                                        ]}>
                                                            {info.value ? 'SIM' : 'NÃO'}
                                                        </Text>
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    <View style={[
                                        styles.divider,
                                        isHighContrast && { backgroundColor: theme.border }
                                    ]} />

                                    <View style={styles.detailsRow}>
                                        <View style={styles.detailItem}>
                                            <MaterialCommunityIcons name="calendar-month-outline" size={20} color={isHighContrast ? theme.textSecondary : "#666"} />
                                            <Text style={[
                                                styles.detailText,
                                                { fontSize: 18 * fontScale },
                                                isHighContrast && { color: theme.textPrimary }
                                            ]}>{date}</Text>
                                        </View>

                                        <View style={styles.detailItem}>
                                            <MaterialCommunityIcons name="clock-outline" size={20} color={isHighContrast ? theme.textSecondary : "#666"} />
                                            <Text style={[
                                                styles.detailText,
                                                { fontSize: 18 * fontScale },
                                                isHighContrast && { color: theme.textPrimary }
                                            ]}>{time}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>

                <CustomNotificationModal
                    visible={modalVisible}
                    reminder={selectedReminder}
                    onClose={() => setModalVisible(false)}
                    onDelete={handleDeleteSelected}
                />
            </SafeAreaView>

            {/* ESPAÇAMENTO SEGURO DA BARRA NATIVA INFERIOR */}
            <SafeAreaView edges={['bottom']} style={isHighContrast && { backgroundColor: theme.background }} />
        </View>
    );
}

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DA PÁGINA
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
    mainWrapper: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: { flex: 1, backgroundColor: '#FFFFFF' },
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
        color: themes.colors.notBlack,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    filterContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    filterScroll: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterChipSelected: {
        backgroundColor: themes.colors.secureGreen || '#198754',
        borderColor: 'transparent',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    filterTextSelected: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 16 },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF3FF',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 8,
        gap: 6,
    },
    profileBadgeText: {
        color: '#333333',
        fontWeight: '500',
    },
    reminderCard: { backgroundColor: '#ffffff', borderWidth: 3, borderColor: themes.colors.secureGreen || '#198754', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
    mainInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    categoryIconBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    reminderTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', letterSpacing: 0.3 },
    toggleContainer: { marginTop: 10, gap: 6, padding: 10, borderRadius: 12 },
    toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggleText: { fontSize: 18, fontWeight: 'bold', color: themes.colors.notBlack },
    toggleValueText: { fontSize: 18, fontWeight: '900' },
    divider: { height: 1, backgroundColor: '#DCDCDC', marginVertical: 10 },
    detailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 18, fontWeight: 'bold', color: themes.colors.notBlack },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyStateText: { fontSize: 18, color: '#888888', textAlign: 'center', marginTop: 16, fontWeight: 'bold' },
});

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DO MODAL
// ---------------------------------------------------------------------------
const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 2, borderColor: 'transparent', padding: 24, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6 },
    iconCircle: { width: 70, height: 70, borderRadius: 50, backgroundColor: themes.colors.secureGreen, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 18, fontWeight: 'bold', color: themes.colors.secureGreen || '#198754', textAlign: 'center', marginBottom: 24 },
    buttonGroup: { flexDirection: 'row', gap: 12, width: '100%' },
    closeButton: { flex: 1, backgroundColor: themes.colors.secureGreen || '#198754', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    closeText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    deleteButton: { flex: 1, backgroundColor: themes.colors.darkRed, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    deleteText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});