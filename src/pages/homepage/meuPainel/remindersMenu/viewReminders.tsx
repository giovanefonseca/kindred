import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Firebase
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

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
// PÁGINA PRINCIPAL
// ---------------------------------------------------------------------------
export function ViewReminders() {
    const navigation = useNavigation();
    const [reminders, setReminders] = useState<ReminderItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            setLoading(false);
            return;
        }

        const remindersRef = collection(db, 'users', userId, 'reminders');
        const q = query(remindersRef, orderBy('criadoEm', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
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

        return () => unsubscribe();
    }, []);

    const getReminderDetails = (item: ReminderItem) => {
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

    const renderCategoryIcon = (reminder: ReminderItem) => {
        const color = themes.colors.secureGreen || '#198754';
        const family = reminder.iconFamily || 'MaterialCommunityIcons';
        const name = reminder.iconName || 'bell-outline';

        if (family === 'FontAwesome5') {
            return <FontAwesome5 name={name as any} size={32} color={color} />;
        }
        return <MaterialCommunityIcons name={name as any} size={26} color={color} />;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Feather name="arrow-left" size={32} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.title}>Meus Lembretes</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="large" color={themes.colors.secureGreen || '#198754'} style={{ marginTop: 50 }} />
                ) : reminders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="bell-off-outline" size={60} color="#CCC" />
                        <Text style={styles.emptyStateText}>Nenhum lembrete cadastrado.</Text>
                    </View>
                ) : (
                    reminders.map((reminder) => {
                        const { name, time, date, toggleInfos } = getReminderDetails(reminder);

                        return (
                            <TouchableOpacity
                                key={reminder.id}
                                style={styles.reminderCard}
                                activeOpacity={0.8}
                                onPress={() => handleReminderPress(reminder)}
                            >
                                <View style={styles.mainInfoRow}>
                                    <View style={styles.categoryIconBadge}>
                                        {renderCategoryIcon(reminder)}
                                    </View>
                                    <Text style={styles.reminderTitle} numberOfLines={2}>
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
                                                    color={info.value ? "#198754" : themes.colors.darkRed} 
                                                />
                                                <Text style={styles.toggleText}>
                                                    {info.label}: <Text style={[styles.toggleValueText, { color: info.value ? '#198754' : themes.colors.darkRed }]}>
                                                        {info.value ? 'SIM' : 'NÃO'}
                                                    </Text>
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <View style={styles.divider} />

                                <View style={styles.detailsRow}>
                                    <View style={styles.detailItem}>
                                        <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#666" />
                                        <Text style={styles.detailText}>{date}</Text>
                                    </View>

                                    <View style={styles.detailItem}>
                                        <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
                                        <Text style={styles.detailText}>{time}</Text>
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
    );
}

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DA PÁGINA
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFFFFF' },
    backButton: { marginRight: 15, padding: 4 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 21 },
    reminderCard: { backgroundColor: '#F2F4F3', borderWidth: 1.5, borderColor: themes.colors.secureGreen || '#198754', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
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
    modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 2, borderColor: themes.colors.secureGreen || '#198754', padding: 24, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6 },
    iconCircle: { width: 70, height: 70, borderRadius: 50, backgroundColor: themes.colors.secureGreen, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 18, fontWeight: 'bold', color: themes.colors.secureGreen || '#198754', textAlign: 'center', marginBottom: 24 },
    buttonGroup: { flexDirection: 'row', gap: 12, width: '100%' },
    closeButton: { flex: 1, backgroundColor: themes.colors.secureGreen || '#198754', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    closeText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    deleteButton: { flex: 1, backgroundColor: themes.colors.darkRed, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    deleteText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});