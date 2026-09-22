import { NotificationService } from '../NotificationService';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve inicializar o canal de notificação no Android', async () => {
    Platform.OS = 'android';
    await NotificationService.initialize();
    
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.any(Object));
  });

  it('deve solicitar permissão e disparar a notificação se concedido', async () => {
    // Mock: Usuário concedeu permissão
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

    await NotificationService.triggerLocalNotification();

    expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: null })
    );
  });

  it('NÃO deve disparar a notificação se a permissão for negada', async () => {
    // Mock: Usuário negou permissão
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await NotificationService.triggerLocalNotification();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});