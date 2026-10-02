import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Contextos
import { AccessibilityProvider, useAccessibility } from './src/contexts/AccessibilityContext';
import { ReminderProvider } from './src/contexts/ReminderContext';
import { ProfileProvider } from './src/contexts/ProfileContext';

// Rotas e Serviços
import Routes from './src/routes/index.routes';
import { NotificationService } from './src/services/NotificationService';
import { themes } from './src/global/themes';

// Componente CustomNotificationModal
import { CustomNotificationModal } from './src/components/CustomNotificationModal/CustomNotificationModal';

// Hook de detecção de queda
import { useFallDetector } from './src/hooks/useFallDetector';

const EMERGENCY_CONTACTS_KEY = '@emergency_contacts';
const DANGER_COLOR = themes.colors.darkRed || '#D32F2F';
const SUCCESS_COLOR = themes.colors.secureGreen || '#2E7D32';

const DEFAULT_THEME = {
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',
  border: '#CBD5E1',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  buttonPrimary: '#198754',
  buttonText: '#FFFFFF',
};

// Componente que usa o hook e exibe o modal customizado de alerta
function FallDetectorOverlay() {
  const [emergencyContacts, setEmergencyContacts] = useState<string[]>([]);

  const accessibility = useAccessibility();
  const fontScale = accessibility?.fontScale ?? 1;
  const isHighContrast = accessibility?.isHighContrast ?? false;
  const theme = accessibility?.theme ?? DEFAULT_THEME;

  const loadContacts = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(EMERGENCY_CONTACTS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const next: string[] = Array.isArray(parsed)
        ? parsed.filter((c): c is string => typeof c === 'string')
        : [];

      // Só atualiza se o conteúdo mudou (evita reiniciar efeitos no hook)
      setEmergencyContacts((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    } catch (error) {
      console.error('[App] Falha ao carregar contatos de emergência:', error);
    }
  }, []);

  // Carrega na montagem e recarrega sempre que o app volta ao primeiro plano
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    loadContacts();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        loadContacts();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [loadContacts]);

  const { modalVisible, countdown, handleFalseAlarm, handleConfirmEmergency } =
    useFallDetector(emergencyContacts);

  return (
    <CustomNotificationModal
      visible={modalVisible}
      title="QUEDA DETECTADA!"
      subtitle={`Ligando para emergência em ${countdown}s`}
      iconName="alert-decagram-outline"
      iconColor={isHighContrast ? theme.buttonPrimary : DANGER_COLOR}
      closeText="PRECISO DE AJUDA"
      closeButtonColor={isHighContrast ? theme.buttonPrimary : DANGER_COLOR}
      onClose={handleConfirmEmergency}
    >
      <View style={styles.childrenWrapper}>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.countdownText,
            { fontSize: 64 * fontScale },
            isHighContrast && { color: theme.textPrimary },
          ]}
        >
          {countdown}
        </Text>

        <TouchableOpacity
          style={[
            styles.okButton,
            isHighContrast && { backgroundColor: theme.buttonPrimary },
          ]}
          activeOpacity={0.8}
          onPress={handleFalseAlarm}
          accessibilityRole="button"
          accessibilityLabel="Estou bem, cancelar alerta de queda"
        >
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={28}
            color={isHighContrast ? theme.buttonText : '#FFFFFF'}
          />
          <Text
            style={[
              styles.okButtonText,
              { fontSize: 18 * fontScale },
              isHighContrast && { color: theme.buttonText },
            ]}
          >
            ESTOU BEM (FALSO ALARME)
          </Text>
        </TouchableOpacity>
      </View>
    </CustomNotificationModal>
  );
}

export default function App() {
  useEffect(() => {
    async function setupAppInfrastructure() {
      try {
        await NotificationService.initialize();
      } catch (error) {
        console.error('[App] Falha crítica ao inicializar notificações:', error);
      }
    }

    setupAppInfrastructure();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <AccessibilityProvider>
        <ProfileProvider>
          <ReminderProvider>
            <NavigationContainer>
              <Routes />
            </NavigationContainer>
            <FallDetectorOverlay />
          </ReminderProvider>
        </ProfileProvider>
      </AccessibilityProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  childrenWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    marginVertical: 12,
  },
  countdownText: {
    fontSize: 64,
    fontWeight: '900',
    color: DANGER_COLOR,
    textAlign: 'center',
  },
  okButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS_COLOR,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    gap: 10,
    elevation: 3,
  },
  okButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});