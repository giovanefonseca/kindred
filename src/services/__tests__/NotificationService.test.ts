import * as Notifications from 'expo-notifications';
import { NotificationService } from '../NotificationService';

// Mock do expo-notifications
jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
}));

describe('NotificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('deve solicitar permissão e retornar true se concedida', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

        const result = await NotificationService.requestPermissions();
        
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    it('deve agendar uma notificação se a permissão for concedida', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('mock-id-123');

        const triggerDate = new Date('2030-01-01T12:00:00Z');
        const result = await NotificationService.scheduleReminder('Teste', 'Corpo', triggerDate);

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
            content: { title: 'Teste', body: 'Corpo', sound: true, data: { route: 'ReminderDetails' } },
            trigger: { type: 'date', date: triggerDate },
        });
        expect(result).toBe('mock-id-123');
    });

    it('não deve agendar se a permissão for negada', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
        
        const result = await NotificationService.scheduleReminder('Teste', 'Corpo', new Date());

        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });
});