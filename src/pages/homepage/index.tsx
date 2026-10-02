import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar, Modal, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { style } from './styles';
import { themes } from '../../global/themes';
import { getAllActionRoutes, ActionRouteConfig } from '../../config/routesConfig';
import { useAudioPlayer } from 'expo-audio';

// Contexto Global de Acessibilidade
import { useAccessibility, ThemeColors } from '../../contexts/AccessibilityContext';

// Escutador de Chamadas de Emergência em Tempo Real
import { IncomingCallListener } from '../../components/IncomingCallListener';

// Modal de Tour / Boas-Vindas Guiado
import { OnboardingTourModal } from '../../components/OnboardingTourModal';

// Serviço de Notificações
import { NotificationService } from '../../services/NotificationService';

// Firebase
import { collection, getCountFromServer, doc, getDoc, onSnapshot, query, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

export interface FirestoreReminder {
    id: string;
    title: string;
    subtitle: string;
    iconFamily?: string;
    iconName?: string;
    dataAgendamento?: string | null;
    dadosFormulario?: Record<string, any>;
    categoria?: string;
    type?: string;
    lembrarDiariamente?: boolean;
    frequencia?: string;
    notificationId?: string | null;
}

interface DependentProfile {
    uid: string;
    nome: string;
    photoUrl?: string;
}

// Helper para calcular o tempo até o lembrete
const getTimeUntilText = (targetDateIso: string, nowMs: number): string => {
    const targetMs = new Date(targetDateIso).getTime();
    const diffMs = targetMs - nowMs;

    if (diffMs <= 0) return 'agora';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours > 0) {
        if (minutes > 0) {
            return `daqui a ${hours} ${hours === 1 ? 'hora' : 'horas'} e ${minutes} min`;
        }
        return `daqui a ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }

    if (minutes === 0) return 'daqui a menos de 1 min';

    return `daqui a ${minutes} min`;
};

// ---------------------------------------------------------------------------
// SELETOR DE PERFIL / DEPENDENTES
// ---------------------------------------------------------------------------
interface DependentSelectorProps {
    selectedUserId: string;
    onSelectUser: (uid: string, name: string) => void;
    fontScale: number;
    theme: ThemeColors;
    isHighContrast: boolean;
}

function DependentSelector({ selectedUserId, onSelectUser, fontScale, theme, isHighContrast }: DependentSelectorProps) {
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
                style={[
                    selectorStyles.selectorButton,
                    isHighContrast && { backgroundColor: theme.buttonPrimary }
                ]}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
            >
                <MaterialCommunityIcons name="account-switch" size={24} color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                <Text style={[
                    selectorStyles.selectorText, 
                    { fontSize: 16 * fontScale },
                    isHighContrast && { color: theme.buttonText }
                ]} numberOfLines={1}>
                    Exibindo: <Text style={selectorStyles.boldText}>{currentName}</Text>
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={selectorStyles.overlay}>
                    <View style={[
                        selectorStyles.modalCard,
                        isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }
                    ]}>
                        <Text style={[
                            selectorStyles.modalTitle,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>SELECIONE O PERFIL</Text>

                        <TouchableOpacity
                            style={[
                                selectorStyles.profileItem,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                selectedUserId === auth.currentUser?.uid && (isHighContrast ? { borderColor: theme.buttonPrimary, borderWidth: 2 } : selectorStyles.profileItemActive)
                            ]}
                            onPress={() => handleSelect(auth.currentUser?.uid || '', 'Meu Perfil')}
                        >
                            <MaterialCommunityIcons name="account-circle" size={36} color={isHighContrast ? theme.buttonPrimary : themes.colors.primary} />
                            <Text style={[
                                selectorStyles.profileName,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>
                                Meu Perfil (Responsável)
                            </Text>
                        </TouchableOpacity>

                        <FlatList
                            data={dependents}
                            keyExtractor={(item) => item.uid}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        selectorStyles.profileItem,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                        selectedUserId === item.uid && (isHighContrast ? { borderColor: theme.buttonPrimary, borderWidth: 2 } : selectorStyles.profileItemActive)
                                    ]}
                                    onPress={() => handleSelect(item.uid, item.nome)}
                                >
                                    {item.photoUrl ? (
                                        <Image source={{ uri: item.photoUrl }} style={selectorStyles.avatar} />
                                    ) : (
                                        <MaterialCommunityIcons name="account-heart" size={36} color={isHighContrast ? theme.buttonPrimary : "#198754"} />
                                    )}
                                    <Text style={[
                                        selectorStyles.profileName,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.textPrimary }
                                    ]}>{item.nome}</Text>
                                </TouchableOpacity>
                            )}
                        />

                        <TouchableOpacity style={selectorStyles.closeButton} onPress={() => setModalVisible(false)}>
                            <Text style={[
                                selectorStyles.closeText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.textSecondary }
                            ]}>CANCELAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ---------------------------------------------------------------------------
// MODAL DE NOTIFICAÇÃO (VALIDAÇÃO DE RESPOSTA SIM / NÃO / FECHAR)
// ---------------------------------------------------------------------------
interface CustomNotificationModalProps {
    visible: boolean;
    reminder: FirestoreReminder | null;
    queueCount?: number;
    onConfirmYes: () => void;
    onSnoozeNo: () => void;
    onCloseModal: () => void;
    fontScale: number;
    theme: ThemeColors;
    isHighContrast: boolean;
}

function CustomNotificationModal({ visible, reminder, queueCount = 1, onConfirmYes, onSnoozeNo, onCloseModal, fontScale, theme, isHighContrast }: CustomNotificationModalProps) {
    if (!reminder) return null;

    const payload = reminder.dadosFormulario || {};
    const category = reminder.categoria || reminder.type || payload.categoria || payload.tipo || '';

    const getReminderQuestion = () => {
        if (category === 'Medicação' || payload.nomeRemedio) {
            return 'Você já tomou essa medicação?';
        } else if (category === 'Consulta' || payload.especialidade || payload.medico) {
            return 'Tudo certo para ir à esta consulta hoje?';
        } else if (category === 'Exame' || payload.tipoExame) {
            return 'Tudo certo para realizar esse exame hoje?';
        }
        return 'Você já concluiu este lembrete?';
    };

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
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCloseModal}>
            <View style={modalStyles.overlay}>
                <View style={[
                    modalStyles.modalCard,
                    isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1.5 }
                ]}>
                    {queueCount > 1 && (
                        <View style={[
                            modalStyles.badgeContainer,
                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                        ]}>
                            <Text style={[
                                modalStyles.badgeText,
                                { fontSize: 13 * fontScale },
                                isHighContrast && { color: theme.buttonText }
                            ]}>
                                + {queueCount - 1} LEMBRETE(S) RESTANTE(S)
                            </Text>
                        </View>
                    )}

                    <View style={[
                        modalStyles.iconCircle,
                        isHighContrast && { backgroundColor: theme.buttonPrimary }
                    ]}>
                        {renderIcon()}
                    </View>

                    <Text style={[
                        modalStyles.title,
                        { fontSize: 22 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>{reminder.title}</Text>

                    <Text style={[
                        modalStyles.subtitle,
                        { fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>{reminder.subtitle}</Text>

                    <Text style={[
                        modalStyles.questionText,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>{getReminderQuestion()}</Text>

                    <View style={modalStyles.buttonGroup}>
                        <TouchableOpacity
                            style={[
                                modalStyles.btnYes,
                                isHighContrast && { backgroundColor: theme.buttonPrimary }
                            ]}
                            onPress={onConfirmYes}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="check-circle" size={26} color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                            <Text style={[
                                modalStyles.btnYesText,
                                { fontSize: 20 * fontScale },
                                isHighContrast && { color: theme.buttonText }
                            ]}>SIM</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                modalStyles.btnNo,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                            ]}
                            onPress={onSnoozeNo}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="clock-fast" size={24} color={isHighContrast ? theme.textPrimary : "#334155"} />
                            <Text style={[
                                modalStyles.btnNoText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>NÃO (Adiar 5 min)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={modalStyles.btnClose}
                            onPress={onCloseModal}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons name="close-circle-outline" size={22} color={isHighContrast ? theme.textSecondary : "#64748B"} />
                            <Text style={[
                                modalStyles.btnCloseText,
                                { fontSize: 15 * fontScale },
                                isHighContrast && { color: theme.textSecondary }
                            ]}>FECHAR (Manter pendente)</Text>
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

    const { fontScale, theme, isHighContrast } = useAccessibility();

    const [activeUserId, setActiveUserId] = useState<string>(auth.currentUser?.uid || '');

    const [reminders, setReminders] = useState<FirestoreReminder[]>([]);
    const [notesCount, setNotesCount] = useState<number | string>('...');
    const [waterTotal, setWaterTotal] = useState<number>(0);
    const [waterGoal, setWaterGoal] = useState<number>(2000);

    const [reminderQueue, setReminderQueue] = useState<FirestoreReminder[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    
    // Estado do Tour Guiado
    const [isTourVisible, setIsTourVisible] = useState(false);

    const [now, setNow] = useState(Date.now());
    const notifiedIdsRef = useRef<Set<string>>(new Set());

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

    // Checa primeira vez para exibir o Tour Guiado
    useEffect(() => {
        const checkFirstAccess = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem('@has_seen_tour');
                if (!hasSeen) {
                    setIsTourVisible(true);
                }
            } catch (error) {
                console.log('Erro ao verificar status do tour:', error);
            }
        };

        checkFirstAccess();
    }, []);

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

    // Lembretes agendados para as próximas 2 horas (window: now até now + 2h)
    const upcomingTwoHoursReminders = reminders
        .filter((item) => {
            if (!item.dataAgendamento) return false;
            const timeMs = new Date(item.dataAgendamento).getTime();
            const twoHoursInMs = 2 * 60 * 60 * 1000;
            return timeMs > now && timeMs <= now + twoHoursInMs;
        })
        .sort((a, b) => new Date(a.dataAgendamento!).getTime() - new Date(b.dataAgendamento!).getTime());

    useFocusEffect(
        useCallback(() => {
            if (!activeUserId && auth.currentUser?.uid) {
                setActiveUserId(auth.currentUser.uid);
            }
            fetchNotesCount();
            fetchTodayWater();
        }, [activeUserId])
    );

    // Reseta notificações processadas quando troca de usuário
    useEffect(() => {
        notifiedIdsRef.current.clear();
    }, [activeUserId]);

    // ---------------------------------------------------------------------------
    // 1. ESCUTA EM TEMPO REAL DOS LEMBRETES COM TRATAMENTO DE ERRO
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!activeUserId) {
            setReminders([]);
            return;
        }

        const remindersRef = collection(db, 'users', activeUserId, 'reminders');
        const q = query(remindersRef);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const fetchedReminders: FirestoreReminder[] = [];
                snapshot.forEach((docSnap) => {
                    fetchedReminders.push({ id: docSnap.id, ...docSnap.data() } as FirestoreReminder);
                });
                setReminders(fetchedReminders);
            },
            (error) => {
                console.warn('Permissão negada ou erro na busca de lembretes:', error.message);
                setReminders([]);
            }
        );

        return () => unsubscribe();
    }, [activeUserId]);

    // ---------------------------------------------------------------------------
    // 2. BUSCA DE NOTAS E HIDRATAÇÃO COM TRATAMENTO TRY/CATCH
    // ---------------------------------------------------------------------------
    const fetchNotesCount = async () => {
        if (!activeUserId) return;

        try {
            const notesRef = collection(db, 'users', activeUserId, 'notes');
            const snapshot = await getCountFromServer(notesRef);
            setNotesCount(snapshot.data().count);
        } catch (error: any) {
            console.warn('Erro/Permissão ao buscar notas:', error.message);
            setNotesCount(0);
        }
    };

    const fetchTodayWater = async () => {
        if (!activeUserId) return;

        try {
            const userRef = doc(db, 'users', activeUserId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data().metaHidratacao) {
                setWaterGoal(userSnap.data().metaHidratacao);
            }

            const waterRef = doc(db, 'users', activeUserId, 'hydration', getTodayId());
            const docSnap = await getDoc(waterRef);
            setWaterTotal(docSnap.exists() ? docSnap.data().total || 0 : 0);
        } catch (error: any) {
            console.warn('Erro/Permissão ao buscar hidratação:', error.message);
            setWaterTotal(0);
        }
    };

    const waterDisplay = waterTotal >= 1000
        ? `${(waterTotal / 1000).toFixed(1)}L`
        : `${waterTotal}ml`;

    const waterPercentage = Math.min(100, Math.round((waterTotal / waterGoal) * 100));

    const ACTION_ROUTE_MAP: Record<string, string> = {
        reminder: 'RemindersMenu',
        note: 'NotesMenu',
        emergency: 'EmergencyCallView',
        water: 'WaterTrackingView',
    };

    const handleActionPress = (action: ActionRouteConfig) => {
        const routeName = ACTION_ROUTE_MAP[action.viewKey];

        if (!routeName) return;

        (navigation.navigate as any)(routeName, { targetUserId: activeUserId });
    };

    const getReminderDetails = (item: FirestoreReminder) => {
        const payload = item.dadosFormulario || {};

        const nameValue = payload.nomeRemedio || payload.tipoExame || payload.especialidade || payload.medico || item.subtitle || 'Lembrete';

        let timeFormatted = '--:--';
        const rawTime = payload.time || payload.horario || payload.horas;
        if (rawTime && typeof rawTime === 'string') {
            timeFormatted = rawTime;
        }

        const timeUntilStr = item.dataAgendamento ? getTimeUntilText(item.dataAgendamento, now) : '';

        return {
            name: String(nameValue).toUpperCase(),
            time: timeFormatted,
            timeUntilStr,
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

    const handleCloseModal = () => {
        handleNextInQueue();
    };

    const handleConfirmYes = async () => {
        if (!currentSelectedReminder || !activeUserId) return;

        const reminder = currentSelectedReminder;
        const payload = reminder.dadosFormulario || {};
        const isDaily = reminder.lembrarDiariamente || 
                        reminder.frequencia === 'Diariamente' || 
                        payload.repetirDiario || 
                        payload.repetirTodoDia || 
                        payload.repetirDiariamente;

        const reminderRef = doc(db, 'users', activeUserId, 'reminders', reminder.id);
        handleNextInQueue();

        try {
            if (isDaily) {
                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + 1);

                await updateDoc(reminderRef, {
                    dataAgendamento: nextDate.toISOString(),
                    status: 'pendente'
                });
            } else {
                // Cancela o alarme físico no celular antes de excluir do Firestore
                const reminderSnap = await getDoc(reminderRef);
                if (reminderSnap.exists()) {
                    const data = reminderSnap.data();
                    if (data.notificationId) {
                        await NotificationService.cancelReminder(data.notificationId);
                    }
                }

                await deleteDoc(reminderRef);
            }
        } catch (error) {
            console.error('Erro ao processar confirmação do lembrete:', error);
            Alert.alert('Erro', 'Não foi possível atualizar o lembrete.');
        }
    };

    const handleSnoozeNo = async () => {
        if (!currentSelectedReminder || !activeUserId) return;

        const reminder = currentSelectedReminder;
        const reminderRef = doc(db, 'users', activeUserId, 'reminders', reminder.id);
        
        notifiedIdsRef.current.delete(reminder.id);
        handleNextInQueue();

        try {
            const snoozeDate = new Date();
            snoozeDate.setMinutes(snoozeDate.getMinutes() + 5);

            await updateDoc(reminderRef, {
                dataAgendamento: snoozeDate.toISOString()
            });
        } catch (error) {
            console.error('Erro ao adiar lembrete:', error);
            Alert.alert('Erro', 'Não foi possível adiar o lembrete.');
        }
    };

    const renderActionIcon = (action: ActionRouteConfig) => {
        const color = isHighContrast ? theme.buttonText : '#FFFFFF';
        if (action.slug === 'definir-lembrete') {
            return <MaterialCommunityIcons name="calendar-alert" size={54} color={color} />;
        }
        return <MaterialCommunityIcons name={action.iconName as any} size={54} color={color} />;
    };

    const renderNotificationIcon = (notification: FirestoreReminder) => {
        const color = isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754');
        if (notification.iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={notification.iconName as any} size={28} color={color} />;
        }
        return <MaterialCommunityIcons name={(notification.iconName as any) || 'bell-outline'} size={24} color={color} />;
    };

    return (
        <SafeAreaView style={[style.container, isHighContrast && { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <StatusBar barStyle={isHighContrast ? "light-content" : "dark-content"} backgroundColor={isHighContrast ? theme.background : "#FFFFFF"} />
            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>

                {/* BOTÃO DE ALTERNÂNCIA NO TOPO */}
                <DependentSelector
                    selectedUserId={activeUserId}
                    onSelectUser={(uid) => setActiveUserId(uid)}
                    fontScale={fontScale}
                    theme={theme}
                    isHighContrast={isHighContrast}
                />

                <View style={style.notificationsSection}>
                    <Text style={[
                        style.sectionTitle,
                        { fontSize: (style.sectionTitle.fontSize || 16) * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>
                        PRÓXIMOS LEMBRETES
                    </Text>

                    {upcomingTwoHoursReminders.length === 0 ? (
                        <Text style={[
                            style.emptyText,
                            { fontSize: (style.emptyText.fontSize || 14) * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>
                            Sem lembretes para as próximas horas.
                        </Text>
                    ) : (
                        upcomingTwoHoursReminders.map((reminder) => {
                            const { name, time, timeUntilStr } = getReminderDetails(reminder);

                            return (
                                <TouchableOpacity
                                    key={reminder.id}
                                    style={[
                                        listStyles.compactCard,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                    ]}
                                    activeOpacity={0.8}
                                    onPress={() => handleReminderPress(reminder)}
                                >
                                    <View style={listStyles.compactIconBadge}>
                                        {renderNotificationIcon(reminder)}
                                    </View>

                                    <View style={listStyles.compactContent}>
                                        <Text style={[
                                            listStyles.compactTitle,
                                            { fontSize: 17 * fontScale },
                                            isHighContrast && { color: theme.textPrimary }
                                        ]} numberOfLines={1}>
                                            {name}
                                        </Text>

                                        <Text style={[
                                            listStyles.compactSubtext,
                                            { fontSize: 14 * fontScale },
                                            isHighContrast && { color: theme.textSecondary }
                                        ]}>
                                            {time} • <Text style={isHighContrast ? { color: theme.buttonPrimary } : listStyles.timeHighlight}>{timeUntilStr}</Text>
                                        </Text>
                                    </View>

                                    <MaterialCommunityIcons name="chevron-right" size={24} color={isHighContrast ? theme.textSecondary : "#94A3B8"} />
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                <Text style={[
                    style.sectionTitle,
                    { fontSize: (style.sectionTitle.fontSize || 16) * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    AÇÕES RÁPIDAS
                </Text>
                <View style={style.gridContainer}>
                    {actions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={[
                                style.card,
                                { backgroundColor: isHighContrast ? theme.buttonPrimary : action.color }
                            ]}
                            onPress={() => handleActionPress(action)}
                        >
                            {renderActionIcon(action)}
                            <Text style={[
                                style.cardText,
                                { fontSize: (style.cardText.fontSize || 14) * fontScale },
                                isHighContrast && { color: theme.buttonText }
                            ]}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* MEU PAINEL */}
                <Text style={[
                    style.sectionTitle,
                    { fontSize: (style.sectionTitle.fontSize || 16) * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>
                    MEU PAINEL
                </Text>

                <View style={style.dashboardGrid}>

                    {/* CARD 1: SEGURANÇA */}
                    <TouchableOpacity 
                        style={[
                            style.dashboardCardSecurity,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => (navigation.navigate as any)('EmergencyCallView', { targetUserId: activeUserId })}
                    >
                        <View style={dashboardStyles.cardHeader}>
                            <MaterialCommunityIcons 
                                name="shield-check" 
                                size={32} 
                                color={isHighContrast ? theme.buttonPrimary : themes.colors.darkRed || "#8B0000"} 
                            />
                            <Feather name="chevron-right" size={20} color={isHighContrast ? theme.textSecondary : "#888"} />
                        </View>
                        <Text style={[
                            style.cardValue,
                            { color: isHighContrast ? theme.textPrimary : themes.colors.notBlack, fontSize: (style.cardValue.fontSize || 20) * fontScale }
                        ]}>OK</Text>
                        <Text style={[
                            style.cardLabel,
                            { fontSize: (style.cardLabel.fontSize || 12) * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>Segurança</Text>  
                    </TouchableOpacity>

                    {/* CARD 2: MINHAS ANOTAÇÕES */}
                    <TouchableOpacity 
                        style={[
                            style.dashboardCardNote,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => (navigation.navigate as any)('ViewNotes', { targetUserId: activeUserId })}
                    >
                        <View style={dashboardStyles.cardHeader}>
                            <MaterialCommunityIcons 
                                name="notebook" 
                                size={32} 
                                color={isHighContrast ? theme.buttonPrimary : "#D97706"} 
                            />
                            <Feather name="chevron-right" size={20} color={isHighContrast ? theme.textSecondary : "#888"} />
                        </View>
                        <Text style={[
                            style.cardValue,
                            { fontSize: (style.cardValue.fontSize || 20) * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>{notesCount}</Text>
                        <Text style={[
                            style.cardLabel,
                            { fontSize: (style.cardLabel.fontSize || 12) * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>Minhas Anotações</Text>
                    </TouchableOpacity>

                    {/* CARD 3: LEMBRETES ATIVOS */}
                    <TouchableOpacity 
                        style={[
                            style.dashboardCardReminder,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => (navigation.navigate as any)('ViewReminders', { targetUserId: activeUserId })}
                    >
                        <View style={dashboardStyles.cardHeader}>
                            <MaterialCommunityIcons 
                                name="bell-ring" 
                                size={32} 
                                color={isHighContrast ? theme.buttonPrimary : "#16A34A"} 
                            />
                            <Feather name="chevron-right" size={20} color={isHighContrast ? theme.textSecondary : "#888"} />
                        </View>
                        <Text style={[
                            style.cardValue,
                            { fontSize: (style.cardValue.fontSize || 20) * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>{reminders.length}</Text>
                        <Text style={[
                            style.cardLabel,
                            { fontSize: (style.cardLabel.fontSize || 12) * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>Lembretes Ativos</Text>
                    </TouchableOpacity>

                    {/* CARD 4: MINHA HIDRATAÇÃO */}
                    <TouchableOpacity 
                        style={[
                            style.dashboardCardHidro,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => (navigation.navigate as any)('WaterTrackingView', { targetUserId: activeUserId })}
                    >
                        <View style={dashboardStyles.cardHeader}>
                            <MaterialCommunityIcons 
                                name="water" 
                                size={32} 
                                color={isHighContrast ? theme.buttonPrimary : "#2563EB"} 
                            />
                            <Feather name="chevron-right" size={20} color={isHighContrast ? theme.textSecondary : "#888"} />
                        </View>
                        <Text style={[
                            style.cardValue,
                            { fontSize: (style.cardValue.fontSize || 20) * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>{waterDisplay}</Text>
                        <Text style={[
                            style.cardLabel,
                            { fontSize: (style.cardLabel.fontSize || 12) * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>Minha Hidratação</Text>

                        {/* MINI BARRA DE PROGRESSO */}
                        <View style={[
                            dashboardStyles.progressBarTrack,
                            isHighContrast && { backgroundColor: theme.border }
                        ]}>
                            <View style={[
                                dashboardStyles.progressBarFill,
                                { width: `${waterPercentage}%` },
                                isHighContrast && { backgroundColor: theme.buttonPrimary }
                            ]} />
                        </View>
                    </TouchableOpacity>

                </View>
            </ScrollView>

            {/* MODAL DE TOUR / BOAS-VINDAS */}
            <OnboardingTourModal
                visible={isTourVisible}
                onClose={() => setIsTourVisible(false)}
            />

            <CustomNotificationModal
                visible={modalVisible && !!currentSelectedReminder}
                reminder={currentSelectedReminder}
                queueCount={reminderQueue.length}
                onConfirmYes={handleConfirmYes}
                onSnoozeNo={handleSnoozeNo}
                onCloseModal={handleCloseModal}
                fontScale={fontScale}
                theme={theme}
                isHighContrast={isHighContrast}
            />

            <IncomingCallListener />
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// ESTILOS ADICIONAIS PARA O DASHBOARD E LISTA
// ---------------------------------------------------------------------------
const dashboardStyles = StyleSheet.create({
    cardHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressBarTrack: {
        width: '100%',
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#2563EB',
        borderRadius: 3,
    },
});

const selectorStyles = StyleSheet.create({
    container: { width: '100%', marginBottom: 16 },
    selectorButton: {
        marginTop: 20,
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

const listStyles = StyleSheet.create({
    compactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: themes.colors.secureGreen || '#198754',
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 10,
        gap: 12,
    },
    compactIconBadge: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactContent: {
        flex: 1,
    },
    compactTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 2,
    },
    compactSubtext: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    timeHighlight: {
        color: themes.colors.orange || '#D97706',
        fontWeight: 'bold',
    },
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6 },
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
    iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: themes.colors.secureGreen || '#198754', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    title: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 },
    subtitle: { fontSize: 18, fontWeight: 'bold', color: themes.colors.secureGreen || '#198754', textAlign: 'center', marginBottom: 16 },
    questionText: { fontSize: 20, fontWeight: 'bold', color: '#b91c1c', textAlign: 'center', marginBottom: 24 },
    buttonGroup: { width: '100%', gap: 10 },
    btnYes: { flexDirection: 'row', backgroundColor: '#198754', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 2 },
    btnYesText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
    btnNo: { flexDirection: 'row', backgroundColor: '#E2E8F0', paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    btnNoText: { color: '#334155', fontSize: 16, fontWeight: 'bold' },
    btnClose: { flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 },
    btnCloseText: { color: '#64748B', fontSize: 15, fontWeight: '700' },
});