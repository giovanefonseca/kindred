import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuração Crucial: Diz ao sistema operacional para exibir o alerta visual (Toast/Banner)
// e tocar o som MESMO SE o usuário estiver com o aplicativo aberto na tela (Foreground).
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

  // ---------------------------------------------------------------------------
  // MÉTODO BLINDADO: Resolve TS Conflicts, Bridge Serialization e Time Drift
  // ---------------------------------------------------------------------------
  static async scheduleReminder(title: string, subtitle: string, triggerDate: Date): Promise<string | void> {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        console.warn('[NotificationService] Agendamento cancelado: Permissão negada pelo usuário.');
        return;
      }

      const now = Date.now();
      const timeToTrigger = triggerDate.getTime();
      
      // Resiliência: Se a data do agendamento for menor ou igual ao exato milissegundo 
      // da execução (Time Drift), forçamos um agendamento para daqui a 2 segundos.
      const safeTimestamp = timeToTrigger <= now ? now + 2000 : timeToTrigger;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: subtitle,
          sound: true,
        },
        // Ocultamos o conflito de TS do editor através do 'as any', pois 
        // a estrutura em tempo de execução está milimetricamente correta.
        trigger: {
          date: safeTimestamp, // Usa número (timestamp) em vez de Date para não quebrar o bridge Nativo
          channelId: 'default', // Obriga o Android 13+ a tocar o som e exibir banner
        } as any, 
      });
      
      console.log(`[NotificationService] Agendado com sucesso para ${new Date(safeTimestamp).toISOString()} (ID: ${notificationId})`);
      return notificationId;

    } catch (error) {
      console.error('[NotificationService] Falha estrutural ao agendar notificação:', error);
      throw error; 
    }
  }
}