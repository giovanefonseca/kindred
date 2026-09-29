import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
    AppState,
    Modal,
    Animated,
    Easing,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { themes } from '../../../../global/themes';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// Importações do Firebase
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

const GOAL_OPTIONS = [1500, 2000, 2500, 3000];
const CUP_BASE_ML = 250;

// ---------------------------------------------------------------------------
// MODAL DE CONGRATULAÇÕES (META CONCLUÍDA)
// ---------------------------------------------------------------------------
interface GoalAchievedModalProps {
    visible: boolean;
    goalMl: number;
    onClose: () => void;
}

function GoalAchievedModal({ visible, goalMl, onClose }: GoalAchievedModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#198754' }]}>
                        <MaterialCommunityIcons name="party-popper" size={42} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>PARABÉNS! 🎉</Text>
                    <Text style={modalStyles.subtitle}>
                        Você atingiu sua meta diária de {(goalMl / 1000).toFixed(1)}L de água! Continue assim.
                    </Text>

                    <TouchableOpacity 
                        style={[modalStyles.closeButton, { backgroundColor: '#198754' }]} 
                        onPress={onClose} 
                        activeOpacity={0.8}
                    >
                        <Text style={modalStyles.closeText}>MUITO BOM!</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// MODAL DE SELEÇÃO DE QUANTIDADE (IGUAL À HOMEPAGE)
// ---------------------------------------------------------------------------
interface HydrationModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectAmount: (ml: number) => void;
}

function HydrationSelectionModal({ visible, onClose, onSelectAmount }: HydrationModalProps) {
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
// COMPONENTE PRINCIPAL DE RASTREAMENTO DE ÁGUA
// ---------------------------------------------------------------------------
export function WaterTrackingView() {
    const navigation = useNavigation();

    // goalMl começa null: só passa a existir um valor depois que o Firestore responde,
    // então a tela nunca chega a mostrar 2000 pra depois trocar.
    const [goalMl, setGoalMl] = useState<number | null>(null);
    const [consumedMl, setConsumedMl] = useState(0);
    const [loadingData, setLoadingData] = useState(true);

    const [hydrationModalVisible, setHydrationModalVisible] = useState(false);
    const [goalAchievedModalVisible, setGoalAchievedModalVisible] = useState(false);

    const hasShownGoalModalRef = useRef(false);

    const effectiveGoal = goalMl ?? 2000;
    const remainingMl = Math.max(0, effectiveGoal - consumedMl);
    const remainingCups = Math.ceil(remainingMl / CUP_BASE_ML);

    const fillAnim = useRef(new Animated.Value(0)).current;
    const fillPercentage = Math.min(100, (consumedMl / effectiveGoal) * 100);

    useEffect(() => {
        if (loadingData) return;

        const timer = setTimeout(() => {
            Animated.timing(fillAnim, {
                toValue: fillPercentage,
                duration: 600,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }).start();
        }, 300);

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

    useFocusEffect(
        useCallback(() => {
            const fetchWater = async () => {
                const userId = auth.currentUser?.uid;
                if (!userId) {
                    setLoadingData(false);
                    return;
                }

                try {
                    // Busca a meta salva do usuário PRIMEIRO
                    const userRef = doc(db, 'users', userId);
                    const userSnap = await getDoc(userRef);
                    const savedGoal = userSnap.exists() ? userSnap.data().metaHidratacao : null;
                    const currentGoal = savedGoal || 2000;
                    setGoalMl(currentGoal);

                    // Depois busca o consumo do dia
                    const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
                    const docSnap = await getDoc(waterRef);
                    if (docSnap.exists()) {
                        const total = docSnap.data().total || 0;
                        setConsumedMl(total);
                        if (total >= currentGoal) {
                            hasShownGoalModalRef.current = true;
                        }
                    } else {
                        setConsumedMl(0);
                    }
                } catch (error) {
                    console.log('Erro ao buscar hidratação:', error);
                    setGoalMl((prev) => prev ?? 2000);
                } finally {
                    setLoadingData(false);
                }
            };

            fetchWater();

            const subscription = AppState.addEventListener('change', nextAppState => {
                if (nextAppState === 'active') {
                    fetchWater();
                }
            });

            return () => subscription.remove();
        }, [])
    );

    const handleChangeGoal = async (newGoal: number) => {
        // Atualiza a tela imediatamente (fica "fixo" na escolha do usuário)
        setGoalMl(newGoal);

        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            await setDoc(doc(db, 'users', userId), {
                metaHidratacao: newGoal
            }, { merge: true });
        } catch (error) {
            console.log('Erro ao salvar meta:', error);
            Alert.alert('Erro', 'Não foi possível salvar sua meta. Tente novamente.');
        }
    };

    const handleAddWaterAmount = async (amount: number) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return Alert.alert('Erro', 'Utilizador não autenticado.');

        const newTotal = consumedMl + amount;
        setConsumedMl(newTotal);

        if (newTotal >= effectiveGoal && !hasShownGoalModalRef.current) {
            hasShownGoalModalRef.current = true;
            setTimeout(() => {
                setGoalAchievedModalVisible(true);
            }, 400);
        }

        try {
            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            await setDoc(waterRef, {
                total: increment(amount),
                ultimaAtualizacao: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.log('Erro ao salvar água:', error);
            setConsumedMl(consumedMl);
            Alert.alert('Erro', 'Não foi possível salvar no servidor.');
        }
    };

    const handleResetWater = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        setConsumedMl(0);
        hasShownGoalModalRef.current = false;

        try {
            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            await setDoc(waterRef, {
                total: 0,
                ultimaAtualizacao: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.log('Erro ao resetar água:', error);
            Alert.alert('Erro', 'Não foi possível resetar no servidor.');
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>

            {/* CABEÇALHO PADRONIZADO */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Voltar"
                >
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hidratação</Text>
            </View>

            {loadingData ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={themes.colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* SELETOR DE META DIÁRIA */}
                    <Text style={styles.metaSelectorLabel}>SUA META DIÁRIA:</Text>
                    <View style={styles.goalPillsContainer}>
                        {GOAL_OPTIONS.map((option) => {
                            const isSelected = effectiveGoal === option;
                            return (
                                <TouchableOpacity
                                    key={option}
                                    style={[styles.goalPill, isSelected && styles.goalPillActive]}
                                    onPress={() => handleChangeGoal(option)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.goalPillText, isSelected && styles.goalPillTextActive]}>
                                        {option >= 1000 ? `${option / 1000}L` : `${option}ml`}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={styles.sectionTitle}>CONSUMO HOJE:</Text>

                    {/* CONTAINER COM O NÍVEL DE ÁGUA ANIMADO */}
                    <View style={styles.glassContainer}>
                        <Animated.View style={[styles.waterFill, { height: animatedHeight }]} />
                        <View style={styles.iconWrapper}>
                            <MaterialCommunityIcons 
                                name="water" 
                                size={56} 
                                color={fillPercentage > 50 ? "#FFFFFF" : "#00B2FF"} 
                            />
                        </View>
                    </View>

                    <Text style={styles.totalText}>
                        TOTAL: {consumedMl}ml de {(effectiveGoal / 1000).toFixed(1)}L
                    </Text>

                    {/* BOTÃO ÚNICO DE REGISTRAR + */}
                    <View style={styles.registerPillContainer}>
                        <TouchableOpacity
                            style={styles.registerButton}
                            activeOpacity={0.8}
                            onPress={() => setHydrationModalVisible(true)}
                        >
                            <Text style={styles.registerButtonText}>REGISTRAR +</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.metaContainer}>
                        <Text style={styles.restamText}>
                            RESTAM: {remainingCups} {remainingCups === 1 ? 'copo' : 'copos'} de {CUP_BASE_ML}ml
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.resetButton}
                        activeOpacity={0.8}
                        onPress={handleResetWater}
                    >
                        <Text style={styles.resetButtonText}>RESETAR</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* MODAL DE SELEÇÃO DA QUANTIDADE DE ÁGUA */}
            <HydrationSelectionModal
                visible={hydrationModalVisible}
                onClose={() => setHydrationModalVisible(false)}
                onSelectAmount={handleAddWaterAmount}
            />

            {/* MODAL DE META CONCLUÍDA */}
            <GoalAchievedModal
                visible={goalAchievedModalVisible}
                goalMl={effectiveGoal}
                onClose={() => setGoalAchievedModalVisible(false)}
            />
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// ESTILOS DO COMPONENTE
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
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
    headerShadow: {
        position: 'absolute',
        bottom: -6,
        left: 0,
        right: 0,
        height: 6,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: 'center',
    },
    topBanner: {
        width: '100%',
        backgroundColor: themes.colors.primary,
        borderRadius: 50,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 16,
    },
    bannerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
    metaSelectorLabel: { fontSize: 14, fontWeight: 'bold', color: 'gray', marginTop: 16, marginBottom: 6 },
    goalPillsContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
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
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: themes.colors.notBlack, marginTop: 16, marginBottom: 8 },
    glassContainer: {
        width: 110,
        height: 110,
        borderWidth: 3,
        borderColor: themes.colors.primary || '#0052cc',
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
    totalText: { fontSize: 18, fontWeight: 'bold', color: themes.colors.notBlack, marginVertical: 10 },
    registerPillContainer: {
        width: '78%',
        marginVertical: 10,
        marginTop: 30,
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
    registerButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', letterSpacing: 0.5 },
    resetButton: {
        width: '50%',
        backgroundColor: '#E53935',
        borderRadius: 50,
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: 60,
        marginBottom: 8,
    },
    resetButtonText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
    metaContainer: { marginTop: 30, alignItems: 'center', gap: 4 },
    restamText: { fontSize: 18, fontWeight: 'bold', color: themes.colors.notBlack },
});

// ---------------------------------------------------------------------------
// ESTILOS DOS MODAIS
// ---------------------------------------------------------------------------
const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center' },
    iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: themes.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 18, fontWeight: '500', color: '#555', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
    closeButton: { width: '100%', backgroundColor: themes.colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    closeText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});

const hydrationStyles = StyleSheet.create({
    optionsColumn: {
        width: '100%',
        gap: 12,
        marginBottom: 16,
    },
    optionButton: {
        width: '78%',
        backgroundColor: themes.colors.primary,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        marginLeft: 34,
    },
    optionText: {
        color: themes.colors.secondary || '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
    closeButton: { 
        width: '100%', 
        backgroundColor: themes.colors.lightGray || '#F0F0F0', 
        borderRadius: 16, 
        paddingVertical: 14, 
        alignItems: 'center',
    }, 
    closeText: { 
        color: '#555', 
        fontSize: 18, 
        fontWeight: 'bold' 
    },
});