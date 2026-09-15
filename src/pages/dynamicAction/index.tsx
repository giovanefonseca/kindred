import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getActionRouteBySlug, ActionViewKey } from '../../config/routesConfig';
import { style } from './styles';
import { themes } from '../../global/themes';

import { NotFoundView } from './views/NotFoundView';
import { EmergencyCallView } from './views/EmergencyCallView';
import { NewNoteView } from './views/NewNoteView';
import { SetReminderView } from './views/SetReminderView';
import { WaterTrackingView } from './views/WaterTrackingView';

// Mapeamento Factory das Views
const VIEW_COMPONENTS: Record<ActionViewKey, React.ComponentType<any>> = {
    emergency: EmergencyCallView,
    note: NewNoteView,
    reminder: SetReminderView,
    water: WaterTrackingView,
};

export default function DynamicAction() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const slug = route.params?.slug;

    // Busca e valida a configuração da rota
    const actionConfig = getActionRouteBySlug(slug);

    // Tratamento de Erro e Fallback 404
    if (!actionConfig) {
        return (
            <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
                <NotFoundView onGoBack={() => navigation.goBack()} />
            </SafeAreaView>
        );
    }

    const ViewComponent = VIEW_COMPONENTS[actionConfig.viewKey];

    return (
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Barra de Navegação Superior com Voltar */}
            <View style={style.topNavBar}>
                <TouchableOpacity
                    style={style.backButton}
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
                    accessibilityHint="Retorna para a tela inicial"
                >
                    <Ionicons name="arrow-back" size={24} color={themes.colors.notBlack} />
                </TouchableOpacity>

                <Text style={style.headerTitle}>{actionConfig.accessibilityLabel}</Text>

                <View style={{ width: 40 }} />
            </View>

            {/* Conteúdo Dinâmico com Scroll */}
            <ScrollView
                contentContainerStyle={style.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {ViewComponent ? (
                    <ViewComponent
                        onCancel={() => navigation.goBack()}
                        onSaveSuccess={() => navigation.goBack()}
                    />
                ) : (
                    <NotFoundView onGoBack={() => navigation.goBack()} />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
