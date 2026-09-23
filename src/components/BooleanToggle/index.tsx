/**
 * BooleanToggle — Componente compartilhado de alternância Sim/Não
 *
 * Design: pill única, lado ativo em verde (secureGreen), centralizado.
 * Deve ser usado em TODOS os subforms do app para garantir coesão visual.
 *
 * Uso:
 *   <BooleanToggle value={data.emJejum === true} onChange={(v) => onChange({ ...data, emJejum: v })} />
 *
 * Atenção: o valor `undefined` é tratado como `false` (nenhum lado ativo).
 * Se precisar de "nenhum selecionado", use `value={undefined}`.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../../global/themes';

const GREEN = themes.colors.secureGreen; // #198754

interface BooleanToggleProps {
    /** Valor atual. `true` = SIM ativo, `false` = NÃO ativo, `undefined` = nenhum ativo */
    value: boolean | undefined;
    onChange: (v: boolean) => void;
    /** Labels personalizados. Padrão: ['SIM', 'NÃO'] */
    labels?: [string, string];
}

export function BooleanToggle({ value, onChange, labels = ['SIM', 'NÃO'] }: BooleanToggleProps) {
    const simActive  = value === true;
    const naoActive  = value === false;

    // Função que alterna o valor atual
    const handleToggle = () => {
        onChange(!value);
    };

    return (
        <View style={styles.track} accessibilityRole="radiogroup">
            <TouchableOpacity
                style={[styles.half, simActive && styles.halfActive]}
                onPress={handleToggle}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={labels[0]}
                accessibilityState={{ selected: simActive }}
            >
                <Text style={[styles.label, simActive && styles.labelActive]}>
                    {labels[0]}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.half, naoActive && styles.halfActive]}
                onPress={handleToggle}
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
        backgroundColor: '#D0D0D0',
        borderRadius: 50,
        height: 52,
        marginTop: 4,
        overflow: 'hidden',
        alignSelf: 'center',
        minWidth: 160,
    },
    half: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        borderRadius: 50,
    },
    halfActive: {
        backgroundColor: GREEN,
    },
    label: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#555',
    },
    labelActive: {
        color: '#FFF',
    },
});