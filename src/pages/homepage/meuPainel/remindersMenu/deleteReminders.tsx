import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';

// Firebase
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';
import { themes } from '../../../../global/themes';

interface Reminder {
    id: string;
    title: string;
    subtitle: string;
    iconFamily?: string;
    iconName?: string;
    dataAgendamento?: string | null;
    dadosFormulario?: Record<string, any>;
    criadoEm?: string;
}

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO DE EXCLUSÃO
// ---------------------------------------------------------------------------
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

    // Retorna no formato "28/09/2026 às 12:20"
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
};

function CustomDeleteModal({ visible, title, subtitle, onClose, onDelete }: CustomDeleteModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={modalStyles.iconCircle}>
                        <Feather name="alert-triangle" size={40} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={modalStyles.subtitle}>{subtitle}</Text>

                    <View style={modalStyles.buttonRow}>
                        <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose} activeOpacity={0.8}>
                            <Text style={modalStyles.cancelText}>CANCELAR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={modalStyles.deleteButtonModal} onPress={onDelete} activeOpacity={0.8}>
                            <Text style={modalStyles.deleteTextModal}>SIM, EXCLUIR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export function DeleteReminders() {
    const navigation = useNavigation();
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [reminderToDelete, setReminderToDelete] = useState<{ id: string; title: string } | null>(null);

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const q = query(
            collection(db, 'users', userId, 'reminders'),
            orderBy('criadoEm', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReminders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Reminder[];

            setReminders(fetchedReminders);
            setLoading(false);
        }, (error) => {
            console.error('Erro ao buscar lembretes:', error);
            Alert.alert('Erro', 'Não foi possível carregar os lembretes.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const confirmDelete = (reminderId: string, reminderTitle: string) => {
        setReminderToDelete({ id: reminderId, title: reminderTitle });
        setModalVisible(true);
    };

    const handleDeleteExecute = async () => {
        if (!reminderToDelete) return;

        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            const reminderRef = doc(db, 'users', userId, 'reminders', reminderToDelete.id);
            await deleteDoc(reminderRef);
            setModalVisible(false);
            setReminderToDelete(null);
        } catch (error) {
            console.error("Erro ao excluir lembrete:", error);
            Alert.alert('Erro', 'Não foi possível excluir o lembrete.');
            setModalVisible(false);
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
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>

            {/* CABEÇALHO */}
            <View style={style.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={style.backButton}>
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={style.title}>EXCLUIR LEMBRETES</Text>
            </View>

            {/* AVISO VISUAL */}
            <View style={style.warningBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#856404" />
                <Text style={style.warningText}>Atenção: Os itens apagados não poderão ser recuperados.</Text>
            </View>

            {/* LISTA DE LEMBRETES PARA EXCLUIR */}
            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="large" color="#d9534f" style={{ marginTop: 50 }} />
                ) : reminders.length === 0 ? (
                    <View style={style.emptyState}>
                        <MaterialCommunityIcons name="bell-off-outline" size={60} color="#CCC" />
                        <Text style={style.emptyStateText}>Sua lista está vazia. Não há lembretes para excluir.</Text>
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
                            <View key={reminder.id} style={style.noteCard}>

                                <View style={style.noteInfo}>
                                    <Text style={style.noteTypeTitle}>{reminder.title || 'LEMBRETE'}</Text>
                                    <Text style={style.noteDate}>{formatDateBr(reminder.dataAgendamento)}</Text>

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

                                                // Se for uma string de data ISO (como 2026-09-28T16:15:00.000Z ou do ISO Date), formata de forma simples
                                                if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('T')) {
                                                    return formatSimpleDate(value);
                                                }

                                                return strValue;
                                            };

                                            return (
                                                <Text key={key} style={style.dataSummary}>
                                                    • {labelFormatado}: <Text style={{ fontWeight: 'bold' }}>{renderValue()}</Text>
                                                </Text>
                                            );
                                        })}
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={style.deleteButton}
                                    activeOpacity={0.7}
                                    onPress={() => confirmDelete(reminder.id, reminder.title || 'Lembrete')}
                                    accessibilityLabel={`Excluir lembrete ${reminder.title}`}
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FFFFFF" />
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
    );
}

// ==========================================
// ESTILOS
// ==========================================
const style = StyleSheet.create({
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
    headerShadow: {
        position: 'absolute',
        bottom: -6,
        left: 0,
        right: 0,
        height: 6,
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

// ---------------------------------------------------------------------------
// ESTILOS DO MODAL CUSTOMIZADO
// ---------------------------------------------------------------------------
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