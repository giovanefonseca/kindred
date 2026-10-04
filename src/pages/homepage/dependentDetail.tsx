import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Linking,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { themes } from '../../global/themes';

// Componente Auxiliar de Notificação Modal
import { CustomNotificationModal } from '../../components/CustomNotificationModal/CustomNotificationModal';

// Firebase
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

interface RouteParams {
    dependentUid: string;
    dependentName: string;
    dependentPhoto?: string | null;
}

interface ActivityLog {
    id: string;
    tipo: 'remedio' | 'agua' | 'recado' | 'emergencia';
    titulo: string;
    descricao: string;
    horario: string;
    status: 'concluido' | 'pendente' | 'atrasado';
}

interface ReminderItem {
    id: string;
    title: string;
    subtitle: string;
    categoryKey?: string;
    iconFamily?: string;
    iconName?: string;
    dataAgendamento?: string | null;
}

export default function DependentDetail() {
    const route = useRoute();
    const navigation = useNavigation<any>();
    const { dependentUid, dependentName, dependentPhoto } = route.params as RouteParams;

    const accessibility = useAccessibility();
    const fontScale = accessibility?.fontScale ?? 1;
    const isHighContrast = accessibility?.isHighContrast ?? false;
    const theme = accessibility?.theme ?? {
        background: '#FFFFFF',
        cardBackground: '#FFFFFF',
        border: '#CBD5E1',
        textPrimary: '#1A1A1A',
        textSecondary: '#666666',
        buttonPrimary: '#FFEA00',
        buttonText: '#000000',
    };

    const [loading, setLoading] = useState(true);
    const [dependentData, setDependentData] = useState<any>(null);
    const [todayLogs, setTodayLogs] = useState<ActivityLog[]>([]);
    const [upcomingReminders, setUpcomingReminders] = useState<ReminderItem[]>([]);
    const [waterProgress, setWaterProgress] = useState({ atual: 0, meta: 2000 });

    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
    const [feedbackModalData, setFeedbackModalData] = useState<{
        title: string;
        message: string;
        type: 'success' | 'error';
    }>({ title: '', message: '', type: 'success' });

    const [confirmEmergencyModalVisible, setConfirmEmergencyModalVisible] = useState(false);

    const showFeedback = (title: string, message: string, type: 'success' | 'error' = 'success') => {
        Haptics.notificationAsync(
            type === 'success' 
                ? Haptics.NotificationFeedbackType.Success 
                : Haptics.NotificationFeedbackType.Error
        );
        setFeedbackModalData({ title, message, type });
        setFeedbackModalVisible(true);
    };

    useEffect(() => {
        if (!dependentUid) return;

        // 1. Listener do perfil do dependente
        const userUnsub = onSnapshot(doc(db, 'users', dependentUid), (docSnap) => {
            if (docSnap.exists()) {
                setDependentData(docSnap.data());
            }
            setLoading(false);
        }, (error) => {
            console.error("Erro ao carregar dados do usuário:", error);
            setLoading(false);
        });

        // 2. Data de hoje formatada no fuso do dispositivo
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // 3. Listener do DailyLogs de Hoje
        const logsQuery = query(
            collection(db, 'users', dependentUid, 'dailyLogs'),
            where('data', '==', todayStr),
            orderBy('timestamp', 'desc')
        );

        const logsUnsub = onSnapshot(logsQuery, (snapshot) => {
            const logs: ActivityLog[] = [];
            let waterMl = 0;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();

                if (data.status === 'concluido' || data.tipo === 'recado') {
                    logs.push({
                        id: docSnap.id,
                        tipo: data.tipo,
                        titulo: data.titulo,
                        descricao: data.descricao,
                        horario: data.horario,
                        status: data.status || 'concluido',
                    });

                    if (data.tipo === 'agua' && data.status === 'concluido') {
                        waterMl += data.quantidadeMl || 250;
                    }
                }
            });

            setTodayLogs(logs);
            setWaterProgress((prev) => ({ ...prev, atual: waterMl }));
        }, (err) => {
            console.error("Erro ao carregar dailyLogs do dependente:", err);
        });

        // 4. Listener dos Lembretes Agendados do Dependente
        const remindersQuery = query(
            collection(db, 'users', dependentUid, 'reminders'),
            orderBy('dataAgendamento', 'asc')
        );

        const remindersUnsub = onSnapshot(remindersQuery, (snapshot) => {
            const list: ReminderItem[] = [];
            snapshot.forEach((docSnap) => {
                list.push({
                    id: docSnap.id,
                    ...docSnap.data()
                } as ReminderItem);
            });
            setUpcomingReminders(list.slice(0, 5));
        }, (err) => {
            console.error("Erro ao carregar lembretes do dependente:", err);
        });

        return () => {
            userUnsub();
            logsUnsub();
            remindersUnsub();
        };
    }, [dependentUid]);

    const handleCallDependent = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const phone = dependentData?.telefone;
        if (phone) {
            const cleanedPhone = phone.replace(/[^\d+]/g, '');
            Linking.openURL(`tel:${cleanedPhone}`);
        } else {
            showFeedback('TELEFONE NÃO CADASTRADO', `O dependente ${dependentName} ainda não registrou um número de telefone no perfil.`, 'error');
        }
    };

    const handleConfirmEmergencyCall = () => {
        setConfirmEmergencyModalVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        // Procura contacto de emergência registado ou recorre ao 192 por omissão
        const rawEmergencyPhone = dependentData?.contatoEmergencia 
            || dependentData?.telefoneEmergencia 
            || '192';

        const cleanedPhone = rawEmergencyPhone.replace(/[^\d+]/g, '');

        if (cleanedPhone) {
            Linking.openURL(`tel:${cleanedPhone}`).catch((err) => {
                console.error("Erro ao abrir marcador de chamadas:", err);
                showFeedback(
                    'ERRO AO LIGAR',
                    'Não foi possível abrir a aplicação de chamadas no seu dispositivo.',
                    'error'
                );
            });
        } else {
            showFeedback(
                'NÚMERO INVÁLIDO',
                'O número de emergência registado é inválido.',
                'error'
            );
        }
    };

    const handleOpenLocation = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const lat = dependentData?.latitude;
        const lng = dependentData?.longitude;
        const endereco = dependentData?.endereco;

        if (lat && lng) {
            const latLng = `${lat},${lng}`;
            const label = encodeURIComponent(`Localização de ${dependentName}`);

            const url = Platform.select({
                ios: `maps:0,0?q=${label}@${latLng}`,
                android: `geo:0,0?q=${latLng}(${label})`
            });

            if (url) {
                Linking.openURL(url).catch(() => {
                    // Fallback para mapa web caso falhe o app nativo
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
                });
            }
        } else if (endereco) {
            const queryAddr = encodeURIComponent(endereco);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${queryAddr}`);
        } else {
            showFeedback(
                'LOCALIZAÇÃO INDISPONÍVEL',
                `O dependente ${dependentName} ainda não possui coordenadas GPS ou endereço cadastrados no perfil.`,
                'error'
            );
        }
    };

    const getStatusBadge = (status: ActivityLog['status']) => {
        switch (status) {
            case 'concluido':
                return { label: 'Concluído', color: '#22C55E', icon: 'check-circle' };
            case 'atrasado':
                return { label: 'Atrasado', color: '#EF4444', icon: 'alert-circle' };
            default:
                return { label: 'Pendente', color: '#F59E0B', icon: 'clock-outline' };
        }
    };

    const getLogIconConfig = (tipo: ActivityLog['tipo']) => {
        switch (tipo) {
            case 'remedio':
                return { name: 'pill', color: isHighContrast ? theme.textPrimary : '#10B981' };
            case 'agua':
                return { name: 'cup-water', color: isHighContrast ? theme.textPrimary : '#0284C7' };
            case 'recado':
                return { name: 'notebook', color: isHighContrast ? theme.textPrimary : (themes.colors.orange || '#F59E0B') };
            default:
                return { name: 'bell-outline', color: isHighContrast ? theme.textPrimary : '#6B7280' };
        }
    };

    const renderReminderIcon = (reminder: ReminderItem) => {
        const family = reminder.iconFamily || 'MaterialCommunityIcons';
        const name = reminder.iconName || 'bell-outline';
        const iconColor = isHighContrast ? theme.textPrimary : theme.buttonPrimary;

        if (family === 'FontAwesome5') {
            return <FontAwesome5 name={name as any} size={18} color={iconColor} />;
        }
        return <MaterialCommunityIcons name={name as any} size={20} color={iconColor} />;
    };

    // CORES DINÂMICAS FIÉIS AO ACCESSIBILITY CONTEXT
    const getCardStyle = (defaultBgColor: string) => {
        if (isHighContrast) {
            return {
                backgroundColor: theme.buttonPrimary,
                borderColor: theme.border || '#000000',
            };
        }
        return {
            backgroundColor: defaultBgColor,
            borderColor: 'transparent',
        };
    };

    const getCardContentColor = () => {
        return isHighContrast ? (theme.buttonText || '#000000') : '#FFFFFF';
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.buttonPrimary} />
                <Text style={[styles.loadingText, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>
                    Carregando dados de {dependentName}...
                </Text>
            </SafeAreaView>
        );
    }

    const waterPercentage = Math.min(100, Math.round((waterProgress.atual / waterProgress.meta) * 100));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            {/* HEADER NAVEGAÇÃO */}
            <View style={[styles.header, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <TouchableOpacity 
                    style={[styles.backButton, { backgroundColor: theme.background }]} 
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar para a tela anterior"
                >
                    <MaterialCommunityIcons name="arrow-left" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: 18 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                    Painel do Dependente
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* CARD PERFIL */}
                <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    {dependentPhoto ? (
                        <Image source={{ uri: dependentPhoto }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.background }]}>
                            <MaterialCommunityIcons name="account-heart" size={36} color={isHighContrast ? theme.textPrimary : theme.buttonPrimary} />
                        </View>
                    )}
                    <View style={styles.profileInfo}>
                        <Text style={[styles.dependentName, { fontSize: 20 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                            {dependentName}
                        </Text>
                        <TouchableOpacity onPress={handleCallDependent} style={styles.phoneRow} activeOpacity={0.7}>
                            <MaterialCommunityIcons name="phone" size={16} color={isHighContrast ? theme.textPrimary : theme.buttonPrimary} />
                            <Text style={[styles.statusText, { fontSize: 13 * fontScale, color: theme.textSecondary }]} numberOfLines={1}>
                                {dependentData?.telefone || 'Ligar para ele(a)'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* TÍTULO AÇÕES RÁPIDAS */}
                <Text style={[styles.feedSectionTitle, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>
                    AÇÕES RÁPIDAS
                </Text>

                {/* GRID 2x2 COM CORES FORTES E ÍCONES GRANDES */}
                <View style={styles.homepageGrid}>
                    {/* 1. CHAMAR AJUDA / EMERGÊNCIA */}
                    <TouchableOpacity
                        style={[styles.solidCard, getCardStyle('#B91C1C')]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setConfirmEmergencyModalVisible(true);
                        }}
                        activeOpacity={0.88}
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons name="alert" size={54} color={getCardContentColor()} />
                        <Text style={[styles.solidCardText, { fontSize: 16 * fontScale, color: getCardContentColor() }]}>
                            CHAMAR{'\n'}AJUDA
                        </Text>
                    </TouchableOpacity>

                    {/* 2. SUAS ANOTAÇÕES */}
                    <TouchableOpacity
                        style={[styles.solidCard, getCardStyle('#F59E0B')]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('ViewNotes', { targetUserId: dependentUid });
                        }}
                        activeOpacity={0.88}
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons name="pencil" size={54} color={getCardContentColor()} />
                        <Text style={[styles.solidCardText, { fontSize: 16 * fontScale, color: getCardContentColor() }]}>
                            SUAS{'\n'}ANOTAÇÕES
                        </Text>
                    </TouchableOpacity>

                    {/* 3. SEUS LEMBRETES */}
                    <TouchableOpacity
                        style={[styles.solidCard, getCardStyle('#15803D')]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('ViewReminders', { targetUserId: dependentUid });
                        }}
                        activeOpacity={0.88}
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons name="calendar-alert" size={54} color={getCardContentColor()} />
                        <Text style={[styles.solidCardText, { fontSize: 16 * fontScale, color: getCardContentColor() }]}>
                            SEUS{'\n'}LEMBRETES
                        </Text>
                    </TouchableOpacity>

                    {/* 4. LOCALIZAÇÃO - #0D9488 */}
                    <TouchableOpacity
                        style={[styles.solidCard, getCardStyle('#287AB8')]}
                        onPress={handleOpenLocation}
                        activeOpacity={0.88}
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons name="map-marker-radius" size={54} color={getCardContentColor()} />
                        <Text style={[styles.solidCardText, { fontSize: 16 * fontScale, color: getCardContentColor() }]}>
                            VER{'\n'}LOCALIZAÇÃO
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* TÍTULO CONTROLE DA ROTINA */}
                <Text style={[styles.feedSectionTitle, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>
                    CONTROLE DA ROTINA
                </Text>

                {/* PRÓXIMOS LEMBRETES AGENDADOS */}
                <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="clock-fast" size={22} color={isHighContrast ? theme.textPrimary : theme.buttonPrimary} />
                        <Text style={[styles.sectionTitle, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>
                            PRÓXIMOS LEMBRETES
                        </Text>
                    </View>

                    {upcomingReminders.length === 0 ? (
                        <Text style={[styles.emptySectionText, { fontSize: 13 * fontScale, color: theme.textSecondary }]}>
                            Nenhum lembrete futuro agendado para este dependente.
                        </Text>
                    ) : (
                        upcomingReminders.map((rem) => {
                            const dateStr = rem.dataAgendamento 
                                ? new Date(rem.dataAgendamento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                : '--:--';

                            return (
                                <View key={rem.id} style={[styles.reminderItemRow, { borderColor: theme.border }]}>
                                    <View style={styles.reminderItemIcon}>
                                        {renderReminderIcon(rem)}
                                    </View>
                                    <View style={styles.reminderItemInfo}>
                                        <Text style={[styles.reminderItemTitle, { fontSize: 14 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                                            {rem.title} - {rem.subtitle}
                                        </Text>
                                        <Text style={[styles.reminderItemDate, { fontSize: 12 * fontScale, color: theme.textSecondary }]}>
                                            {dateStr}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* HIDRATAÇÃO HOJE */}
                <TouchableOpacity
                    style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('WaterTrackingView', { targetUserId: dependentUid });
                    }}
                    activeOpacity={0.85}
                >
                    <View style={styles.sectionHeaderBetween}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="water" size={24} color={isHighContrast ? theme.textPrimary : "#0052cc"} />
                            <Text style={[styles.sectionTitle, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>
                                HIDRATAÇÃO HOJE
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
                    </View>

                    <View style={styles.progressRow}>
                        <Text style={[styles.progressText, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>
                            {waterProgress.atual}ml de {waterProgress.meta}ml ({waterPercentage}%)
                        </Text>
                    </View>

                    <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
                        <View style={[styles.progressBarFill, { width: `${waterPercentage}%`, backgroundColor: isHighContrast ? theme.buttonPrimary : '#0052cc' }]} />
                    </View>
                </TouchableOpacity>

                {/* FEED DE ROTINA DO DIA */}
                <View style={styles.feedSection}>
                    <Text style={[styles.feedSectionTitle, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>
                        HISTÓRICO DA ROTINA DE HOJE
                    </Text>

                    {todayLogs.length === 0 ? (
                        <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <MaterialCommunityIcons name="check-all" size={32} color={theme.textSecondary} />
                            <Text style={[styles.emptyText, { fontSize: 14 * fontScale, color: theme.textSecondary }]}>
                                Nenhuma atividade registrada até o momento para hoje.
                            </Text>
                        </View>
                    ) : (
                        todayLogs.map((item, index) => {
                            const badge = getStatusBadge(item.status);
                            const iconConfig = getLogIconConfig(item.tipo);

                            return (
                                <View 
                                    key={item.id || `log-${index}`} 
                                    style={[
                                        styles.logCard, 
                                        { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                    ]}
                                >
                                    <View style={styles.logHeader}>
                                        <View style={styles.logTypeGroup}>
                                            <MaterialCommunityIcons 
                                                name={iconConfig.name as any} 
                                                size={22} 
                                                color={iconConfig.color} 
                                            />
                                            <Text style={[styles.logTitle, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>
                                                {item.titulo}
                                            </Text>
                                        </View>
                                        <Text style={[styles.logTime, { fontSize: 13 * fontScale, color: theme.textSecondary }]}>
                                            {item.horario}
                                        </Text>
                                    </View>

                                    {item.descricao ? (
                                        <Text style={[styles.logDesc, { fontSize: 13 * fontScale, color: theme.textSecondary }]}>
                                            {item.descricao}
                                        </Text>
                                    ) : null}

                                    <View style={[styles.badge, { backgroundColor: `${badge.color}20` }]}>
                                        <MaterialCommunityIcons name={badge.icon as any} size={16} color={badge.color} />
                                        <Text style={[styles.badgeText, { color: badge.color, fontSize: 12 * fontScale }]}>
                                            {badge.label}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

            </ScrollView>

            {/* CONFIRMAÇÃO DE LIGAÇÃO DE EMERGÊNCIA */}
            <CustomNotificationModal
                visible={confirmEmergencyModalVisible}
                title="LIGAR EMERGÊNCIA"
                subtitle={`Deseja ligar diretamente para os contatos de emergência/urgência de ${dependentName}?`}
                iconName="alert-circle-outline"
                iconColor="#EF4444"
                hideDefaultButtons={true}
                onClose={() => setConfirmEmergencyModalVisible(false)}
            >
                <View style={styles.modalActionButtonsGroup}>
                    <TouchableOpacity
                        style={[styles.modalCancelButton, { borderColor: theme.border }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setConfirmEmergencyModalVisible(false);
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.modalCancelButtonText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>
                            CANCELAR
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.modalEmergencyConfirmButton}
                        onPress={handleConfirmEmergencyCall}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.modalEmergencyConfirmText, { fontSize: 15 * fontScale }]}>
                            SIM, LIGAR
                        </Text>
                    </TouchableOpacity>
                </View>
            </CustomNotificationModal>

            {/* FEEDBACKS GERAIS */}
            <CustomNotificationModal
                visible={feedbackModalVisible}
                title={feedbackModalData.title}
                subtitle={feedbackModalData.message}
                iconName={feedbackModalData.type === 'success' ? "check-bold" : "alert-circle-outline"}
                iconColor={feedbackModalData.type === 'success' ? '#22C55E' : '#EF4444'}
                closeText="ENTENDIDO"
                closeButtonColor={feedbackModalData.type === 'success' ? theme.buttonPrimary : '#EF4444'}
                onClose={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFeedbackModalVisible(false);
                }}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontWeight: 'bold',
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        gap: 14,
        marginBottom: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInfo: {
        flex: 1,
    },
    dependentName: {
        fontWeight: 'bold',
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    statusText: {
        fontWeight: '500',
    },
    homepageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
    },
    solidCard: {
        width: '48%',
        aspectRatio: 1,
        borderRadius: 24,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
    },
    solidCardText: {
        fontWeight: '900',
        textAlign: 'center',
        marginTop: 10,
        letterSpacing: 0.5,
        lineHeight: 20,
    },
    sectionCard: {
        width: '100%',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        marginBottom: 18,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionHeaderBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    emptySectionText: {
        fontStyle: 'italic',
        marginTop: 8,
    },
    reminderItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        gap: 10,
    },
    reminderItemIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reminderItemInfo: {
        flex: 1,
    },
    reminderItemTitle: {
        fontWeight: 'bold',
    },
    reminderItemDate: {
        marginTop: 2,
    },
    progressRow: {
        marginBottom: 8,
    },
    progressText: {
        fontWeight: '600',
    },
    progressBarBackground: {
        height: 12,
        width: '100%',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 6,
    },
    feedSection: {
        width: '100%',
    },
    feedSectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
        marginLeft: 4,
    },
    emptyCard: {
        padding: 20,
        borderRadius: 18,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyText: {
        textAlign: 'center',
    },
    logCard: {
        padding: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 10,
    },
    logHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    logTypeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    logTitle: {
        fontWeight: 'bold',
        flex: 1,
    },
    logTime: {
        fontWeight: '500',
    },
    logDesc: {
        marginBottom: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        gap: 4,
    },
    badgeText: {
        fontWeight: 'bold',
    },
    modalActionButtonsGroup: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    modalCancelButtonText: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalEmergencyConfirmButton: {
        flex: 1,
        backgroundColor: '#EF4444',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalEmergencyConfirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});