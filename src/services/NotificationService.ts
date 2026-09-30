import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuração original que já funcionava no seu projeto
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export class NotificationService {
  static async initialize(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#198754',
      });
    }
  }

  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('[NotificationService] Erro ao solicitar permissões:', error);
      return false;
    }
  }

  // Método original blindado (Time Drift + Timestamp Numérico), agora com
  // o campo "type" obrigatório no trigger a partir do expo-notifications ~0.31+.
  // Sem esse campo o Android recebe um trigger inválido e nunca dispara,
  // mesmo no Expo Go.
  static async scheduleReminder(title: string, subtitle: string, triggerDate: Date): Promise<string | void> {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        console.warn('[NotificationService] Agendamento cancelado: Permissão negada pelo usuário.');
        return;
      }

      const now = Date.now();
      const timeToTrigger = triggerDate.getTime();
      
      const safeTimestamp = timeToTrigger <= now ? now + 2000 : timeToTrigger;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: subtitle,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: safeTimestamp,
          channelId: 'default',
        },
      });
      
      console.log(`[NotificationService] Agendado com sucesso para ${new Date(safeTimestamp).toISOString()} (ID: ${notificationId})`);
      return notificationId;

    } catch (error) {
      console.error('[NotificationService] Falha estrutural ao agendar notificação:', error);
      throw error; 
    }
  }

  // Único método novo para permitir apagar o alarme quando o lembrete for excluído
  static async cancelReminder(notificationId?: string | null): Promise<void> {
    if (!notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`[NotificationService] Notificação cancelada com sucesso (ID: ${notificationId})`);
    } catch (error) {
      console.warn(`[NotificationService] Não foi possível cancelar a notificação (ID: ${notificationId}):`, error);
    }
  }
}