/**
 * BooleanToggle — Componente compartilhado de alternância Sim/Não com transição Smooth
 *
 * Design: pill única animada, lado ativo desliza suavemente em verde (secureGreen).
 * Mantém 100% de compatibilidade com os props atuais.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { themes } from '../../global/themes';

const GREEN = themes.colors.secureGreen || '#198754';

interface BooleanToggleProps {
    /** Valor atual. `true` = SIM ativo, `false` = NÃO ativo, `undefined` = nenhum ativo */
    value: boolean | undefined;
    onChange: (v: boolean) => void;
    /** Labels personalizados. Padrão: ['SIM', 'NÃO'] */
    labels?: [string, string];
}

export function BooleanToggle({ value, onChange, labels = ['SIM', 'NÃO'] }: BooleanToggleProps) {
    const [trackWidth, setTrackWidth] = React.useState<number>(180);
    const simActive = value === true;
    const naoActive = value === false;

    // Valor animado: 0 para SIM (esquerda), 1 para NÃO (direita)
    const animValue = useRef(new Animated.Value(value === false ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: value === false ? 1 : 0,
            duration: 220, // Transição suave em ms
            easing: Easing.out(Easing.quad), // Desaceleração fluida
            useNativeDriver: false,
        }).start();
    }, [value]);

    const handleLayout = (e: LayoutChangeEvent) => {
        const { width } = e.nativeEvent.layout;
        if (width > 0) setTrackWidth(width);
    };

    // Posição x da pill animada
    const thumbWidth = (trackWidth - 8) / 2;
    const translateX = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [4, 4 + thumbWidth],
    });

    return (
        <View style={styles.track} onLayout={handleLayout} accessibilityRole="radiogroup">
            {/* Pill Deslizante Animada */}
            {value !== undefined && (
                <Animated.View
                    style={[
                        styles.animatedThumb,
                        {
                            width: thumbWidth,
                            transform: [{ translateX }],
                        },
                    ]}
                />
            )}

            {/* Opção SIM (Esquerda) */}
            <TouchableOpacity
                style={styles.half}
                onPress={() => onChange(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={labels[0]}
                accessibilityState={{ selected: simActive }}
            >
                <Text style={[styles.label, simActive && styles.labelActive]}>
                    {labels[0]}
                </Text>
            </TouchableOpacity>

            {/* Opção NÃO (Direita) */}
            <TouchableOpacity
                style={styles.half}
                onPress={() => onChange(false)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={labels[1]}
                accessibilityState={{ selected: naoActive }}
            >
                <Text style={[styles.label, naoActive && styles.labelActive]}>
                    {labels[1]}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        backgroundColor: '#E0E0E0',
        borderRadius: 50,
        height: 52,
        marginTop: 6,
        alignSelf: 'center',
        minWidth: 180,
        paddingHorizontal: 4,
        alignItems: 'center',
        position: 'relative',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    animatedThumb: {
        position: 'absolute',
        height: 44,
        backgroundColor: GREEN,
        borderRadius: 50,
        zIndex: 1,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    half: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        zIndex: 2,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666666',
    },
    labelActive: {
        color: '#FFFFFF',
    },
});