import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    AppState,
    Animated,
    Easing,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { themes } from '../../../../global/themes';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

// Componente Modal Adaptável
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Importações do Firebase
import { doc, getDoc, setDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

const GOAL_OPTIONS = [1500, 2000, 2500, 3000];
const CUP_BASE_ML = 250;
const MAX_DAILY_GOAL_CHANGES = 2; // Limite de 2 alterações de meta por dia

export function WaterTrackingView() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    // Recupera o ID do usuário/dependente ativo
    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId = route.params?.targetUserId || route.params?.activeUserId || route.params?.userId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

    // Contexto Global de Acessibilidade com fallbacks seguros
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
    const [consumedMl, setConsumedMl] = useState(0);
    const [goalChangesCount, setGoalChangesCount] = useState(0);
    const [loadingData, setLoadingData] = useState(true);

    // Modais
    const [hydrationModalVisible, setHydrationModalVisible] = useState(false);
    const [goalAchievedModalVisible, setGoalAchievedModalVisible] = useState(false);
    
    // Modal de Notificação Dinâmico
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

    /**
     * Função Auxiliar Assíncrona para resolver dinamicamente as referências de escrita e leitura
     */
    const getTargetHydrationRefs = async () => {
        const todayId = getTodayId();

        if (currentUserUid && selectedUserId !== currentUserUid) {
            try {
                const depDocRef = doc(db, 'users', currentUserUid, 'dependentes', selectedUserId);
                const depSnap = await getDoc(depDocRef);
                
                if (depSnap.exists()) {
                    return {
                        userRef: depDocRef,
                        waterRef: doc(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'hydration', todayId)
                    };
                }
            } catch (e) {
                console.warn('Falha ao tentar acessar subcoleção de dependente:', e);
            }
        }

        return {
            userRef: doc(db, 'users', selectedUserId),
            waterRef: doc(db, 'users', selectedUserId, 'hydration', todayId)
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

    const getTodayId = () => {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    };

    // Identificação do perfil selecionado e verificação de dependentes
    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                if (!currentUserUid) return;

                try {
                    // 1. Verifica se o usuário atual é responsável
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents = Array.isArray(currentUserData.dependentes) && currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    // 2. Busca o nome do perfil selecionado
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
                    console.error('Erro ao verificar perfil selecionado no WaterTrackingView:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [selectedUserId, currentUserUid])
    );

    // Escuta dos dados em Tempo Real com onSnapshot
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

                    // Listener em tempo real da meta do usuário
                    unsubscribeUser = onSnapshot(userRef, (userSnap) => {
                        if (userSnap.exists()) {
                            const savedGoal = userSnap.data()?.metaHidratacao;
                            if (savedGoal) setGoalMl(savedGoal);
                        } else {
                            setGoalMl(2000);
                        }
                    });

                    // Listener em tempo real dos registros de hidratação do dia
                    unsubscribeWater = onSnapshot(waterRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            const total = data.total || 0;
                            setConsumedMl(total);
                            setGoalChangesCount(data.goalChangesCount || 0);

                            // Aciona o modal de parabéns caso a meta seja atingida e ainda não tenha sido exibido
                            const currentTargetGoal = goalMl || 2000;
                            if (total >= currentTargetGoal && !hasShownGoalModalRef.current) {
                                hasShownGoalModalRef.current = true;
                                setGoalAchievedModalVisible(true);
                            } else if (total < currentTargetGoal) {
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
        }, [selectedUserId, currentUserUid, goalMl])
    );

    const handleChangeGoal = (newGoal: number) => {
        if (newGoal === effectiveGoal) return;

        if (goalChangesCount >= MAX_DAILY_GOAL_CHANGES) {
            showNotice(
                'Limite de Alteração',
                `Você já alterou sua meta ${MAX_DAILY_GOAL_CHANGES} vezes hoje. Para evitar sobrecarga no sistema, tente alterar novamente amanhã.`,
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
                    goalChangesCount: nextChangeCount,
                    ultimaAtualizacao: new Date().toISOString()
                }, { merge: true });

            } catch (error: any) {
                console.error('Erro ao alterar meta:', error);
                if (error?.code === 'resource-exhausted') {
                    showNotice('Limite do Servidor', 'O limite de escritas do servidor foi atingido. Tente novamente mais tarde.');
                }
            }
        }, 600);
    };

    const handleAddWaterAmount = (amount: number) => {
        setHydrationModalVisible(false);

        if (!selectedUserId) return showNotice('Erro', 'Usuário não identificado.');

        (async () => {
            try {
                const { waterRef } = await getTargetHydrationRefs();

                await setDoc(waterRef, {
                    total: increment(amount),
                    ultimaAtualizacao: new Date().toISOString()
                }, { merge: true });
            } catch (error: any) {
                console.error('Erro ao adicionar água:', error);
                if (error?.code === 'resource-exhausted') {
                    showNotice('Limite de Requisições', 'Cota de gravação no servidor temporariamente excedida. Aguarde um momento.');
                } else {
                    showNotice('Erro ao Salvar', 'Não foi possível registrar a água no servidor. Verifique sua conexão.');
                }
            }
        })();
    };

    const handleResetWater = () => {
        if (!selectedUserId) return;

        hasShownGoalModalRef.current = false;

        (async () => {
            try {
                const { waterRef } = await getTargetHydrationRefs();

                await setDoc(waterRef, {
                    total: 0,
                    ultimaAtualizacao: new Date().toISOString()
                }, { merge: true });
            } catch (error: any) {
                console.error('Erro ao resetar água:', error);
                if (error?.code === 'resource-exhausted') {
                    showNotice('Limite de Requisições', 'Muitas tentativas simultâneas. Aguarde uns instantes.');
                } else {
                    showNotice('Erro ao Resetar', 'Não foi possível zerar seu consumo no servidor.');
                }
            }
        })();
    };

    const getWaterIconColor = () => {
        if (isHighContrast) {
            return fillPercentage > 50 ? "#000000" : theme.buttonPrimary;
        }
        return fillPercentage > 50 ? "#FFFFFF" : "#00B2FF";
    };

    return (
        <View style={[styles.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView 
                style={[
                    styles.screen,
                    isHighContrast && { backgroundColor: theme.background }
                ]} 
                edges={['top', 'left', 'right']}
            >

                {/* CABEÇALHO PADRONIZADO */}
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

                        {/* BADGE VISUAL DE PERFIL SELECIONADO */}
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

                        <Text style={[
                            styles.sectionTitle,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>CONSUMO HOJE:</Text>

                        {/* CONTAINER COM O NÍVEL DE ÁGUA ANIMADO */}
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

                        {/* BOTÃO ÚNICO DE REGISTRAR + */}
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

                        <View style={styles.metaContainer}>
                            <Text style={[
                                styles.restamText,
                                { fontSize: 18 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>
                                RESTAM: {remainingCups} {remainingCups === 1 ? 'copo' : 'copos'} de {CUP_BASE_ML}ml
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.resetButton,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                            ]}
                            activeOpacity={0.8}
                            onPress={handleResetWater}
                        >
                            <Text style={[
                                styles.resetButtonText,
                                { fontSize: 20 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>RESETAR</Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}

                {/* MODAL DE SELEÇÃO DA QUANTIDADE DE ÁGUA */}
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

                {/* MODAL DE META CONCLUÍDA */}
                <CustomNotificationModal
                    visible={goalAchievedModalVisible}
                    title="PARABÉNS! 🎉"
                    subtitle={`Você atingiu sua meta diária de ${(effectiveGoal / 1000).toFixed(1)}L de água! Continue assim.`}
                    iconName="party-popper"
                    iconColor="#198754"
                    closeText="MUITO BOM!"
                    onClose={() => setGoalAchievedModalVisible(false)}
                />

                {/* MODAL DE NOTIFICAÇÃO / ERRO DE QUOTA */}
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

            {/* ESPAÇAMENTO SEGURO DA BARRA NATIVA DO SISTEMA */}
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
        alignSelf: 'center',
        marginBottom: 8,
        gap: 6,
    },
    profileBadgeText: {
        color: '#333333',
        fontWeight: '500',
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
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    goalPill: {
        paddingVertical: 8,
        paddingHorizontal: 16,
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
        borderColor: themes.colors.primary || '#00000',
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
        gap: 4 
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