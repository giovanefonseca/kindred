import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { themes } from '../../global/themes';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../contexts/AccessibilityContext';

const GREEN = themes.colors.secureGreen || '#198754';
const GRAY = '#888888'; // Cor cinza para a seleção do NÃO

interface BooleanToggleProps {
    value: boolean | undefined;
    onChange: (v: boolean) => void;
    labels?: [string, string];
}

export function BooleanToggle({ value, onChange, labels = ['SIM', 'NÃO'] }: BooleanToggleProps) {
    const [trackWidth, setTrackWidth] = React.useState<number>(180);
    const simActive = value === true;
    const naoActive = value === false;

    // Contexto de Acessibilidade
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const animValue = useRef(new Animated.Value(value === false ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: value === false ? 1 : 0,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
        }).start();
    }, [value]);

    const handleLayout = (e: LayoutChangeEvent) => {
        const { width } = e.nativeEvent.layout;
        if (width > 0) setTrackWidth(width);
    };

    const thumbWidth = (trackWidth - 8) / 2;
    const translateX = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [4, 4 + thumbWidth],
    });

    // Lógica de Cores Dinâmicas para Alto Contraste
    const getThumbColor = () => {
        if (isHighContrast) {
            return theme.buttonPrimary;
        }
        return value ? GREEN : GRAY;
    };

    return (
        <View 
            style={[
                styles.track,
                isHighContrast && { 
                    backgroundColor: theme.cardBackground, 
                    borderWidth: 2, 
                    borderColor: theme.border 
                }
            ]} 
            onLayout={handleLayout} 
            accessibilityRole="radiogroup"
        >
            {/* Pill Deslizante Animada */}
            {value !== undefined && (
                <Animated.View
                    style={[
                        styles.animatedThumb,
                        {
                            width: thumbWidth,
                            transform: [{ translateX }],
                            backgroundColor: getThumbColor(),
                        },
                    ]}
                />
            )}

            {/* Opção SIM */}
            <TouchableOpacity
                style={styles.half}
                onPress={() => onChange(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={labels[0]}
                accessibilityState={{ selected: simActive }}
            >
                <Text style={[
                    styles.label,
                    { fontSize: 16 * fontScale },
                    isHighContrast && { color: theme.textPrimary },
                    simActive && (isHighContrast ? { color: theme.buttonText } : styles.labelActive)
                ]}>
                    {labels[0]}
                </Text>
            </TouchableOpacity>

            {/* Opção NÃO */}
            <TouchableOpacity
                style={styles.half}
                onPress={() => onChange(false)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={labels[1]}
                accessibilityState={{ selected: naoActive }}
            >
                <Text style={[
                    styles.label,
                    { fontSize: 16 * fontScale },
                    isHighContrast && { color: theme.textPrimary },
                    naoActive && (isHighContrast ? { color: theme.buttonText } : styles.labelActive)
                ]}>
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