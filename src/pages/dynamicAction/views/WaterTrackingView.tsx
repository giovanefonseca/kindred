import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    AppState,
    Modal,
} from 'react-native';
import { themes } from '../../../global/themes';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Importações do Firebase
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { auth, db } from '../../../config/firebaseConfig';

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO
// ---------------------------------------------------------------------------
interface WaterModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    onClose: () => void;
}

function WaterModal({ visible, title, subtitle, onClose }: WaterModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={modalStyles.iconCircle}>
                        <MaterialCommunityIcons name="water" size={40} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={modalStyles.subtitle}>{subtitle}</Text>

                    <TouchableOpacity style={modalStyles.closeButton} onPress={onClose} activeOpacity={0.8}>
                        <Text style={modalStyles.closeText}>CONCLUIR</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

export function WaterTrackingView() {
    const GOAL_ML = 2000;
    const CUP_ML = 250;
    const [consumedMl, setConsumedMl] = useState(0);

    // Estados do Modal Customizado
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalSubtitle, setModalSubtitle] = useState('');

    const remainingMl = Math.max(0, GOAL_ML - consumedMl);
    const remainingCups = Math.ceil(remainingMl / CUP_ML);

    const getTodayId = () => {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    };

    useFocusEffect(
        useCallback(() => {
            const fetchWater = async () => {
                const userId = auth.currentUser?.uid;
                if (!userId) return;

                try {
                    const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
                    const docSnap = await getDoc(waterRef);
                    
                    if (docSnap.exists()) {
                        setConsumedMl(docSnap.data().total || 0);
                    } else {
                        setConsumedMl(0); 
                    }
                } catch (error) {
                    console.log('Erro ao buscar hidratação:', error);
                }
            };

            fetchWater();

            const subscription = AppState.addEventListener('change', nextAppState => {
                if (nextAppState === 'active') {
                    fetchWater();
                }
            });

            return () => {
                subscription.remove();
            };
        }, [])
    );

    const handleAddWater = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            return Alert.alert('Erro', 'Utilizador não autenticado.');
        }

        const newTotal = consumedMl + CUP_ML;
        
        setConsumedMl(newTotal);

        if (newTotal >= GOAL_ML && consumedMl < GOAL_ML) {
            setModalTitle('Parabéns! 🎉');
            setModalSubtitle('Você atingiu sua meta diária de 2 litros de água!');
        } else {
            setModalTitle('Água Registrada! 💧');
            setModalSubtitle(`+${CUP_ML}ml adicionados ao seu consumo de hoje.`);
        }
        setModalVisible(true);

        try {
            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            await setDoc(waterRef, {
                total: increment(CUP_ML),
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
        setModalTitle('Resetado! 🔄');
        setModalSubtitle('O seu consumo diário de água foi zerado.');
        setModalVisible(true);

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
        <View style={styles.container}>
            <View style={styles.topBanner}>
                <Text style={styles.bannerTitle}>REGISTRAR ÁGUA</Text>
            </View>

            <Text style={styles.sectionTitle}>CONSUMO HOJE:</Text>

            <View style={styles.glassContainer}>
                <MaterialCommunityIcons 
                    name="cup-water" 
                    size={80} 
                    color={themes.colors.primary} 
                />
            </View>

            <Text style={styles.totalText}>
                TOTAL: {consumedMl}ml de 2L
            </Text>

            <View style={styles.registerPillContainer}>
                <Text style={styles.plusText}>+{CUP_ML}ml</Text>
                <TouchableOpacity
                    style={styles.registerButton}
                    activeOpacity={0.8}
                    onPress={handleAddWater}
                    accessibilityRole="button"
                    accessibilityLabel="Registrar mais 250ml de água"
                >
                    <Text style={styles.registerButtonText}>REGISTRAR</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.metaContainer}>
                <Text style={styles.metaText}>META DIÁRIA: 2litros</Text>
                <Text style={styles.restamText}>
                    RESTAM: {remainingCups} {remainingCups === 1 ? 'copo' : 'copos'} de {CUP_ML}ml
                </Text>
            </View>

            <TouchableOpacity
                style={styles.resetButton}
                activeOpacity={0.8}
                onPress={handleResetWater}
                accessibilityRole="button"
                accessibilityLabel="Resetar consumo de água"
            >
                <Text style={styles.resetButtonText}>RESETAR</Text>
            </TouchableOpacity>

            {/* Popup Customizado */}
            <WaterModal
                visible={modalVisible}
                title={modalTitle}
                subtitle={modalSubtitle}
                onClose={() => setModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
    },
    topBanner: {
        width: '100%',
        backgroundColor: themes.colors.primary,
        borderRadius: 50,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 12,
        letterSpacing: 0.3,
    },
    glassContainer: {
        width: 80,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 4,
    },
    totalText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginVertical: 14,
        letterSpacing: 0.3,
    },
    registerPillContainer: {
        width: '78%',
        borderWidth: 2,
        borderColor: themes.colors.primary,
        borderRadius: 24,
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
        marginVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    plusText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: themes.colors.primary,
        marginBottom: 8,
    },
    registerButton: {
        width: '100%',
        backgroundColor: themes.colors.primary,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    registerButtonText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    resetButton: {
        width: '50%',
        backgroundColor: '#E53935',
        borderRadius: 50,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        marginBottom: 8,
    },
    resetButtonText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    metaContainer: {
        marginTop: 18,
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'gray',
        letterSpacing: 0.3,
    },
    restamText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        letterSpacing: 0.3,
    },
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
        backgroundColor: themes.colors.primary, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 16 
    },
    title: { 
        fontSize: 22, 
        fontWeight: '900', 
        color: '#1A1A1A', 
        textAlign: 'center', 
        marginBottom: 8 
    },
    subtitle: { 
        fontSize: 18, 
        fontWeight: '500', 
        color: '#555', 
        textAlign: 'center', 
        marginBottom: 24,
        lineHeight: 24,
    },
    closeButton: { 
        width: '100%', 
        backgroundColor: themes.colors.primary, 
        borderRadius: 16, 
        paddingVertical: 14, 
        alignItems: 'center' 
    },
    closeText: { 
        color: '#FFFFFF', 
        fontSize: 18, 
        fontWeight: 'bold' 
    },
});