import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface SyncStatusBadgeProps {
    isSyncing?: boolean;
    lastSynced?: string;
}

export function SyncStatusBadge({ isSyncing = false, lastSynced }: SyncStatusBadgeProps) {
    const { fontScale, isHighContrast, theme } = useAccessibility();

    return (
        <View style={[
            styles.container,
            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
        ]}>
            <MaterialCommunityIcons
                name={isSyncing ? "cloud-upload-outline" : "cloud-check-outline"}
                size={20}
                color={isSyncing ? "#D97706" : (isHighContrast ? theme.buttonPrimary : "#16A34A")}
            />
            <Text style={[
                styles.text,
                { fontSize: 13 * fontScale },
                isHighContrast && { color: theme.textPrimary }
            ]}>
                {isSyncing ? 'Sincronizando...' : (lastSynced ? `Sincronizado ${lastSynced}` : 'Dados salvos na nuvem')}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#F0FDF4',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#DCFCE7',
        gap: 6,
        marginVertical: 8,
    },
    text: {
        color: '#15803D',
        fontWeight: '600',
    },
});