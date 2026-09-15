import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from 'react-native';
import { themes } from '../../../global/themes';

const waterGlassImg = require('../../../assets/water-glass.png');

export function WaterTrackingView() {
    const GOAL_ML = 2000;
    const CUP_ML = 250;
    const [consumedMl, setConsumedMl] = useState(750);

    const remainingMl = Math.max(0, GOAL_ML - consumedMl);
    const remainingCups = Math.ceil(remainingMl / CUP_ML);

    const handleAddWater = () => {
        const newTotal = consumedMl + CUP_ML;
        setConsumedMl(newTotal);

        if (newTotal >= GOAL_ML && consumedMl < GOAL_ML) {
            Alert.alert('Parabéns! 🎉', 'Você atingiu sua meta diária de 2 litros de água!');
        } else {
            Alert.alert('Água Registrada! 💧', `+${CUP_ML}ml adicionados ao seu consumo de hoje.`);
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
                <Image
                    source={waterGlassImg}
                    style={styles.glassImage}
                    resizeMode="contain"
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
        borderRadius: 22,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
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
    glassImage: {
        width: 65,
        height: 85,
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
    metaContainer: {
        marginTop: 18,
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        letterSpacing: 0.3,
    },
    restamText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        letterSpacing: 0.3,
    },
});

