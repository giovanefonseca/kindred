import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    AppState,
} from 'react-native';
import { themes } from '../../../global/themes';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; // Adicionado para atualizar ao entrar no ecrã

// Importações do Firebase
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { auth, db } from '../../../config/firebaseConfig'; // Ajuste o caminho se necessário

export function WaterTrackingView() {
    const GOAL_ML = 2000;
    const CUP_ML = 250;
    const [consumedMl, setConsumedMl] = useState(0);

    const remainingMl = Math.max(0, GOAL_ML - consumedMl);
    const remainingCups = Math.ceil(remainingMl / CUP_ML);

    // Gera o ID do dia atual (ex: "2026-9-21")
    const getTodayId = () => {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    };

    // Busca o consumo de água no Firebase sempre que a página for aberta
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

            // Busca quando entra no ecrã
            fetchWater();

            // Adiciona o detetor para quando o aplicativo estava em segundo plano e volta para a tela
            const subscription = AppState.addEventListener('change', nextAppState => {
                if (nextAppState === 'active') {
                    fetchWater(); // Recarrega os dados (verificando se o dia mudou)
                }
            });

            // Limpa o detetor quando o utilizador sai deste ecrã
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
        
        // Atualiza a interface instantaneamente (Optimistic UI)
        setConsumedMl(newTotal);

        if (newTotal >= GOAL_ML && consumedMl < GOAL_ML) {
            Alert.alert('Parabéns! 🎉', 'Você atingiu sua meta diária de 2 litros de água!');
        } else {
            Alert.alert('Água Registrada! 💧', `+${CUP_ML}ml adicionados ao seu consumo de hoje.`);
        }

        // Salva a adição no Firebase
        try {
            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            await setDoc(waterRef, {
                total: increment(CUP_ML),
                ultimaAtualizacao: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.log('Erro ao salvar água:', error);
            setConsumedMl(consumedMl); // Reverte o valor na interface se a internet falhar
            Alert.alert('Erro', 'Não foi possível salvar no servidor.');
        }
    };

    const handleResetWater = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Zera a interface
        setConsumedMl(0);
        Alert.alert('Resetado! 🔄', 'O seu consumo diário de água foi zerado.');

        // Zera no Firebase
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
            {/* Banner Superior Azul */}
            <View style={styles.topBanner}>
                <Text style={styles.bannerTitle}>REGISTRAR ÁGUA</Text>
            </View>

            {/* Consumo Hoje */}
            <Text style={styles.sectionTitle}>CONSUMO HOJE:</Text>

            {/* Ilustração do Copo de Água */}
            <View style={styles.glassContainer}>
                <MaterialCommunityIcons 
                    name="cup-water" 
                    size={80} 
                    color={themes.colors.primary} 
                />
            </View>

            {/* Total Consumido */}
            <Text style={styles.totalText}>
                TOTAL: {consumedMl}ml de 2L
            </Text>

            {/* Botão de Adição de Copo (+250ml) */}
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

            {/* Metas e Restante */}
            <View style={styles.metaContainer}>
                <Text style={styles.metaText}>META DIÁRIA: 2litros</Text>
                <Text style={styles.restamText}>
                    RESTAM: {remainingCups} {remainingCups === 1 ? 'copo' : 'copos'} de {CUP_ML}ml
                </Text>
            </View>

            {/* Botão de Resetar Consumo */}
            <TouchableOpacity
                style={styles.resetButton}
                activeOpacity={0.8}
                onPress={handleResetWater}
                accessibilityRole="button"
                accessibilityLabel="Resetar consumo de água"
            >
                <Text style={styles.resetButtonText}>RESETAR</Text>
            </TouchableOpacity>
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
        fontSize: 14,
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
        fontSize: 15,
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
        fontSize: 14,
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
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    metaContainer: {
        marginTop: 18,
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'gray',
        letterSpacing: 0.3,
    },
    restamText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        letterSpacing: 0.3,
    },
});