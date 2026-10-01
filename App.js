import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
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

// Componente que usa o hook e exibe o modal customizado de alerta
function FallDetectorOverlay() {
  const [emergencyContacts, setEmergencyContacts] = useState([]);

  // Contexto Global de Acessibilidade
  const accessibility = useAccessibility();
  const fontScale = accessibility?.fontScale ?? 1;
  const isHighContrast = accessibility?.isHighContrast ?? false;
  const theme = accessibility?.theme ?? {
    background: '#FFFFFF',
    cardBackground: '#FFFFFF',
    border: '#CBD5E1',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    buttonPrimary: '#198754',
    buttonText: '#FFFFFF',
  };

  useEffect(() => {
    async function loadContacts() {
      try {
        const stored = await AsyncStorage.getItem('@emergency_contacts');
        if (stored) {
          setEmergencyContacts(JSON.parse(stored));
        }
      } catch (error) {
        console.error('[App] Falha ao carregar contatos de emergência:', error);
      }
    }
    loadContacts();
  }, []);

  const { modalVisible, countdown, handleFalseAlarm, handleConfirmEmergency } =
    useFallDetector(emergencyContacts);

  return (
    <CustomNotificationModal
      visible={modalVisible}
      title="QUEDA DETECTADA!"
      subtitle={`Ligando para o contato de emergência em ${countdown}s`}
      iconName="alert-decagram-outline"
      iconColor={isHighContrast ? theme.buttonPrimary : (themes.colors.darkRed || '#D32F2F')}
      closeText="PRECISO DE AJUDA"
      closeButtonColor={isHighContrast ? theme.buttonPrimary : (themes.colors.darkRed || '#D32F2F')}
      onClose={handleConfirmEmergency}
    >
      <View style={styles.childrenWrapper}>
        <Text
          style={[
            styles.countdownText,
            { fontSize: 64 * fontScale },
            isHighContrast && { color: theme.textPrimary }
          ]}
        >
          {countdown}
        </Text>

        <TouchableOpacity
          style={[
            styles.okButton,
            isHighContrast && { backgroundColor: theme.buttonPrimary }
          ]}
          activeOpacity={0.8}
          onPress={handleFalseAlarm}
          accessibilityRole="button"
          accessibilityLabel="Estou bem, cancelar alerta de queda"
        >
          <MaterialCommunityIcons name="check-circle-outline" size={28} color="#FFFFFF" />
          <Text style={[styles.okButtonText, { fontSize: 18 * fontScale }]}>
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
    <AccessibilityProvider>
      <ProfileProvider>
        <ReminderProvider>
          <NavigationContainer>
            <Routes />
            <FallDetectorOverlay />
          </NavigationContainer>
        </ReminderProvider>
      </ProfileProvider>
    </AccessibilityProvider>
  );
}

const styles = StyleSheet.create({
  childrenWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    marginVertical: 12,
  },
  countdownText: {
    fontSize: 64,
    fontWeight: '900',
    color: themes.colors.darkRed || '#D32F2F',
    textAlign: 'center',
  },
  okButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themes.colors.secureGreen || '#2E7D32',
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