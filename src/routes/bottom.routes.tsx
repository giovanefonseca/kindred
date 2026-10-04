import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import List from '../pages/homepage';
import User from '../pages/user';
import CustomTabBar from '../components/CustomTabBar';

// Importação do Contexto Global de Acessibilidade
import { useAccessibility } from '../contexts/AccessibilityContext';

const Tab = createBottomTabNavigator();

export default function BottomRoutes() {
    const { theme } = useAccessibility();

    return (
        <Tab.Navigator
            id="bottomTab"
            screenOptions={{
                headerShown: false,
                animation: 'shift', // Transição suave entre as abas
                sceneStyle: {
                    backgroundColor: theme.background, // Fundo escuro/alto contraste injetado aqui
                },
            }}
            tabBar={props => <CustomTabBar {...props} />}
        >
            <Tab.Screen
                name="List"
                component={List}
            />
            <Tab.Screen
                name="User"
                component={User}
            />
        </Tab.Navigator>
    );
}