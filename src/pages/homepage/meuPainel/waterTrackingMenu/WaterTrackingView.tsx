import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Animated,
    Easing,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { themes } from '../../../../global/themes';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

// Componente Modal Adaptável
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Serviço de Notificações
import { NotificationService } from '../../../../services/NotificationService';

// Serviço de Logs Diários
import { DailyLogService } from '../../../../services/DailyLogService';

// Importações do Firebase
import { 
    doc, 
    getDoc, 
    setDoc, 
    increment, 
    onSnapshot, 
    collection, 
    query,
    where,
    getDocs,
    deleteDoc 
} from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

const GOAL_OPTIONS = [1500, 2000, 2500, 3000];
const REMINDER_OPTIONS = [
    { label: 'Desativado', value: 0 },
    { label: 'A cada 1 hora', value: 1 },
    { label: 'A cada 2 horas', value: 2 },
    { label: 'A cada 3 horas', value: 3 },
    { label: 'A cada 4 horas', value: 4 },
];
const CUP_BASE_ML = 250;
const MAX_DAILY_GOAL_CHANGES = 2; // Limite de 2 alterações de meta por dia

interface FlipCounterProps {
    value: number;
    textStyle: any;
}

function FlipCounter({ value, textStyle }: FlipCounterProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (value !== displayValue) {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: -20,
                    duration: 150,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 150,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setDisplayValue(value);
                translateY.setValue(20);

                Animated.parallel([
                    Animated.spring(translateY, {
                        toValue: 0,
                        friction: 6,
                        tension: 100,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 180,
                        useNativeDriver: true,
                    }),
                ]).start();
            });
        }
    }, [value]);

    return (
        <View style={flipStyles.container}>
            <Animated.Text
                style={[
                    textStyle,
                    {
                        opacity,
                        transform: [{ translateY }],
                    },
                ]}
            >
                {displayValue}
            </Animated.Text>
        </View>
    );
}

const flipStyles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
});

export function WaterTrackingView() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId = route.params?.targetUserId || route.params?.activeUserId || route.params?.userId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

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

    const [goalMl, setGoalMl] = useState<number | null>(null);
    const [reminderInterval, setReminderInterval] = useState<number>(0);
    const [showReminderDropdown, setShowReminderDropdown] = useState<boolean>(false);
    const [consumedMl, setConsumedMl] = useState(0);
    const [goalChangesCount, setGoalChangesCount] = useState(0);
    const [loadingData, setLoadingData] = useState(true);

    const [hydrationModalVisible, setHydrationModalVisible] = useState(false);
    const [goalAchievedModalVisible, setGoalAchievedModalVisible] = useState(false);
    
    // ESTADO PARA MODAL DE CONFIRMAÇÃO DE RESET
    const [confirmResetModalVisible, setConfirmResetModalVisible] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [noticeModalVisible, setNoticeModalVisible] = useState(false);
    const [noticeTitle, setNoticeTitle] = useState('');
    const [noticeMessage, setNoticeMessage] = useState('');
    const [noticeIcon, setNoticeIcon] = useState('alert-circle-outline');
    const [noticeColor, setNoticeColor] = useState(themes.colors.darkRed || '#DC3545');

    const hasShownGoalModalRef = useRef(false);
    const goalDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const effectiveGoal = goalMl ?? 2000;
    const remainingMl = Math.max(0, effectiveGoal - consumedMl);
    const remainingCups = Math.ceil(remainingMl / CUP_BASE_ML);

    const fillAnim = useRef(new Animated.Value(0)).current;
    const fillPercentage = Math.min(100, (consumedMl / effectiveGoal) * 100);

    const showNotice = (title: string, message: string, icon = "alert-circle-outline", color?: string) => {
        setNoticeTitle(title);
        setNoticeMessage(message);
        setNoticeIcon(icon);
        setNoticeColor(color || themes.colors.darkRed || '#DC3545');
        setNoticeModalVisible(true);
    };

    const getTodayDateStr = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTargetHydrationRefs = async () => {
        const todayId = getTodayDateStr();

        if (currentUserUid && selectedUserId !== currentUserUid) {
            try {
                const depDocRef = doc(db, 'users', currentUserUid, 'dependentes', selectedUserId);
                const depSnap = await getDoc(depDocRef);
                
                if (depSnap.exists()) {
                    return {
                        userRef: depDocRef,
                        waterRef: doc(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'hydration', todayId),
                        dailyLogsRef: collection(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'dailyLogs')
                    };
                }
            } catch (e) {
                console.warn('Falha ao tentar acessar subcoleção de dependente:', e);
            }
        }

        return {
            userRef: doc(db, 'users', selectedUserId),
            waterRef: doc(db, 'users', selectedUserId, 'hydration', todayId),
            dailyLogsRef: collection(db, 'users', selectedUserId, 'dailyLogs')
        };
    };

    useEffect(() => {
        if (loadingData) return;

        const timer = setTimeout(() => {
            Animated.timing(fillAnim, {
                toValue: fillPercentage,
                duration: 600,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }).start();
        }, 100);

        return () => clearTimeout(timer);
    }, [fillPercentage, loadingData]);

    const animatedHeight = fillAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

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
                    console.error('Erro ao verificar perfil selecionado:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [selectedUserId, currentUserUid])
    );

    useFocusEffect(
        useCallback(() => {
            if (!selectedUserId) {
                setLoadingData(false);
                return;
            }

            setLoadingData(true);
            let unsubscribeWater: (() => void) | null = null;
            let unsubscribeUser: (() => void) | null = null;

            const setupRealtimeListeners = async () => {
                try {
                    const { userRef, waterRef } = await getTargetHydrationRefs();

                    unsubscribeUser = onSnapshot(userRef, (userSnap) => {
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            const savedGoal = userData?.metaHidratacao;
                            const savedReminder = userData?.lembreteAguaHoras;
                            if (savedGoal) setGoalMl(savedGoal);
                            if (savedReminder !== undefined) setReminderInterval(savedReminder);
                        } else {
                            setGoalMl(2000);
                            setReminderInterval(0);
                        }
                    });

                    unsubscribeWater = onSnapshot(waterRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            const total = data.total || 0;
                            setConsumedMl(total);
                            setGoalChangesCount(data.goalChangesCount || 0);

                            const currentTarget = docSnap.data()?.metaSnapshot || 2000;
                            if (total >= currentTarget && !hasShownGoalModalRef.current) {
                                hasShownGoalModalRef.current = true;
                                setGoalAchievedModalVisible(true);
                            } else if (total < currentTarget) {
                                hasShownGoalModalRef.current = false;
                            }
                        } else {
                            setConsumedMl(0);
                            setGoalChangesCount(0);
                            hasShownGoalModalRef.current = false;
                        }
                        setLoadingData(false);
                    }, (error: any) => {
                        console.error('Erro no listener de hidratação:', error);
                        setLoadingData(false);
                    });

                } catch (error: any) {
                    console.error('Erro ao configurar observadores de tempo real:', error);
                    setLoadingData(false);
                }
            };

            setupRealtimeListeners();

            return () => {
                if (unsubscribeWater) unsubscribeWater();
                if (unsubscribeUser) unsubscribeUser();
                if (goalDebounceTimerRef.current) clearTimeout(goalDebounceTimerRef.current);
            };
        }, [selectedUserId, currentUserUid])
    );

    const handleChangeGoal = (newGoal: number) => {
        if (newGoal === effectiveGoal) return;

        if (goalChangesCount >= MAX_DAILY_GOAL_CHANGES) {
            showNotice(
                'Limite de Alteração',
                `Você já alterou sua meta ${MAX_DAILY_GOAL_CHANGES} vezes hoje. Tente alterar novamente amanhã.`,
                "information-outline",
                "#0284c7"
            );
            return;
        }

        setGoalMl(newGoal);

        if (goalDebounceTimerRef.current) clearTimeout(goalDebounceTimerRef.current);

        goalDebounceTimerRef.current = setTimeout(async () => {
            if (!selectedUserId) return;

            try {
                const nextChangeCount = goalChangesCount + 1;
                setGoalChangesCount(nextChangeCount);

                const { userRef, waterRef } = await getTargetHydrationRefs();

                await setDoc(userRef, {
                    metaHidratacao: newGoal
                }, { merge: true });

                await setDoc(waterRef, {
                    metaSnapshot: newGoal,
                    goalChangesCount: nextChangeCount,
                    ultimaAtualizacao: new Date().toISOString()
                }, { merge: true });

            } catch (error: any) {
                console.error('Erro ao alterar meta:', error);
                if (error?.code === 'resource-exhausted') {
                    showNotice('Limite do Servidor', 'O limite de escritas foi atingido. Tente novamente mais tarde.');
                }
            }
        }, 400);
    };

    const handleChangeReminder = async (hours: number) => {
        setReminderInterval(hours);
        setShowReminderDropdown(false);

        if (!selectedUserId) return;

        try {
            await NotificationService.cancelAll();

            if (hours > 0) {
                await NotificationService.initialize();
                const now = Date.now();
                const intervalMs = hours * 60 * 60 * 1000;
                const maxReminders = Math.floor((22 * 60 * 60 * 1000) / intervalMs);

                for (let i = 1; i <= Math.max(1, maxReminders); i++) {
                    const triggerTime = new Date(now + i * intervalMs);
                    await NotificationService.scheduleReminder(
                        'Hora de se hidratar! 💧',
                        'Beba um copo d\'água para manter sua meta em dia.',
                        triggerTime
                    );
                }
            }

            const { userRef } = await getTargetHydrationRefs();
            await setDoc(userRef, {
                lembreteAguaHoras: hours
            }, { merge: true });

        } catch (error: any) {
            console.error('Erro ao configurar lembrete de água:', error);
            showNotice('Aviso', 'Não foi possível agendar as notificações automáticas no momento.');
        }
    };

    // REFATORADO: Chamada centralizada via DailyLogService.addLog
    const handleAddWaterAmount = (amount: number) => {
        setHydrationModalVisible(false);

        if (!selectedUserId) return showNotice('Erro', 'Usuário não identificado.');

        (async () => {
            try {
                const { waterRef } = await getTargetHydrationRefs();

                // 1. Atualiza o contador diário em 'hydration'
                await setDoc(waterRef, {
                    total: increment(amount),
                    ultimaAtualizacao: new Date().toISOString()
                }, { merge: true });

                // 2. Registra o evento de hidratação no dailyLogs do dependente usando o DailyLogService
                await DailyLogService.addLog({
                    dependentUid: selectedUserId,
                    tipo: 'agua',
                    titulo: 'Ingestão de Água',
                    descricao: `Registro de ${amount}ml de água.`,
                    quantidadeMl: amount,
                    status: 'concluido',
                });

            } catch (error: any) {
                console.error('Erro ao adicionar água:', error);
                if (error?.code === 'resource-exhausted') {
                    showNotice('Limite de Requisições', 'Cota temporariamente excedida. Aguarde um momento.');
                } else {
                    showNotice('Erro ao Salvar', 'Não foi possível registrar a água. Verifique sua conexão.');
                }
            }
        })();
    };

    // Abre o modal de confirmação do Reset
    const handleOpenResetModal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmResetModalVisible(true);
    };

    // Função de exclusão efetiva dos registros e progresso de hoje
    const handleConfirmResetWater = async () => {
        if (!selectedUserId || isResetting) return;

        setIsResetting(true);
        hasShownGoalModalRef.current = false;

        try {
            const { waterRef, dailyLogsRef } = await getTargetHydrationRefs();
            const todayStr = getTodayDateStr();

            // 1. Zera a subcoleção 'hydration'
            await setDoc(waterRef, {
                total: 0,
                ultimaAtualizacao: new Date().toISOString()
            }, { merge: true });

            // 2. Apaga todos os registros de água da subcoleção 'dailyLogs' de hoje
            const logsQuery = query(
                dailyLogsRef,
                where('data', '==', todayStr),
                where('tipo', '==', 'agua')
            );
            const querySnapshot = await getDocs(logsQuery);

            const deletePromises = querySnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setConfirmResetModalVisible(false);
        } catch (error: any) {
            console.error('Erro ao resetar água:', error);
            setConfirmResetModalVisible(false);
            if (error?.code === 'resource-exhausted') {
                showNotice('Limite de Requisições', 'Muitas tentativas simultâneas. Aguarde uns instantes.');
            } else {
                showNotice('Erro ao Resetar', 'Não foi possível zerar o consumo no servidor.');
            }
        } finally {
            setIsResetting(false);
        }
    };

    const getWaterIconColor = () => {
        if (isHighContrast) {
            return fillPercentage > 50 ? "#000000" : theme.buttonPrimary;
        }
        return fillPercentage > 50 ? "#FFFFFF" : "#00B2FF";
    };

    const currentReminderLabel = REMINDER_OPTIONS.find(opt => opt.value === reminderInterval)?.label || 'Desativado';

    return (
        <View style={[styles.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView 
                style={[
                    styles.screen,
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
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        accessibilityLabel="Voltar"
                        activeOpacity={0.7}
                    >
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        styles.headerTitle,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>Hidratação</Text>
                </View>

                {loadingData ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={isHighContrast ? theme.buttonPrimary : themes.colors.primary} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                        {/* BADGE DE PERFIL */}
                        {isResponsavel && targetUserName ? (
                            <View
                                style={[
                                    styles.profileBadge,
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
                                        styles.profileBadgeText,
                                        { fontSize: 14 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                    ]}
                                >
                                    Perfil selecionado:{' '}
                                    <Text style={styles.profileBadgeName}>{targetUserName}</Text>
                                </Text>
                            </View>
                        ) : null}

                        {/* SELETOR DE META DIÁRIA */}
                        <Text style={[
                            styles.metaSelectorLabel,
                            { fontSize: 14 * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>SUA META DIÁRIA ({MAX_DAILY_GOAL_CHANGES - goalChangesCount} alterações restantes):</Text>

                        <View style={styles.goalPillsContainer}>
                            {GOAL_OPTIONS.map((option) => {
                                const isSelected = effectiveGoal === option;
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.goalPill,
                                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                            isSelected && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.goalPillActive)
                                        ]}
                                        onPress={() => handleChangeGoal(option)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[
                                            styles.goalPillText,
                                            { fontSize: 15 * fontScale },
                                            isHighContrast && { color: theme.textPrimary },
                                            isSelected && (isHighContrast ? { color: theme.buttonText } : styles.goalPillTextActive)
                                        ]}>
                                            {option >= 1000 ? `${option / 1000}L` : `${option}ml`}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* SELETOR DE LEMBRETE */}
                        <Text style={[
                            styles.metaSelectorLabel,
                            { fontSize: 14 * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>LEMBRETE DE ÁGUA:</Text>

                        <View style={styles.dropdownWrapper}>
                            <TouchableOpacity
                                style={[
                                    styles.dropdownHeader,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                ]}
                                onPress={() => setShowReminderDropdown(!showReminderDropdown)}
                                activeOpacity={0.85}
                            >
                                <View style={styles.dropdownHeaderContent}>
                                    <MaterialCommunityIcons 
                                        name="bell-ring-outline" 
                                        size={22} 
                                        color={isHighContrast ? theme.buttonPrimary : '#0052cc'} 
                                    />
                                    <Text style={[
                                        styles.dropdownHeaderText,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.textPrimary }
                                    ]}>
                                        {currentReminderLabel}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons 
                                    name={showReminderDropdown ? "chevron-up" : "chevron-down"} 
                                    size={24} 
                                    color={isHighContrast ? theme.textSecondary : '#64748B'} 
                                />
                            </TouchableOpacity>

                            {showReminderDropdown && (
                                <View style={[
                                    styles.dropdownList,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                ]}>
                                    {REMINDER_OPTIONS.map((opt) => {
                                        const isSelected = reminderInterval === opt.value;
                                        return (
                                            <TouchableOpacity
                                                key={opt.value}
                                                style={[
                                                    styles.dropdownItem,
                                                    isSelected && styles.dropdownItemSelected,
                                                    isHighContrast && isSelected && { backgroundColor: theme.buttonPrimary }
                                                ]}
                                                onPress={() => handleChangeReminder(opt.value)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[
                                                    styles.dropdownItemText,
                                                    { fontSize: 15 * fontScale },
                                                    isHighContrast && { color: theme.textPrimary },
                                                    isSelected && (isHighContrast ? { color: theme.buttonText } : styles.dropdownItemTextSelected)
                                                ]}>
                                                    {opt.label}
                                                </Text>
                                                {isSelected && (
                                                    <MaterialCommunityIcons 
                                                        name="check" 
                                                        size={20} 
                                                        color={isHighContrast ? theme.buttonText : '#0052cc'} 
                                                    />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        <Text style={[
                            styles.sectionTitle,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>CONSUMO HOJE:</Text>

                        {/* NÍVEL DE ÁGUA */}
                        <View style={[
                            styles.glassContainer,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                        ]}>
                            <Animated.View style={[
                                styles.waterFill, 
                                { height: animatedHeight },
                                isHighContrast && { backgroundColor: theme.buttonPrimary }
                            ]} />
                            <View style={styles.iconWrapper}>
                                <MaterialCommunityIcons 
                                    name="water" 
                                    size={56} 
                                    color={getWaterIconColor()} 
                                />
                            </View>
                        </View>

                        <Text style={[
                            styles.totalText,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>
                            TOTAL: {consumedMl}ml de {(effectiveGoal / 1000).toFixed(1)}L
                        </Text>

                        {/* BOTÃO REGISTRAR */}
                        <View style={styles.registerPillContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.registerButton,
                                    isHighContrast && { backgroundColor: theme.buttonPrimary }
                                ]}
                                activeOpacity={0.8}
                                onPress={() => setHydrationModalVisible(true)}
                            >
                                <Text style={[
                                    styles.registerButtonText,
                                    { fontSize: 22 * fontScale },
                                    isHighContrast && { color: theme.buttonText }
                                ]}>REGISTRAR +</Text>
                            </TouchableOpacity>
                        </View>

                        {/* CONTADOR DE COPOS */}
                        <View style={styles.metaContainer}>
                            <View style={styles.restamRow}>
                                <Text style={[
                                    styles.restamText,
                                    { fontSize: 18 * fontScale },
                                    isHighContrast && { color: theme.textPrimary }
                                ]}>
                                    RESTAM:{' '}
                                </Text>
                                
                                <FlipCounter 
                                    value={remainingCups} 
                                    textStyle={[
                                        styles.restamText,
                                        { fontSize: 18 * fontScale },
                                        isHighContrast && { color: theme.textPrimary }
                                    ]} 
                                />

                                <Text style={[
                                    styles.restamText,
                                    { fontSize: 18 * fontScale },
                                    isHighContrast && { color: theme.textPrimary }
                                ]}>
                                    {' '}{remainingCups === 1 ? 'copo' : 'copos'} de {CUP_BASE_ML}ml
                                </Text>
                            </View>
                        </View>

                        {/* BOTÃO RESETAR */}
                        <TouchableOpacity
                            style={[
                                styles.resetButton,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                            ]}
                            activeOpacity={0.8}
                            onPress={handleOpenResetModal}
                        >
                            <Text style={[
                                styles.resetButtonText,
                                { fontSize: 20 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>RESETAR</Text>
                        </TouchableOpacity>

                    </ScrollView>
                )}

                {/* MODAL DE CONFIRMAÇÃO DE RESET */}
                <CustomNotificationModal
                    visible={confirmResetModalVisible}
                    title="RESETAR CONSUMO"
                    subtitle="Esta ação fará sumir seu histórico de registros de água do dia de hoje. Tem certeza de que deseja resetar?"
                    iconName="trash-can-outline"
                    iconColor="#DC3545"
                    hideDefaultButtons={true}
                    onClose={() => setConfirmResetModalVisible(false)}
                >
                    <View style={resetModalStyles.actionButtonsGroup}>
                        <TouchableOpacity
                            style={[resetModalStyles.cancelBtn, { borderColor: theme.border }]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setConfirmResetModalVisible(false);
                            }}
                            activeOpacity={0.8}
                            disabled={isResetting}
                        >
                            <Text style={[resetModalStyles.cancelBtnText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>
                                Não, cliquei por engano
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={resetModalStyles.confirmBtn}
                            onPress={handleConfirmResetWater}
                            activeOpacity={0.8}
                            disabled={isResetting}
                        >
                            {isResetting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={[resetModalStyles.confirmBtnText, { fontSize: 15 * fontScale }]}>
                                    Sim! Pode excluir
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </CustomNotificationModal>

                {/* MODAL DE QUANTIDADE */}
                <CustomNotificationModal
                    visible={hydrationModalVisible}
                    title="MINHA HIDRATAÇÃO"
                    subtitle="Quanto você bebeu agora?"
                    iconName="water"
                    iconColor={themes.colors.primary}
                    closeText="FECHAR"
                    closeButtonColor={isHighContrast ? undefined : (themes.colors.lightGray || '#F0F0F0')}
                    onClose={() => setHydrationModalVisible(false)}
                >
                    <View style={hydrationStyles.optionsColumn}>
                        {[250, 500, 1000].map((amount) => (
                            <TouchableOpacity 
                                key={amount}
                                style={[
                                    hydrationStyles.optionButton,
                                    isHighContrast && { backgroundColor: theme.buttonPrimary }
                                ]} 
                                onPress={() => handleAddWaterAmount(amount)}
                                activeOpacity={0.8}
                            >
                                <Text style={[
                                    hydrationStyles.optionText,
                                    { fontSize: 22 * fontScale },
                                    isHighContrast && { color: theme.buttonText }
                                ]}>
                                    + {amount >= 1000 ? '1 LITRO' : `${amount} ML`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </CustomNotificationModal>

                {/* MODAL DE CONQUISTA */}
                <CustomNotificationModal
                    visible={goalAchievedModalVisible}
                    title="PARABÉNS! 🎉"
                    subtitle={`Você atingiu sua meta diária de ${(effectiveGoal / 1000).toFixed(1)}L de água! Continue assim.`}
                    iconName="party-popper"
                    iconColor="#198754"
                    closeText="MUITO BOM!"
                    onClose={() => setGoalAchievedModalVisible(false)}
                />

                {/* MODAL DE AVISO */}
                <CustomNotificationModal
                    visible={noticeModalVisible}
                    title={noticeTitle}
                    subtitle={noticeMessage}
                    iconName={noticeIcon}
                    iconColor={noticeColor}
                    closeText="ENTENDIDO"
                    onClose={() => setNoticeModalVisible(false)}
                />
            </SafeAreaView>

            <SafeAreaView edges={['bottom']} style={isHighContrast && { backgroundColor: theme.background }} />
        </View>
    );
}

const styles = StyleSheet.create({
    mainWrapper: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    screen: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.notBlack,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
        alignItems: 'center',
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
    metaSelectorLabel: { 
        fontSize: 14, 
        fontWeight: 'bold', 
        color: 'gray', 
        marginTop: 10, 
        marginBottom: 8,
        textAlign: 'center'
    },
    goalPillsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    goalPill: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#F0F4FA',
        borderWidth: 1.5,
        borderColor: '#0052cc',
    },
    goalPillActive: {
        backgroundColor: '#0052cc',
    },
    goalPillText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0052cc',
    },
    goalPillTextActive: {
        color: '#FFFFFF',
    },
    dropdownWrapper: {
        width: '100%',
        maxWidth: 320,
        marginBottom: 12,
    },
    dropdownHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F0F4FA',
        borderWidth: 1.5,
        borderColor: '#0052cc',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    dropdownHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dropdownHeaderText: {
        fontWeight: 'bold',
        color: '#0052cc',
    },
    dropdownList: {
        marginTop: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    dropdownItemSelected: {
        backgroundColor: '#E0F2FE',
    },
    dropdownItemText: {
        color: '#334155',
        fontWeight: '600',
    },
    dropdownItemTextSelected: {
        color: '#0052cc',
        fontWeight: 'bold',
    },
    sectionTitle: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: themes.colors.notBlack, 
        marginTop: 16, 
        marginBottom: 8 
    },
    glassContainer: {
        width: 110,
        height: 110,
        borderWidth: 3,
        borderColor: themes.colors.primary || '#000000',
        borderRadius: 24,
        overflow: 'hidden',
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginVertical: 4,
        position: 'relative',
    },
    waterFill: {
        width: '100%',
        backgroundColor: themes.colors.primary || '#0052cc',
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
    },
    iconWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    totalText: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: themes.colors.notBlack, 
        marginVertical: 10,
        textAlign: 'center'
    },
    registerPillContainer: {
        width: '85%',
        marginVertical: 10,
        marginTop: 20,
    },
    registerButton: {
        width: '100%',
        backgroundColor: themes.colors.primary,
        borderRadius: 24,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: themes.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    registerButtonText: { 
        color: '#FFFFFF', 
        fontSize: 22, 
        fontWeight: 'bold', 
        letterSpacing: 0.5 
    },
    resetButton: {
        width: '60%',
        backgroundColor: '#E53935',
        borderRadius: 50,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 8,
    },
    resetButtonText: { 
        color: '#FFFFFF', 
        fontSize: 20, 
        fontWeight: 'bold' 
    },
    metaContainer: { 
        marginTop: 20, 
        alignItems: 'center', 
    },
    restamRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    restamText: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: themes.colors.notBlack,
        textAlign: 'center'
    },
});

const hydrationStyles = StyleSheet.create({
    optionsColumn: {
        width: '100%',
        gap: 12,
        marginBottom: 16,
        alignItems: 'center',
    },
    optionButton: {
        width: '100%',
        backgroundColor: themes.colors.primary,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    optionText: {
        color: themes.colors.secondary || '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
});

const resetModalStyles = StyleSheet.create({
    actionButtonsGroup: {
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        marginTop: 12,
    },
    cancelBtn: {
        width: '100%',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    cancelBtnText: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    confirmBtn: {
        width: '100%',
        backgroundColor: '#DC3545',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});