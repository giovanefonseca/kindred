import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuração Crucial: Diz ao sistema operacional para exibir o alerta visual (Toast/Banner)
// e tocar o som MESMO SE o usuário estiver com o aplicativo aberto na tela (Foreground).
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true, // <-- Substitui o antigo 'shouldShowAlert'
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowList: true,   // <-- Opcional: Garante a exibição na central/histórico do SO
    }),
});

export class NotificationService {
    /**
     * Solicita permissão do usuário para enviar notificações de forma resiliente.
     */
    static async requestPermissions(): Promise<boolean> {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('reminders', {
                name: 'Lembretes',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        
        return finalStatus === 'granted';
    }

    /**
     * Agenda a notificação local para um momento específico (Data/Hora).
     */
    static async scheduleReminder(
        title: string,
        body: string,
        triggerDate: Date
    ): Promise<string | null> {
        const hasPermission = await this.requestPermissions();
        
        if (!hasPermission) {
            console.warn('[NotificationService] Permissão negada para notificações.');
            return null;
        }

        try {
            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                    data: { route: 'ReminderDetails' }, // Payload para navegação ao clicar
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                },
            });
            
            return notificationId;
        } catch (error) {
            console.error('[NotificationService] Falha ao agendar:', error);
            return null;
        }
    }
}