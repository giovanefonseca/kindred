import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { style } from './styles';
import { themes } from '../../global/themes';
import { getAllActionRoutes, ActionRouteConfig } from '../../config/routesConfig';
import { useReminders, NotificationReminder } from '../../contexts/ReminderContext';

// Importações do Firebase atualizadas
import { collection, getCountFromServer, doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

export default function List() {
    const navigation = useNavigation<NavigationProp<any>>();
    const actions = getAllActionRoutes();
    
    const { reminders, markAsRead, removeReminder } = useReminders();

    const [notesCount, setNotesCount] = useState<number | string>('...');
    const [waterTotal, setWaterTotal] = useState<number>(0);

    // Função auxiliar para gerar um ID único por dia (ex: "2026-9-21")
    const getTodayId = () => {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    };

    // 1. Busca a contagem de anotações
    const fetchNotesCount = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            const notesRef = collection(db, 'users', userId, 'notes');
            const snapshot = await getCountFromServer(notesRef);
            setNotesCount(snapshot.data().count);
        } catch (error) {
            console.log('Erro ao buscar total de notas:', error);
            setNotesCount(0);
        }
    };

    // 2. Busca a quantidade de água bebida HOJE
    const fetchTodayWater = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            const docSnap = await getDoc(waterRef);
            
            if (docSnap.exists()) {
                setWaterTotal(docSnap.data().total || 0);
            } else {
                setWaterTotal(0); // Se não houver registo hoje, é 0
            }
        } catch (error) {
            console.log('Erro ao buscar água:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNotesCount();
            fetchTodayWater();
        }, [])
    );

    // 3. Função para adicionar água ao banco de dados
    const handleAddWater = async (amount: number) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return Alert.alert('Erro', 'Usuário não autenticado.');

        try {
            // Atualiza a interface instantaneamente para o utilizador não esperar
            setWaterTotal(prev => prev + amount);

            // Salva no Firebase usando "increment" (soma automaticamente no servidor)
            const waterRef = doc(db, 'users', userId, 'hydration', getTodayId());
            await setDoc(waterRef, {
                total: increment(amount),
                ultimaAtualizacao: new Date().toISOString()
            }, { merge: true }); // merge: true cria o documento se não existir, ou apenas atualiza se já existir

        } catch (error) {
            console.log('Erro ao salvar água:', error);
            Alert.alert('Erro', 'Não foi possível salvar.');
            fetchTodayWater(); // Reverte o valor na tela em caso de falha de internet
        }
    };

    // 4. Menu rápido de adição de água
    const showWaterOptions = () => {
        Alert.alert(
            "Minha Hidratação",
            "Quanto você bebeu agora?",
            [
                { text: "+ 200ml", onPress: () => handleAddWater(200) },
                { text: "+ 300ml", onPress: () => handleAddWater(300) },
                { text: "+ 500ml", onPress: () => handleAddWater(500) },
                { text: "Cancelar", style: "cancel" }
            ]
        );
    };

    // Formata o texto de exibição (se for > 1000ml mostra em Litros)
    const waterDisplay = waterTotal >= 1000 
        ? `${(waterTotal / 1000).toFixed(1)}L` 
        : `${waterTotal}ml`;

    const handleActionPress = (action: ActionRouteConfig) => {
        navigation.navigate('DynamicAction', { slug: action.slug });
    };

    const handleNotificationPress = (notification: NotificationReminder) => {
        Alert.alert(
            notification.title, 
            notification.subtitle,
            [
                { text: 'OK', onPress: () => markAsRead(notification.id) },
                { text: 'Apagar', onPress: () => removeReminder(notification.id), style: 'destructive' }
            ]
        );
    };

    const renderActionIcon = (action: ActionRouteConfig) => {
        if (action.slug === 'definir-lembrete') {
            return (
                <View style={style.calendarIconWrapper}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={50} color="#FFFFFF" />
                    <MaterialCommunityIcons name="bell-outline" size={26} color="#FFFFFF" style={style.bellIconOverlay} />
                </View>
            );
        }
        return (
            <MaterialCommunityIcons name={action.iconName as any} size={54} color="#FFFFFF" />
        );
    };

    const renderNotificationIcon = (notification: NotificationReminder) => {
        if (notification.iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={notification.iconName as any} size={26} color={themes.colors.secureGreen || '#2E8B57'} />;
        }
        return <MaterialCommunityIcons name={notification.iconName as any} size={28} color={themes.colors.secureGreen || '#2E8B57'} />;
    };

    return (
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>

                {/* AÇÕES RÁPIDAS */}
                <Text style={style.sectionTitle}>AÇÕES RÁPIDAS</Text>
                <View style={style.gridContainer}>
                    {actions.map((action) => (
                        <TouchableOpacity key={action.id} style={[style.card, { backgroundColor: action.color }]} onPress={() => handleActionPress(action)}>
                            {renderActionIcon(action)}
                            <Text style={style.cardText}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* PAINEL DE RESUMO */}
                <Text style={style.sectionTitle}>MEU PAINEL</Text>
                <View style={style.dashboardGrid}>

                    {/* Bloco 1: Segurança */}
                    <TouchableOpacity 
                        style={style.dashboardCardSecurity}
                        onPress={() => Alert.alert("Em breve", "O painel de segurança será implementado em seguida.")}
                    >
                        <Text style={[style.cardValue, { color: '#ffffff' }]}>OK</Text>
                        <Text style={style.cardLabel}>Segurança</Text>
                    </TouchableOpacity>

                    {/* Bloco 2: Anotações */}
                    <TouchableOpacity 
                        style={style.dashboardCardNote} 
                        onPress={() => navigation.navigate('NotesMenu')}
                    >
                        <Text style={style.cardValue}>{notesCount}</Text>
                        <Text style={style.cardLabel}>Minhas Anotações</Text>
                    </TouchableOpacity>

                    {/* Bloco 3: Lembretes */}
                    <TouchableOpacity 
                        style={style.dashboardCardReminder}
                        onPress={() => Alert.alert("Em breve", "O painel de lembretes será implementado em seguida.")}
                    >
                        <Text style={style.cardValue}>{reminders.length}</Text>
                        <Text style={style.cardLabel}>Lembretes Ativos</Text>
                    </TouchableOpacity>

                    {/* Bloco 4: Hidratação (Agora funcional) */}
                    <TouchableOpacity 
                        style={style.dashboardCardHidro}
                        onPress={showWaterOptions}
                    >
                        <Text style={style.cardValue}>{waterDisplay}</Text>
                        <Text style={style.cardLabel}>Minha Hidratação</Text>
                    </TouchableOpacity>

                </View>

                {/* NOTIFICAÇÕES RECENTES */}
                <View style={style.notificationsSection}>
                    <Text style={style.sectionTitle}>NOTIFICAÇÕES RECENTES</Text>

                    {reminders.length === 0 ? (
                        <Text style={style.emptyText}>
                            Nenhum lembrete configurado.
                        </Text>
                    ) : (
                        reminders.map((notification) => (
                            <TouchableOpacity
                                key={notification.id}
                                style={[style.notificationPill, notification.isRead && { opacity: 0.6 }]}
                                activeOpacity={0.7}
                                onPress={() => handleNotificationPress(notification)}
                            >
                                <Text style={style.notificationText} numberOfLines={2}>
                                    <Text style={style.notificationBold}>{notification.title}: </Text>
                                    {notification.subtitle}
                                </Text>
                                <View style={style.notificationIconWrapper}>
                                    {renderNotificationIcon(notification)}
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}