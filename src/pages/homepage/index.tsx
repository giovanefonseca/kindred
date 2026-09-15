import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { style } from './styles';
import { themes } from '../../global/themes';
import { getAllActionRoutes, ActionRouteConfig } from '../../config/routesConfig';

export default function List() {
    const navigation = useNavigation<NavigationProp<any>>();
    const actions = getAllActionRoutes();

    const handleActionPress = (action: ActionRouteConfig) => {
        navigation.navigate('DynamicAction', { slug: action.slug });
    };

    const handleNotificationPress = (notification: string) => {
        Alert.alert('Notificação', notification);
    };

    // Renderização do ícone com base na configuração da rota
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
            <MaterialCommunityIcons
                name={action.iconName as any}
                size={54}
                color="#FFFFFF"
            />
        );
    };

    return (
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <ScrollView
                contentContainerStyle={style.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Seção de Ações Rápidas - Mapeamento Dinâmico */}
                <Text style={style.sectionTitle}>AÇÕES RÁPIDAS</Text>
                
                <View style={style.gridContainer}>
                    {actions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={[style.card, { backgroundColor: action.color }]}
                            activeOpacity={0.8}
                            onPress={() => handleActionPress(action)}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={action.accessibilityLabel}
                            accessibilityHint={action.accessibilityHint}
                        >
                            {renderActionIcon(action)}
                            <Text style={style.cardText}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Seção de Notificações Recentes */}
                <View style={style.notificationsSection}>
                    <Text style={style.sectionTitle}>NOTIFICAÇÕES RECENTES</Text>

                    {/* Notificação 1 - Remédio */}
                    <TouchableOpacity
                        style={style.notificationPill}
                        activeOpacity={0.7}
                        onPress={() => handleNotificationPress('Lembrete: Remédio diabetes às 14h')}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Notificação de remédio de diabetes às 14 horas"
                    >
                        <Text style={style.notificationText}>
                            <Text style={style.notificationBold}>LEMBRETE: </Text>
                            REMÉDIO DIABETES ÀS 14H
                        </Text>
                        <View style={style.notificationIconWrapper}>
                            <FontAwesome5 name="pills" size={26} color={themes.colors.secureGreen} />
                        </View>
                    </TouchableOpacity>

                    {/* Notificação 2 - Exame */}
                    <TouchableOpacity
                        style={style.notificationPill}
                        activeOpacity={0.7}
                        onPress={() => handleNotificationPress('Lembrete: Exame amanhã 7h - JEJUM!')}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Notificação de exame amanhã às 7 horas em jejum"
                    >
                        <Text style={style.notificationText}>
                            <Text style={style.notificationBold}>LEMBRETE: </Text>
                            EXAME AMANHÃ 7H - <Text style={style.highlightDanger}>JEJUM!</Text>
                        </Text>
                        <View style={style.notificationIconWrapper}>
                            <FontAwesome5 name="user-md" size={28} color={themes.colors.secureGreen} />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}