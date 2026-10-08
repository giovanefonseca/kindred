import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar, Modal, StyleSheet, FlatList, Image, Animated, Easing, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
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

// Modal Personalizado de Notificação
import { CustomNotificationModal } from '../../components/CustomNotificationModal/CustomNotificationModal';

// Serviço de Notificações
import { NotificationService } from '../../services/NotificationService';

// Firebase (Adicionado o 'where')
import { collection, getCountFromServer, doc, getDoc, onSnapshot, query, deleteDoc, updateDoc, addDoc, serverTimestamp, where } from 'firebase/firestore';
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
// COMPONENTE DE CARD DE LEMBRETE COM ANIMAÇÃO DE CHECK + HEIGHT COLLAPSE
// ---------------------------------------------------------------------------
interface AnimatedReminderCardProps {
    reminder: FirestoreReminder;
    fontScale: number;
    theme: ThemeColors;
    isHighContrast: boolean;
    onPress: () => void;
    renderIcon: (reminder: FirestoreReminder) => React.ReactNode;
    details: { name: string; time: string; timeUntilStr: string };
}

function AnimatedReminderCard({ reminder, fontScale, theme, isHighContrast, onPress, renderIcon, details }: AnimatedReminderCardProps) {
    return (
        <TouchableOpacity
            style={[
                listStyles.compactCard,
                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
            ]}
            activeOpacity={0.8}
            onPress={onPress}
        >
            <View style={listStyles.compactIconBadge}>
                {renderIcon(reminder)}
            </View>

            <View style={listStyles.compactContent}>
                <Text style={[
                    listStyles.compactTitle,
                    { fontSize: 17 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]} numberOfLines={1}>
                    {details.name}
                </Text>

                <Text style={[
                    listStyles.compactSubtext,
                    { fontSize: 14 * fontScale },
                    isHighContrast && { color: theme.textSecondary }
                ]}>
                    {details.time} • <Text style={isHighContrast ? { color: theme.buttonPrimary } : listStyles.timeHighlight}>{details.timeUntilStr}</Text>
                </Text>
            </View>

            <MaterialCommunityIcons name="chevron-right" size={24} color={isHighContrast ? theme.textSecondary : "#94A3B8"} />
        </TouchableOpacity>
    );
}

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

    // Estado da Animação do Botão SIM no Modal
    const [isConfirmingAnim, setIsConfirmingAnim] = useState(false);
    const checkScaleAnim = useRef(new Animated.Value(0)).current;

    const [now, setNow] = useState(Date.now());
    const notifiedIdsRef = useRef<Set<string>>(new Set());

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

    // Lembretes agendados para as próximas 2 horas
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

            let unsubscribeWater: any;
            fetchTodayWater().then((unsub) => {
                unsubscribeWater = unsub;
            });

            return () => {
                if (typeof unsubscribeWater === 'function') {
                    unsubscribeWater();
                }
            };
        }, [activeUserId])
    );

    useEffect(() => {
        notifiedIdsRef.current.clear();
    }, [activeUserId]);

    // Escuta em tempo real dos lembretes no Firestore
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

    // NOVA LÓGICA DE HIDRATAÇÃO (IDÊNTICA AO DEPENDENT DETAIL)
    const fetchTodayWater = async () => {
        if (!activeUserId) return;

        try {
            // 1. Busca a meta do usuário
            const userRef = doc(db, 'users', activeUserId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data()?.metaHidratacao) {
                setWaterGoal(userSnap.data().metaHidratacao);
            } else {
                setWaterGoal(2000); 
            }

            // 2. Formata a data com zeros (exatamente igual ao DependentDetail)
            const dateObj = new Date();
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            // 3. Query apontando para os dailyLogs do dia de hoje
            const logsQuery = query(
                collection(db, 'users', activeUserId, 'dailyLogs'),
                where('data', '==', todayStr)
            );

            // 4. Ouve em tempo real as mudanças no painel principal
            return onSnapshot(logsQuery, (snapshot) => {
                let waterMl = 0;

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    // Soma apenas se for do tipo 'agua' e status 'concluido'
                    if (data.tipo === 'agua' && data.status === 'concluido') {
                        waterMl += data.quantidadeMl || 250;
                    }
                });

                setWaterTotal(waterMl);
            }, (error) => {
                console.warn('Erro ao carregar dailyLogs de água no painel:', error);
                setWaterTotal(0);
            });

        } catch (error: any) {
            console.warn('Erro ao buscar dados de hidratação no painel:', error.message);
            setWaterTotal(0);
        }
    };

    const waterDisplay = waterTotal >= 1000
        ? `${(waterTotal / 1000).toFixed(1)}L`
        : `${waterTotal}ml`;

    const waterPercentage = Math.min(100, Math.round((waterTotal / waterGoal) * 100));

    // LÓGICA DE CHAMAR AJUDA / EMERGÊNCIA (TRANSIÇÃO INSTANTÂNEA)
    const handleTriggerEmergencyHelp = () => {
        // 1. Feedback tátil imediato
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        // 2. Transição VISUAL IMEDIATA para a tela de emergência (Sem delay)
        (navigation.navigate as any)('EmergencyCallView', { targetUserId: activeUserId });

        // 3. Processamento de GPS e Firestore rodando em SEGUNDO PLANO (sem dar await na UI)
        (async () => {
            try {
                // Solicita permissão do GPS
                const { status } = await Location.requestForegroundPermissionsAsync();

                if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced, // Balanced é muito mais rápido que High e consome menos recurso
                    });

                    if (activeUserId) {
                        // Atualiza as coordenadas no Firestore
                        await updateDoc(doc(db, 'users', activeUserId), {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            lastLocationUpdate: new Date().toISOString(),
                        });

                        // Registra o evento de emergência no diário
                        await addDoc(collection(db, 'users', activeUserId, 'dailyLogs'), {
                            tipo: 'emergencia',
                            titulo: 'PEDIDO DE SOCORRO / EMERGÊNCIA',
                            descricao: 'O botão de emergência foi acionado.',
                            horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                            data: new Date().toISOString().split('T')[0],
                            timestamp: serverTimestamp(),
                            status: 'atrasado',
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        });
                    }
                } else {
                    console.warn('Permissão de GPS negada pelo usuário.');
                }
            } catch (error) {
                console.error('Erro no processamento em segundo plano do GPS:', error);
            }
        })();
    };

    const ACTION_ROUTE_MAP: Record<string, string> = {
        reminder: 'RemindersMenu',
        note: 'NotesMenu',
        emergency: 'EmergencyCallView',
        water: 'WaterTrackingView',
    };

    const handleActionPress = (action: ActionRouteConfig) => {
        if (action.viewKey === 'emergency') {
            handleTriggerEmergencyHelp();
            return;
        }

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

    // Confirmação com animação Checkmark + Scale Up
    const handleConfirmYesWithAnimation = async () => {
        if (!currentSelectedReminder || !activeUserId || isConfirmingAnim) return;

        setIsConfirmingAnim(true);
        checkScaleAnim.setValue(0);

        // Dispara o efeito de escala e pulso (Scale Up) no ícone de check
        Animated.sequence([
            Animated.spring(checkScaleAnim, {
                toValue: 1.3,
                friction: 4,
                tension: 120,
                useNativeDriver: true,
            }),
            Animated.timing(checkScaleAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(async () => {
            // Executa a confirmação no banco de dados e limpa a fila
            await handleConfirmYes();
            setIsConfirmingAnim(false);
        });
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

    const getReminderQuestion = (reminder: FirestoreReminder) => {
        const payload = reminder.dadosFormulario || {};
        const category = reminder.categoria || reminder.type || payload.categoria || payload.tipo || '';

        if (category === 'Medicação' || payload.nomeRemedio) {
            return 'Você já tomou essa medicação?';
        } else if (category === 'Consulta' || payload.especialidade || payload.medico) {
            return 'Tudo certo para ir à esta consulta hoje?';
        } else if (category === 'Exame' || payload.tipoExame) {
            return 'Tudo certo para realizar esse exame hoje?';
        }
        return 'Você já concluiu este lembrete?';
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
                            const details = getReminderDetails(reminder);

                            return (
                                <AnimatedReminderCard
                                    key={reminder.id}
                                    reminder={reminder}
                                    fontScale={fontScale}
                                    theme={theme}
                                    isHighContrast={isHighContrast}
                                    onPress={() => handleReminderPress(reminder)}
                                    renderIcon={renderNotificationIcon}
                                    details={details}
                                />
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

            {/* MODAL DE NOTIFICAÇÃO COMPONENTIZADO VIA CHILDREN */}
            {currentSelectedReminder && (
                <CustomNotificationModal
                    visible={modalVisible}
                    title={currentSelectedReminder.title}
                    subtitle={currentSelectedReminder.subtitle}
                    iconName={currentSelectedReminder.iconName || 'bell-outline'}
                    iconFamily={currentSelectedReminder.iconFamily as any}
                    iconColor={isHighContrast ? theme.buttonText : '#FFFFFF'}
                    iconBackgroundColor={isHighContrast ? theme.buttonPrimary : themes.colors.secureGreen || '#198754'}
                    pulseIcon={true}
                    queueCount={reminderQueue.length}
                    hideDefaultButtons={true}
                    onClose={handleCloseModal}
                >
                    <View style={modalChildrenStyles.container}>
                        <Text style={[
                            modalChildrenStyles.questionText,
                            { fontSize: 19 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>
                            {getReminderQuestion(currentSelectedReminder)}
                        </Text>

                        <View style={modalChildrenStyles.buttonGroup}>
                            {/* BOTÃO SIM COM EFEITO CHECKMARK + SCALE UP */}
                            <TouchableOpacity
                                style={[
                                    modalChildrenStyles.btnYes,
                                    isHighContrast && { backgroundColor: theme.buttonPrimary }
                                ]}
                                onPress={handleConfirmYesWithAnimation}
                                activeOpacity={0.8}
                                disabled={isConfirmingAnim}
                            >
                                <Animated.View style={{ transform: [{ scale: isConfirmingAnim ? checkScaleAnim : 1 }] }}>
                                    <MaterialCommunityIcons
                                        name={isConfirmingAnim ? "check-bold" : "check-circle"}
                                        size={24}
                                        color={isHighContrast ? theme.buttonText : "#FFFFFF"}
                                    />
                                </Animated.View>

                                <Text style={[
                                    modalChildrenStyles.btnYesText,
                                    { fontSize: 18 * fontScale },
                                    isHighContrast && { color: theme.buttonText }
                                ]}>
                                    {isConfirmingAnim ? 'CONCLUÍDO!' : 'SIM'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    modalChildrenStyles.btnNo,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                                ]}
                                onPress={handleSnoozeNo}
                                activeOpacity={0.8}
                                disabled={isConfirmingAnim}
                            >
                                <MaterialCommunityIcons name="clock-fast" size={22} color={isHighContrast ? theme.textPrimary : "#334155"} />
                                <Text style={[
                                    modalChildrenStyles.btnNoText,
                                    { fontSize: 15 * fontScale },
                                    isHighContrast && { color: theme.textPrimary }
                                ]}>NÃO (Adiar 5 min)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={modalChildrenStyles.btnClose}
                                onPress={handleCloseModal}
                                activeOpacity={0.7}
                                disabled={isConfirmingAnim}
                            >
                                <MaterialCommunityIcons name="close-circle-outline" size={20} color={isHighContrast ? theme.textSecondary : "#64748B"} />
                                <Text style={[
                                    modalChildrenStyles.btnCloseText,
                                    { fontSize: 14 * fontScale },
                                    isHighContrast && { color: theme.textSecondary }
                                ]}>FECHAR (Manter pendente)</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </CustomNotificationModal>
            )}

            <IncomingCallListener />
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// ESTILOS LOCAIS
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

const modalChildrenStyles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        marginTop: 4,
    },
    questionText: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#B91C1C',
        textAlign: 'center',
        marginBottom: 20,
    },
    buttonGroup: {
        width: '100%',
        gap: 10,
    },
    btnYes: {
        flexDirection: 'row',
        backgroundColor: '#198754',
        paddingVertical: 14,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        elevation: 2,
    },
    btnYesText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    btnNo: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        paddingVertical: 12,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    btnNoText: {
        color: '#334155',
        fontSize: 15,
        fontWeight: 'bold',
    },
    btnClose: {
        flexDirection: 'row',
        paddingVertical: 8,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    btnCloseText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '700',
    },
});