import 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import Routes from './src/routes/index.routes';
import { ReminderProvider } from './src/contexts/ReminderContext'; // Importe o Provider
import { NavigationContainer } from '@react-navigation/native';

export default function App() {
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