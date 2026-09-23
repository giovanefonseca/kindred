import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { style } from './styles';
import { themes } from '../../global/themes';
import { getAllActionRoutes, ActionRouteConfig } from '../../config/routesConfig';
import { useAudioPlayer } from 'expo-audio';

// Importações do Firebase
import { collection, getCountFromServer, doc, getDoc, setDoc, increment, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

export interface FirestoreReminder {
    id: string;
    title: string;
    subtitle: string;
    iconFamily?: string;
    iconName?: string;
    dataAgendamento?: string | null;
    dadosFormulario?: Record<string, any>;
    isRead?: boolean;
}

interface ToggleInfo {
    label: string;
    value: boolean;
}

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO DE NOTIFICAÇÃO
// ---------------------------------------------------------------------------
interface CustomNotificationModalProps {
    visible: boolean;
    reminder: FirestoreReminder | null;
    onClose: () => void;
    onDelete: () => void;
}

function CustomNotificationModal({ visible, reminder, onClose, onDelete }: CustomNotificationModalProps) {
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
                            <Text style={modalStyles.closeText}>FECHAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO DE HIDRATAÇÃO
// ---------------------------------------------------------------------------
interface HydrationModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectAmount: (ml: number) => void;
}

function HydrationModal({ visible, onClose, onSelectAmount }: HydrationModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: themes.colors.primary }]}>
                        <MaterialCommunityIcons name="water" size={40} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>MINHA HIDRATAÇÃO</Text>
                    <Text style={[modalStyles.subtitle, { color: themes.colors.primary }]}>Quanto você bebeu agora?</Text>

                    <View style={hydrationStyles.optionsColumn}>
                        <TouchableOpacity 
                            style={hydrationStyles.optionButton} 
                            onPress={() => { onSelectAmount(250); onClose(); }}
                            activeOpacity={0.8}
                        >
                            <Text style={hydrationStyles.optionText}>+ 250 ML</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={hydrationStyles.optionButton} 
                            onPress={() => { onSelectAmount(500); onClose(); }}
                            activeOpacity={0.8}
                        >
                            <Text style={hydrationStyles.optionText}>+ 500 ML</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={hydrationStyles.optionButton} 
                            onPress={() => { onSelectAmount(1000); onClose(); }}
                            activeOpacity={0.8}
                        >
                            <Text style={hydrationStyles.optionText}>+ 1 LITRO</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={hydrationStyles.closeButton} onPress={onClose} activeOpacity={0.8}>
                        <Text style={hydrationStyles.closeText}>FECHAR</Text>
                    </TouchableOpacity>
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
    
    const [reminders, setReminders] = useState<FirestoreReminder[]>([]);
    const [notesCount, setNotesCount] = useState<number | string>('...');
    const [waterTotal, setWaterTotal] = useState<number>(0);

    const [selectedReminder, setSelectedReminder] = useState<FirestoreReminder | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [hydrationModalVisible, setHydrationModalVisible] = useState(false);

    const [now, setNow] = useState(Date.now());
    
    const notifiedIdsRef = useRef<Set<string>>(new Set());

    const getTodayId = () => {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    };

    const player = useAudioPlayer(
        require('../../../assets/notifySound.mp3') 
    );

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
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const remindersRef = collection(db, 'users', userId, 'reminders');
        const q = query(remindersRef, orderBy('criadoEm', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReminders: FirestoreReminder[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as Omit<FirestoreReminder, 'id'>),
            }));
            setReminders(fetchedReminders);
        }, (error) => {
            console.error('Erro ao buscar lembretes do Firestore:', error);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            const currentTime = Date.now();
            setNow(currentTime);

            reminders.forEach((reminder) => {
                if (reminder.dataAgendamento) {
                    const reminderTime = new Date(reminder.dataAgendamento).getTime();

                    if (reminderTime <= currentTime && !notifiedIdsRef.current.has(reminder.id)) {
                        notifiedIdsRef.current.add(reminder.id);
                        setSelectedReminder(reminder);
                        setModalVisible(true);
                        playNotificationSound();
                    }
                }
            });
        }, 3000);

        return () => clearInterval(timer);
    }, [reminders]);

    const visibleReminders = reminders.filter((item) => {
        if (!item.dataAgendamento) return true;
        return new Date(item.dataAgendamento).getTime() <= now;
    });

    const fetchNotesCount = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            const notesRef = collection(db, 'users', userId, 'notes');
            const snapshot = await getCountFromServer(notesRef);
            setNotesCount(snapshot.data().count);
        } catch (error) {
            console.log('Erro ao buscar total de notas:', error);
            setNotesCount(0);
        }
    };

    const fetchTodayWater = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            const docSnap = await getDoc(waterRef);
            
            if (docSnap.exists()) {
                setWaterTotal(docSnap.data().total || 0);
            } else {
                setWaterTotal(0);
            }
        } catch (error) {
            console.log('Erro ao buscar água:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNotesCount();
            fetchTodayWater();
        }, [])
    );

    const handleAddWater = async (amount: number) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return Alert.alert('Erro', 'Usuário não autenticado.');

        try {
            setWaterTotal(prev => prev + amount);

            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            await setDoc(waterRef, {
                total: increment(amount),
                ultimaAtualizacao: new Date().toISOString()
            }, { merge: true });

        } catch (error) {
            console.log('Erro ao salvar água:', error);
            Alert.alert('Erro', 'Não foi possível salvar.');
            fetchTodayWater();
        }
    };

    const waterDisplay = waterTotal >= 1000 
        ? `${(waterTotal / 1000).toFixed(1)}L` 
        : `${waterTotal}ml`;

    const handleActionPress = (action: ActionRouteConfig) => {
        navigation.navigate('DynamicAction', { slug: action.slug });
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
        setSelectedReminder(reminder);
        setModalVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (!selectedReminder) return;

        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            await deleteDoc(doc(db, 'users', userId, 'reminders', selectedReminder.id));
            setModalVisible(false);
            setSelectedReminder(null);
        } catch (error) {
            console.error('Erro ao deletar lembrete:', error);
            Alert.alert('Erro', 'Não foi possível excluir o lembrete.');
        }
    };

    const renderActionIcon = (action: ActionRouteConfig) => {
        if (action.slug === 'definir-lembrete') {
            return (
                <View style={style.calendarIconWrapper}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={50} color="#FFFFFF" />
                    <MaterialCommunityIcons name="bell-outline" size={26} color="#FFFFFF" style={style.bellIconOverlay} />
                </View>
            );
        }
        return (
            <MaterialCommunityIcons name={action.iconName as any} size={54} color="#FFFFFF" />
        );
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

                {/* NOTIFICAÇÕES RECENTES */}
                <View style={style.notificationsSection}>
                    <Text style={style.sectionTitle}>LEMBRETES RECENTES</Text>

                    {visibleReminders.length === 0 ? (
                        <Text style={style.emptyText}>
                            Nenhum lembrete configurado.
                        </Text>
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

                {/* AÇÕES RÁPIDAS */}
                <Text style={style.sectionTitle}>AÇÕES RÁPIDAS</Text>
                <View style={style.gridContainer}>
                    {actions.map((action) => (
                        <TouchableOpacity key={action.id} style={[style.card, { backgroundColor: action.color }]} onPress={() => handleActionPress(action)}>
                            {renderActionIcon(action)}
                            <Text style={style.cardText}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* PAINEL DE RESUMO */}
                <Text style={style.sectionTitle}>MEU PAINEL</Text>
                <View style={style.dashboardGrid}>

                    {/* Bloco 1: Segurança */}
                    <TouchableOpacity 
                        style={style.dashboardCardSecurity}
                        onPress={() => Alert.alert("Em breve", "O painel de segurança será implementado em seguida.")}
                    >
                        <Text style={[style.cardValue, { color: '#ffffff' }]}>OK</Text>
                        <Text style={style.cardLabel}>Segurança</Text>
                    </TouchableOpacity>

                    {/* Bloco 2: Anotações */}
                    <TouchableOpacity 
                        style={style.dashboardCardNote} 
                        onPress={() => navigation.navigate('NotesMenu')}
                    >
                        <Text style={style.cardValue}>{notesCount}</Text>
                        <Text style={style.cardLabel}>Minhas Anotações</Text>
                    </TouchableOpacity>

                    {/* Bloco 3: Lembretes */}
                    <TouchableOpacity 
                        style={style.dashboardCardReminder}
                        onPress={() => navigation.navigate('RemindersMenu')}
                    >
                        <Text style={style.cardValue}>{reminders.length}</Text>
                        <Text style={style.cardLabel}>Lembretes Ativos</Text>
                    </TouchableOpacity>

                    {/* Bloco 4: Hidratação */}
                    <TouchableOpacity 
                        style={style.dashboardCardHidro}
                        onPress={() => setHydrationModalVisible(true)}
                    >
                        <Text style={style.cardValue}>{waterDisplay}</Text>
                        <Text style={style.cardLabel}>Minha Hidratação</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <CustomNotificationModal
                visible={modalVisible}
                reminder={selectedReminder}
                onClose={() => setModalVisible(false)}
                onDelete={handleDeleteSelected}
            />

            <HydrationModal
                visible={hydrationModalVisible}
                onClose={() => setHydrationModalVisible(false)}
                onSelectAmount={handleAddWater}
            />
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DO CARD DE LEMBRETE
// ---------------------------------------------------------------------------
const listStyles = StyleSheet.create({
    reminderCard: { 
        backgroundColor: '#F2F4F3', 
        borderWidth: 1.5, 
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

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DO MODAL DE HIDRATAÇÃO
// ---------------------------------------------------------------------------
const hydrationStyles = StyleSheet.create({
    optionsColumn: {
        width: '100%',
        gap: 12,
        marginBottom: 16,
    },
    optionButton: {
        width: '100%',
        backgroundColor: themes.colors.primary,
        borderWidth: 1.5,
        borderColor: 'transparent',
        borderRadius: 16,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionText: {
        color: themes.colors.secondary,
        fontSize: 24,
        fontWeight: 'bold',
    },
    closeButton: { 
        width: '100%', 
        backgroundColor: '#F0F0F0', 
        borderRadius: 16, 
        paddingVertical: 14, 
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    }, 
    closeText: { 
        color: '#555', 
        fontSize: 18, 
        fontWeight: 'bold' 
    },
});