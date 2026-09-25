import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

export function RemindersMenu() {
    const navigation = useNavigation<NavigationProp<any>>();

    const menuOptions = [
        {
            id: 'ver-lembretes',
            title: 'VER\nLEMBRETES',
            iconName: 'format-list-bulleted',
            color: '#0052CC', // Azul
            onPress: () => navigation.navigate('ViewReminders'),
        },
        {
            id: 'novo-lembrete',
            title: 'NOVO\nLEMBRETE',
            iconName: 'plus-box',
            color: themes.colors.secureGreen || '#198754', // Verde
            onPress: () => navigation.navigate('SetReminderView'),
        },
        {
            id: 'emitir-relatorio',
            title: 'EMITIR\nRELATÓRIOS',
            iconName: 'file-document-outline', // Ícone de relatório/documento
            color: '#4BB5E3', // Azul claro
            onPress: () => navigation.navigate('GenerateReport'), // Rota provisória do relatório
        },
        {
            id: 'excluir-lembretes',
            title: 'EXCLUIR\nLEMBRETES',
            iconName: 'trash-can-outline',
            color: '#D9534F', // Vermelho
            onPress: () => navigation.navigate('DeleteReminders'),
        },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* CABEÇALHO */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.title}>Lembretes</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.subtitle}>O que você deseja fazer?</Text>

                {/* GRID 2x2 DE OPÇÕES */}
                <View style={styles.grid}>
                    {menuOptions.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.card, { backgroundColor: item.color }]}
                            onPress={item.onPress}
                            activeOpacity={0.85}
                        >
                            <MaterialCommunityIcons name={item.iconName as any} size={56} color="#FFFFFF" />
                            <Text style={styles.cardTitle}>{item.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const { width } = Dimensions.get('window');
const cardSize = (width - 60) / 2;

const styles = StyleSheet.create({
    container: {
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
    title: {
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
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 30,
    },
    subtitle: {
        fontSize: 18,
        color: '#666666',
        marginBottom: 24,
        marginTop: 5,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    card: {
        width: cardSize,
        height: cardSize,
        borderRadius: 50,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 10,
        letterSpacing: 0.5,
    },
});