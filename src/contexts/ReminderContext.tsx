import React, { createContext, useState, useContext, useCallback } from 'react';

// 1. Definição das Entidades de Domínio
export interface NotificationReminder {
    id: string;
    title: string;
    subtitle: string;
    categoryKey: string;
    iconFamily: 'FontAwesome5' | 'MaterialCommunityIcons' | string;
    iconName: string;
    createdAt: string;
    isRead: boolean;
}

interface ReminderContextData {
    reminders: NotificationReminder[];
    addReminder: (reminder: Omit<NotificationReminder, 'id' | 'createdAt' | 'isRead'>) => void;
    markAsRead: (id: string) => void;
    removeReminder: (id: string) => void;
}

const ReminderContext = createContext<ReminderContextData>({} as ReminderContextData);

export const ReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [reminders, setReminders] = useState<NotificationReminder[]>([]);

    // 2. Casos de Uso (Use Cases) encapsulados
    const addReminder = useCallback((data: Omit<NotificationReminder, 'id' | 'createdAt' | 'isRead'>) => {
        const newReminder: NotificationReminder = {
            ...data,
            id: `rmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            isRead: false,
        };
        
        // Adiciona no topo da lista (mais recentes primeiro)
        setReminders((prev) => [newReminder, ...prev]);
    }, []);

    const markAsRead = useCallback((id: string) => {
        setReminders((prev) =>
            prev.map((rmd) => (rmd.id === id ? { ...rmd, isRead: true } : rmd))
        );
    }, []);

    const removeReminder = useCallback((id: string) => {
        setReminders((prev) => prev.filter((rmd) => rmd.id !== id));
    }, []);

    return (
        <ReminderContext.Provider value={{ reminders, addReminder, markAsRead, removeReminder }}>
            {children}
        </ReminderContext.Provider>
    );
};

// 3. Hook customizado para injeção limpa nos componentes
export const useReminders = (): ReminderContextData => {
    const context = useContext(ReminderContext);
    if (!context) {
        throw new Error('useReminders deve ser usado dentro de um ReminderProvider');
    }
    return context;
};