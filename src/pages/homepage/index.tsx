import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { style } from './styles';
import { themes } from '../../global/themes';
import { getAllActionRoutes, ActionRouteConfig } from '../../config/routesConfig';
import { useReminders, NotificationReminder } from '../../contexts/ReminderContext'; // <-- Importação

export default function List() {
    const navigation = useNavigation<NavigationProp<any>>();
    const actions = getAllActionRoutes();
    
    // 1. Consome os lembretes do estado global
    const { reminders, markAsRead, removeReminder } = useReminders();

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

    // 2. Renderização dinâmica do ícone baseado na família enviada
    const renderNotificationIcon = (notification: NotificationReminder) => {
        if (notification.iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={notification.iconName as any} size={26} color={themes.colors.secureGreen} />;
        }
        return <MaterialCommunityIcons name={notification.iconName as any} size={28} color={themes.colors.secureGreen} />;
    };

    return (
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                
                <Text style={style.sectionTitle}>AÇÕES RÁPIDAS</Text>
                
                <View style={style.gridContainer}>
                    {actions.map((action) => (
                        <TouchableOpacity key={action.id} style={[style.card, { backgroundColor: action.color }]} onPress={() => handleActionPress(action)}>
                            {renderActionIcon(action)}
                            <Text style={style.cardText}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Seção de Notificações Recentes Dinâmica */}
                <View style={style.notificationsSection}>
                    <Text style={style.sectionTitle}>NOTIFICAÇÕES RECENTES</Text>

                    {reminders.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: '#666', marginTop: 10 }}>
                            Nenhum lembrete configurado.
                        </Text>
                    ) : (
                        reminders.map((notification) => (
                            <TouchableOpacity
                                key={notification.id}
                                style={[style.notificationPill, notification.isRead && { opacity: 0.6 }]}
                                activeOpacity={0.7}
                                onPress={() => handleNotificationPress(notification)}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`${notification.title} ${notification.subtitle}`}
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