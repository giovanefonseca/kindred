import { NotificationService } from '../../services/NotificationService';

interface TriggerNotificationOptions {
  title: string;
  subtitle?: string;
  date?: Date | null;
}

/**
 * Função utilitária para agendar ou disparar notificações locais.
 */
export const triggerNotification = async ({
  title,
  subtitle = '',
  date = null,
}: TriggerNotificationOptions) => {
  try {
    // Se uma data válida for fornecida, usamos ela. Caso contrário, usamos a hora atual + 1s.
    const triggerDate = (date && !isNaN(date.getTime())) 
      ? date 
      : new Date(Date.now() + 1000);

    // Só agenda se a data for estritamente no futuro
    if (triggerDate.getTime() > Date.now()) {
      await NotificationService.scheduleReminder(
        title,
        subtitle,
        triggerDate
      );
      return { success: true };
    } else {
      console.warn('[Notification] Data informada já passou ou é atual. Agendamento ignorado.', triggerDate);
      return { success: false, reason: 'past_date' };
    }
  } catch (error) {
    console.error('[Notification] Erro ao agendar notificação:', error);
    return { success: false, error };
  }
};