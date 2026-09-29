import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

// Contextos
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { ReminderProvider } from './src/contexts/ReminderContext';
import { ProfileProvider } from './src/contexts/ProfileContext';

// Rotas e Serviços
import Routes from './src/routes/index.routes';
import { NotificationService } from './src/services/NotificationService'; 

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
          </NavigationContainer>
        </ReminderProvider>
      </ProfileProvider>
    </AccessibilityProvider>
  );
}

const styles = StyleSheet.create({
  // Seus estilos aqui
});