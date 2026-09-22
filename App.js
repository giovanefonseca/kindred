// import 'react-native-gesture-handler';
// import { StyleSheet } from 'react-native';

// import Routes from './src/routes/index.routes';
// import { ReminderProvider } from './src/contexts/ReminderContext'; // Importe o Provider
// import { NavigationContainer } from '@react-navigation/native';

// export default function App() {
//   return (
//     <ReminderProvider>
//        <NavigationContainer>
//           <Routes />
//        </NavigationContainer>
//     </ReminderProvider>
//   );
// }

// const styles = StyleSheet.create({
//   // Seus estilos aqui
// });

import 'react-native-gesture-handler';
import React, { useEffect } from 'react'; // Importação do useEffect adicionada
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import Routes from './src/routes/index.routes';
import { ReminderProvider } from './src/contexts/ReminderContext';
// Importe o NotificationService (Ajuste o caminho conforme a sua estrutura de pastas)
import { NotificationService } from './src/services/NotificationService'; 

export default function App() {
  
  // Efeito colateral de montagem (Executa apenas 1 vez ao abrir o app)
  useEffect(() => {
    async function setupAppInfrastructure() {
      try {
        await NotificationService.initialize();
        // Opcional: Logs de auditoria para ambiente de desenvolvimento
        // console.log('[App] Infraestrutura de notificações inicializada.');
      } catch (error) {
        // Resiliência: Evita que um erro na API nativa crashe a tela inicial (White Screen of Death)
        console.error('[App] Falha crítica ao inicializar notificações:', error);
      }
    }

    setupAppInfrastructure();
  }, []); // Array de dependências vazio garante execução única (Singleton behavior no startup)

  return (
    <ReminderProvider>
       <NavigationContainer>
          <Routes />
       </NavigationContainer>
    </ReminderProvider>
  );
}

const styles = StyleSheet.create({
  // Seus estilos aqui
});