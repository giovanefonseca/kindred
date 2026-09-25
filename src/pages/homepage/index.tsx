import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar, Modal, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { style } from './styles';
import { themes } from '../../global/themes';
import { getAllActionRoutes, ActionRouteConfig } from '../../config/routesConfig';
import { useAudioPlayer } from 'expo-audio';

// Firebase
import { collection, getCountFromServer, doc, getDoc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

export interface FirestoreReminder {
    id: string;
    title: string;
    subtitle: string;
    iconFamily?: string;
    iconName?: string;
    dataAgendamento?: string | null;
    dadosFormulario?: Record<string, any>;
}

interface ToggleInfo {
    label: string;
    value: boolean;
}

interface DependentProfile {
    uid: string;
    nome: string;
    photoUrl?: string;
}

// ---------------------------------------------------------------------------
// SELETOR DE PERFIL / DEPENDENTES
// ---------------------------------------------------------------------------
interface DependentSelectorProps {
    selectedUserId: string;
    onSelectUser: (uid: string, name: string) => void;
}

function DependentSelector({ selectedUserId, onSelectUser }: DependentSelectorProps) {
    const [dependents, setDependents] = useState<DependentProfile[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentName, setCurrentName] = useState('Meu Perfil');

    useEffect(() => {
        const fetchDependents = async () => {
            const currentUid = auth.currentUser?.uid;
            if (!currentUid) return;

            try {
                const userDoc = await getDoc(doc(db, 'users', currentUid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const dependentIds: string[] = data.dependentes || [];

                    const list: DependentProfile[] = [];
                    for (const depId of dependentIds) {
                        const depSnap = await getDoc(doc(db, 'users', depId));
                        if (depSnap.exists()) {
                            const depData = depSnap.data();
                            list.push({
                                uid: depId,
                                nome: depData.apelido || depData.nome || 'Dependente',
                                photoUrl: depData.photoUrl,
                            });
                        }
                    }
                    setDependents(list);
                }
            } catch (error) {
                console.error('Erro ao carregar dependentes:', error);
            }
        };

        fetchDependents();
    }, []);

    const handleSelect = (uid: string, name: string) => {
        onSelectUser(uid, name);
        setCurrentName(name);
        setModalVisible(false);
    };

    if (dependents.length === 0) return null;

    return (
        <View style={selectorStyles.container}>
            <TouchableOpacity
                style={selectorStyles.selectorButton}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
            >
                <MaterialCommunityIcons name="account-switch" size={24} color="#FFFFFF" />
                <Text style={selectorStyles.selectorText} numberOfLines={1}>
                    Exibindo: <Text style={selectorStyles.boldText}>{currentName}</Text>
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={selectorStyles.overlay}>
                    <View style={selectorStyles.modalCard}>
                        <Text style={selectorStyles.modalTitle}>SELECIONE O PERFIL</Text>

                        <TouchableOpacity
                            style={[
                                selectorStyles.profileItem,
                                selectedUserId === auth.currentUser?.uid && selectorStyles.profileItemActive
                            ]}
                            onPress={() => handleSelect(auth.currentUser?.uid || '', 'Meu Perfil')}
                        >
                            <MaterialCommunityIcons name="account-circle" size={36} color={themes.colors.primary} />
                            <Text style={selectorStyles.profileName}>Meu Perfil (Responsável)</Text>
                        </TouchableOpacity>

                        <FlatList
                            data={dependents}
                            keyExtractor={(item) => item.uid}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        selectorStyles.profileItem,
                                        selectedUserId === item.uid && selectorStyles.profileItemActive
                                    ]}
                                    onPress={() => handleSelect(item.uid, item.nome)}
                                >
                                    {item.photoUrl ? (
                                        <Image source={{ uri: item.photoUrl }} style={selectorStyles.avatar} />
                                    ) : (
                                        <MaterialCommunityIcons name="account-heart" size={36} color="#198754" />
                                    )}
                                    <Text style={selectorStyles.profileName}>{item.nome}</Text>
                                </TouchableOpacity>
                            )}
                        />

                        <TouchableOpacity style={selectorStyles.closeButton} onPress={() => setModalVisible(false)}>
                            <Text style={selectorStyles.closeText}>CANCELAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ---------------------------------------------------------------------------
// MODAL DE NOTIFICAÇÃO
// ---------------------------------------------------------------------------
interface CustomNotificationModalProps {
    visible: boolean;
    reminder: FirestoreReminder | null;
    queueCount?: number;
    onClose: () => void;
    onDelete: () => void;
}

function CustomNotificationModal({ visible, reminder, queueCount = 1, onClose, onDelete }: CustomNotificationModalProps) {
    if (!reminder) return null;

    const renderIcon = () => {
        const color = themes.colors.secondary || '#ffffff';
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
                <View style={modalStyles.modalCard}>
                    {queueCount > 1 && (
                        <View style={modalStyles.badgeContainer}>
                            <Text style={modalStyles.badgeText}>
                                + {queueCount - 1} LEMBRETE(S) RESTANTE(S)
                            </Text>
                        </View>
                    )}

                    <View style={modalStyles.iconCircle}>
                        {renderIcon()}
                    </View>

                    <Text style={modalStyles.title}>{reminder.title}</Text>
                    <Text style={modalStyles.subtitle}>{reminder.subtitle}</Text>

                    <View style={modalStyles.buttonGroup}>
                        <TouchableOpacity style={modalStyles.deleteButton} onPress={onDelete} activeOpacity={0.8}>
                            <Text style={modalStyles.deleteText}>EXCLUIR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={modalStyles.closeButton} onPress={onClose} activeOpacity={0.8}>
                            <Text style={modalStyles.closeText}>
                                {queueCount > 1 ? 'PRÓXIMO' : 'FECHAR'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL (LIST)
// ---------------------------------------------------------------------------
export default function List() {
    const navigation = useNavigation<NavigationProp<any>>();
    const actions = getAllActionRoutes();

    const [activeUserId, setActiveUserId] = useState<string>(auth.currentUser?.uid || '');

    const [reminders, setReminders] = useState<FirestoreReminder[]>([]);
    const [notesCount, setNotesCount] = useState<number | string>('...');
    const [waterTotal, setWaterTotal] = useState<number>(0);

    const [reminderQueue, setReminderQueue] = useState<FirestoreReminder[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    const [now, setNow] = useState(Date.now());
    const notifiedIdsRef = useRef<Set<string>>(new Set());
    const isInitialLoad = useRef(true);

    const getTodayId = () => {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    };

    const player = useAudioPlayer(require('../../../assets/notifySound.mp3'));

    const playNotificationSound = () => {
        try {
            if (player) {
                player.seekTo(0);
                player.play();
            }
        } catch (error) {
            console.log('Erro ao reproduzir som de notificação:', error);
        }
    };

    useEffect(() => {
        if (!activeUserId) return;

        isInitialLoad.current = true;
        const remindersRef = collection(db, 'users', activeUserId, 'reminders');
        const q = query(remindersRef, orderBy('criadoEm', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReminders: FirestoreReminder[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as Omit<FirestoreReminder, 'id'>),
            }));

            if (isInitialLoad.current) {
                const currentTime = Date.now();
                fetchedReminders.forEach((r) => {
                    if (r.dataAgendamento) {
                        const rTime = new Date(r.dataAgendamento).getTime();
                        if (rTime <= currentTime) {
                            notifiedIdsRef.current.add(r.id);
                        }
                    }
                });
                isInitialLoad.current = false;
            }

            setReminders(fetchedReminders);
        }, (error) => {
            console.error('Erro ao buscar lembretes do Firestore:', error);
        });

        return () => unsubscribe();
    }, [activeUserId]);

    useEffect(() => {
        const timer = setInterval(() => {
            const currentTime = Date.now();
            setNow(currentTime);

            const newTriggeredReminders: FirestoreReminder[] = [];

            reminders.forEach((reminder) => {
                if (reminder.dataAgendamento) {
                    const reminderTime = new Date(reminder.dataAgendamento).getTime();

                    if (reminderTime <= currentTime && !notifiedIdsRef.current.has(reminder.id)) {
                        notifiedIdsRef.current.add(reminder.id);
                        newTriggeredReminders.push(reminder);
                    }
                }
            });

            if (newTriggeredReminders.length > 0) {
                setReminderQueue((prev) => [...prev, ...newTriggeredReminders]);
                setModalVisible(true);
                playNotificationSound();
            }
        }, 3000);

        return () => clearInterval(timer);
    }, [reminders]);

    const currentSelectedReminder = reminderQueue.length > 0 ? reminderQueue[0] : null;

    const visibleReminders = reminders.filter((item) => {
        if (!item.dataAgendamento) return true;
        return new Date(item.dataAgendamento).getTime() <= now;
    });

    const fetchNotesCount = async () => {
        if (!activeUserId) return;

        try {
            const notesRef = collection(db, 'users', activeUserId, 'notes');
            const snapshot = await getCountFromServer(notesRef);
            setNotesCount(snapshot.data().count);
        } catch (error) {
            console.log('Erro ao buscar total de notas:', error);
            setNotesCount(0);
        }
    };

    const fetchTodayWater = async () => {
        if (!activeUserId) return;

        try {
            const waterRef = doc(db, 'users', activeUserId, 'hydration', getTodayId());
            const docSnap = await getDoc(waterRef);
            setWaterTotal(docSnap.exists() ? docSnap.data().total || 0 : 0);
        } catch (error) {
            console.log('Erro ao buscar água:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNotesCount();
            fetchTodayWater();
        }, [activeUserId])
    );

    const waterDisplay = waterTotal >= 1000
        ? `${(waterTotal / 1000).toFixed(1)}L`
        : `${waterTotal}ml`;

    const ACTION_ROUTE_MAP: Record<string, string> = {
        reminder: 'RemindersMenu',
        note: 'NotesMenu',
        emergency: 'EmergencyCallView',
        water: 'WaterTrackingView',
    };

    const handleActionPress = (action: ActionRouteConfig) => {
        const routeName = ACTION_ROUTE_MAP[action.viewKey];

        if (!routeName) {
            console.warn(`Nenhuma rota mapeada para o viewKey "${action.viewKey}"`);
            return;
        }

        navigation.navigate(routeName as never);
    };

    const getReminderDetails = (item: FirestoreReminder) => {
        const payload = item.dadosFormulario || {};

        const nameValue = payload.nomeRemedio || payload.tipoExame || payload.especialidade || payload.medico || item.subtitle || 'Lembrete';

        let timeFormatted = '--:--';
        const rawTime = payload.time || payload.horario || payload.horas;
        if (rawTime && typeof rawTime === 'string') {
            timeFormatted = rawTime;
        }

        let dateFormatted = 'Data não definida';
        if (item.dataAgendamento) {
            const dateObj = new Date(item.dataAgendamento);
            if (!isNaN(dateObj.getTime())) {
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
        }

        const toggleInfos: ToggleInfo[] = [];
        const toggleLabels: Record<string, string> = {
            exigeJejum: 'Exige Jejum',
            jejum: 'Exige Jejum',
            repetirDiario: 'Repetir diariamente?',
            repetirTodoDia: 'Repetir diariamente?',
            repetirDiariamente: 'Repetir diariamente?',
            levarExames: 'Levar exames anteriores',
            levarExamesAnteriores: 'Levar exames anteriores',
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

    const handleReminderPress = (reminder: FirestoreReminder) => {
        setReminderQueue([reminder]);
        setModalVisible(true);
    };

    const handleNextInQueue = () => {
        setReminderQueue((prev) => {
            const nextQueue = prev.slice(1);
            if (nextQueue.length === 0) {
                setModalVisible(false);
            }
            return nextQueue;
        });
    };

    const handleDeleteSelected = () => {
        if (!currentSelectedReminder || !activeUserId) return;

        const reminderIdToDelete = currentSelectedReminder.id;
        handleNextInQueue();

        deleteDoc(doc(db, 'users', activeUserId, 'reminders', reminderIdToDelete)).catch((error) => {
            console.error('Erro ao deletar lembrete em segundo plano:', error);
            Alert.alert('Erro', 'Não foi possível excluir o lembrete.');
        });
    };

    const renderActionIcon = (action: ActionRouteConfig) => {
        if (action.slug === 'definir-lembrete') {
            return <MaterialCommunityIcons name="calendar-alert" size={54} color="#FFFFFF" />;
        }
        return <MaterialCommunityIcons name={action.iconName as any} size={54} color="#FFFFFF" />;
    };

    const renderNotificationIcon = (notification: FirestoreReminder) => {
        const color = themes.colors.secureGreen || '#198754';
        if (notification.iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={notification.iconName as any} size={32} color={color} />;
        }
        return <MaterialCommunityIcons name={(notification.iconName as any) || 'bell-outline'} size={26} color={color} />;
    };

    return (
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>

                <DependentSelector
                    selectedUserId={activeUserId}
                    onSelectUser={(uid) => setActiveUserId(uid)}
                />

                <View style={style.notificationsSection}>
                    <Text style={style.sectionTitle}>LEMBRETES RECENTES</Text>

                    {visibleReminders.length === 0 ? (
                        <Text style={style.emptyText}>Nenhum lembrete configurado.</Text>
                    ) : (
                        visibleReminders.map((reminder) => {
                            const { name, time, date, toggleInfos } = getReminderDetails(reminder);

                            return (
                                <TouchableOpacity
                                    key={reminder.id}
                                    style={listStyles.reminderCard}
                                    activeOpacity={0.8}
                                    onPress={() => handleReminderPress(reminder)}
                                >
                                    <View style={listStyles.mainInfoRow}>
                                        <View style={listStyles.categoryIconBadge}>
                                            {renderNotificationIcon(reminder)}
                                        </View>
                                        <Text style={listStyles.reminderTitle} numberOfLines={2}>
                                            {name}
                                        </Text>
                                    </View>

                                    {toggleInfos.length > 0 && (
                                        <View style={listStyles.toggleContainer}>
                                            {toggleInfos.map((info, idx) => (
                                                <View key={idx} style={listStyles.toggleItem}>
                                                    <MaterialCommunityIcons
                                                        name={info.value ? "check-circle-outline" : "close-circle-outline"}
                                                        size={22}
                                                        color={info.value ? "#198754" : themes.colors.darkRed}
                                                    />
                                                    <Text style={listStyles.toggleText}>
                                                        {info.label}: <Text style={[listStyles.toggleValueText, { color: info.value ? '#198754' : themes.colors.darkRed }]}>
                                                            {info.value ? 'SIM' : 'NÃO'}
                                                        </Text>
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    <View style={listStyles.divider} />

                                    <View style={listStyles.detailsRow}>
                                        <View style={listStyles.detailItem}>
                                            <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#666" />
                                            <Text style={listStyles.detailText}>{date}</Text>
                                        </View>

                                        <View style={listStyles.detailItem}>
                                            <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
                                            <Text style={listStyles.detailText}>{time}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                <Text style={style.sectionTitle}>AÇÕES RÁPIDAS</Text>
                <View style={style.gridContainer}>
                    {actions.map((action) => (
                        <TouchableOpacity key={action.id} style={[style.card, { backgroundColor: action.color }]} onPress={() => handleActionPress(action)}>
                            {renderActionIcon(action)}
                            <Text style={style.cardText}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={style.sectionTitle}>MEU PAINEL</Text>
                <View style={style.dashboardGrid}>
                    <View style={style.dashboardCardSecurity}>
                        <Text style={[style.cardValue, { color: '#ffffff' }]}>OK</Text>
                        <Text style={style.cardLabel}>Segurança</Text>
                    </View>

                    <View style={style.dashboardCardNote}>
                        <Text style={style.cardValue}>{notesCount}</Text>
                        <Text style={style.cardLabel}>Minhas Anotações</Text>
                    </View>

                    <View style={style.dashboardCardReminder}>
                        <Text style={style.cardValue}>{reminders.length}</Text>
                        <Text style={style.cardLabel}>Lembretes Ativos</Text>
                    </View>

                    <View style={style.dashboardCardHidro}>
                        <Text style={style.cardValue}>{waterDisplay}</Text>
                        <Text style={style.cardLabel}>Minha Hidratação</Text>
                    </View>
                </View>
            </ScrollView>

            <CustomNotificationModal
                visible={modalVisible && !!currentSelectedReminder}
                reminder={currentSelectedReminder}
                queueCount={reminderQueue.length}
                onClose={handleNextInQueue}
                onDelete={handleDeleteSelected}
            />
        </SafeAreaView>
    );
}

// (blocos de StyleSheet.create permanecem exatamente como estavam)

// ---------------------------------------------------------------------------
// ESTILOS DO SELETOR DE PERFIL
// ---------------------------------------------------------------------------
const selectorStyles = StyleSheet.create({
    container: { width: '100%', marginBottom: 16 },
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0052cc',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 24,
        gap: 8,
        elevation: 3,
        shadowColor: '#0052cc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    selectorText: { flex: 1, color: '#FFFFFF', fontSize: 16 },
    boldText: { fontWeight: 'bold' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 16, textAlign: 'center' },
    profileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F5F7FA',
        marginBottom: 8,
        gap: 12,
    },
    profileItemActive: { borderWidth: 2, borderColor: '#0052cc', backgroundColor: '#EBF3FF' },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    profileName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    closeButton: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
    closeText: { color: '#666', fontWeight: 'bold' },
});

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DO CARD DE LEMBRETE
// ---------------------------------------------------------------------------
const listStyles = StyleSheet.create({
    reminderCard: {
        backgroundColor: '#ffffff',
        borderWidth: 3,
        borderColor: themes.colors.secureGreen || '#198754',
        borderRadius: 24,
        paddingVertical: 14,
        paddingHorizontal: 18,
        marginBottom: 12
    },
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
});

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DO MODAL DE NOTIFICAÇÃO
// ---------------------------------------------------------------------------
const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 2, borderColor: 'transparent', padding: 24, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6 },
    badgeContainer: {
        backgroundColor: '#FFE6D5',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    badgeText: {
        color: themes.colors.orange || '#D97706',
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    iconCircle: { width: 70, height: 70, borderRadius: 50, backgroundColor: themes.colors.secureGreen, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 18, fontWeight: 'bold', color: themes.colors.secureGreen || '#198754', textAlign: 'center', marginBottom: 24 },
    buttonGroup: { flexDirection: 'row', gap: 12, width: '100%' },
    closeButton: { flex: 1, backgroundColor: themes.colors.secureGreen || '#198754', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    closeText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    deleteButton: { flex: 1, backgroundColor: themes.colors.darkRed, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    deleteText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});