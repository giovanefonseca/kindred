import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const MIN_LEAD_TIME_MS = 2000;
const CHANNEL_ID = 'default';

export class NotificationService {
    static async initialize(): Promise<void> {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
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
            if (existingStatus === 'granted') return true;

            const { status } = await Notifications.requestPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('[NotificationService] Erro ao solicitar permissões:', error);
            return false;
        }
    }

    /**
     * Agenda um alarme único.
     * Retorna o ID da notificação, ou null se não foi agendada
     * (data inválida, data no passado ou permissão negada).
     * Datas no passado NÃO são disparadas imediatamente.
     */
    static async scheduleReminder(
        title: string,
        subtitle: string,
        triggerDate: Date
    ): Promise<string | null> {
        try {
            const time = triggerDate?.getTime?.();

            if (typeof time !== 'number' || Number.isNaN(time)) {
                console.warn('[NotificationService] Data inválida, agendamento ignorado.');
                return null;
            }

            if (time <= Date.now() + MIN_LEAD_TIME_MS) {
                console.warn(
                    `[NotificationService] Data no passado (${new Date(time).toISOString()}), ignorado: "${title}"`
                );
                // DEBUG TEMPORÁRIO: mostra quem chamou. Remova depois de achar a origem.
                console.warn(new Error('Quem chamou scheduleReminder').stack);
                return null;
            }

            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                console.warn('[NotificationService] Agendamento cancelado: permissão negada.');
                return null;
            }

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body: subtitle,
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: time,
                    channelId: CHANNEL_ID,
                },
            });

            console.log(
                `[NotificationService] Agendado para ${new Date(time).toISOString()} (ID: ${notificationId})`
            );
            return notificationId;
        } catch (error) {
            console.error('[NotificationService] Falha ao agendar notificação:', error);
            throw error;
        }
    }

    /**
     * Agenda um alarme que se repete todos os dias no mesmo horário.
     * Retorna o ID ou null (horário inválido ou permissão negada).
     */
    static async scheduleDailyReminder(
        title: string,
        subtitle: string,
        hour: number,
        minute: number
    ): Promise<string | null> {
        try {
            if (
                !Number.isInteger(hour) ||
                !Number.isInteger(minute) ||
                hour < 0 ||
                hour > 23 ||
                minute < 0 ||
                minute > 59
            ) {
                console.warn('[NotificationService] Horário inválido para alarme diário.');
                return null;
            }

            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                console.warn('[NotificationService] Permissão negada, alarme diário não agendado.');
                return null;
            }

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body: subtitle,
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour,
                    minute,
                    channelId: CHANNEL_ID,
                },
            });

            console.log(
                `[NotificationService] Alarme diário ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (ID: ${notificationId})`
            );
            return notificationId;
        } catch (error) {
            console.error('[NotificationService] Falha ao agendar alarme diário:', error);
            throw error;
        }
    }

    /** Cancela um alarme específico. Não faz nada se o ID for vazio. */
    static async cancelReminder(notificationId?: string | null): Promise<void> {
        if (!notificationId) return;
        try {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
            console.log(`[NotificationService] Notificação cancelada (ID: ${notificationId})`);
        } catch (error) {
            console.warn(
                `[NotificationService] Não foi possível cancelar (ID: ${notificationId}):`,
                error
            );
        }
    }

    /**
     * Cancela todos os alarmes e limpa a bandeja.
     * Use só pontualmente (por exemplo, uma vez para limpar alarmes antigos).
     * NÃO deixe chamado no useEffect do App, senão apaga tudo a cada abertura.
     */
    static async cancelAll(): Promise<void> {
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            await Notifications.dismissAllNotificationsAsync();
        } catch (error) {
            console.warn('[NotificationService] Falha ao cancelar todas:', error);
        }
    }
}