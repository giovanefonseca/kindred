import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// 1. Handler global — define como a notificação se comporta em foreground
//    Chame isso UMA VEZ, no ponto de entrada do app (App.tsx / _layout.tsx)
// ---------------------------------------------------------------------------
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// ---------------------------------------------------------------------------
// 2. Canal de notificação (obrigatório no Android 8+)
//    Chame isso também no início do app, uma única vez.
// ---------------------------------------------------------------------------
export async function setupNotificationChannel() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('lembretes', {
            name: 'Lembretes',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
    }
}

// ---------------------------------------------------------------------------
// 2.1 Permissão de alarme exato (Android 12+ / obrigatório na prática a
//     partir do Android 13-14, onde vem negada por padrão).
//     Sem essa permissão, o SO ainda dispara a notificação, mas com atraso
//     (o famoso "10 a 30 segundos depois do horário marcado").
//
//     Essa permissão NÃO é pedida com um popup comum — o usuário precisa
//     conceder manualmente numa tela do sistema. Por isso abrimos essa tela
//     diretamente. Chame `ensureExactAlarmPermission()` uma vez, por exemplo
//     logo depois de `requestNotificationPermission()`.
// ---------------------------------------------------------------------------
export async function ensureExactAlarmPermission(): Promise<void> {
    if (Platform.OS !== 'android') return;

    // A permissão só existe a partir da API 31 (Android 12).
    // Platform.Version no Android é o SDK int.
    const sdkInt = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (!sdkInt || sdkInt < 31) return;

    try {
        // Abre diretamente a tela do sistema "Alarmes e lembretes" para este app.
        // Não há como checar `canScheduleExactAlarms()` puro via JS sem um
        // módulo nativo extra, então abrimos a tela e deixamos o usuário decidir.
        // Se a permissão já tiver sido concedida, o Android mostra a tela com
        // o toggle já ativado (não atrapalha, mas idealmente chame isso só uma
        // vez — veja a nota no final do arquivo sobre persistir esse estado).
        await IntentLauncher.startActivityAsync(
            'android.settings.REQUEST_SCHEDULE_EXACT_ALARM' as IntentLauncher.ActivityAction,
            { data: 'package:com.anonymous.kindred' }
        );
    } catch (error) {
        console.warn('[Notification] Não foi possível abrir tela de alarme exato:', error);
    }
}

// ---------------------------------------------------------------------------
// 3. Pedido de permissão (necessário, principalmente Android 13+ / iOS)
// ---------------------------------------------------------------------------
export async function requestNotificationPermission(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

// ---------------------------------------------------------------------------
// 4. Agendamento do lembrete
// ---------------------------------------------------------------------------
interface ScheduleReminderParams {
    title: string;
    body?: string;
    subtitle?: string;
    date: Date | string;
    repeatDaily: boolean;
    data?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// 5. Cancelamento de notificações
// ---------------------------------------------------------------------------
export async function cancelReminderNotification(notificationId?: string | null) {
    if (!notificationId) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        console.log(`[Notification] Cancelada com sucesso (ID: ${notificationId}).`);
    } catch (error) {
        // Não é erro grave: pode já ter disparado/expirado
        console.warn(`[Notification] Não foi possível cancelar (ID: ${notificationId}):`, error);
    }
}

export async function scheduleLocalReminder({
    title,
    body,
    subtitle,
    date,
    repeatDaily,
    data = {},
}: ScheduleReminderParams) {
    // Garante permissão antes de tentar agendar
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
        console.warn('[Notification] Permissão negada pelo usuário.');
        return null;
    }

    const uniqueId = `reminder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const targetDate = new Date(date);
    const now = new Date();

    if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    // Trigger no formato atual (com "type" explícito)
    const trigger: Notifications.NotificationTriggerInput = repeatDaily
        ? {
              type: SchedulableTriggerInputTypes.DAILY,
              hour: targetDate.getHours(),
              minute: targetDate.getMinutes(),
          }
        : {
              type: SchedulableTriggerInputTypes.DATE,
              date: targetDate,
          };

    try {
        const notificationId = await Notifications.scheduleNotificationAsync({
            identifier: uniqueId,
            content: {
                title,
                body: body || subtitle || '',
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                data,
            },
            trigger: Platform.OS === 'android'
                ? { ...trigger, channelId: 'lembretes' } // 👈 essencial no Android
                : trigger,
        });

        console.log(
            `[Notification] Agendado com sucesso (ID: ${notificationId}). Repetir: ${repeatDaily}. Disparo real: ${targetDate.toLocaleString('pt-BR')}`
        );
        return notificationId;
    } catch (error) {
        console.error('[Notification] Erro ao agendar notificação:', error);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Como usar no ponto de entrada do app (App.tsx / _layout.tsx):
//
//   useEffect(() => {
//     setupNotificationChannel();
//     requestNotificationPermission().then((granted) => {
//       if (granted) ensureExactAlarmPermission();
//     });
//   }, []);
//
// Dica: como abrir a tela de configurações toda vez que o app inicia
// pode incomodar o usuário, considere guardar um flag (ex: AsyncStorage
// "exact_alarm_prompt_shown") e só chamar ensureExactAlarmPermission()
// se esse flag ainda não existir.
// ---------------------------------------------------------------------------