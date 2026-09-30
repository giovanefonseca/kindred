import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

// Importações do Firebase
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig'; // Ajuste o caminho conforme o seu projeto

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

    // Ouvinte em tempo real do Firebase com suporte a dependentes
    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (user) {
                let remindersRef;
                const currentUserUid = user.uid;

                try {
                    // Tenta verificar se existem dependentes ou se o contexto atual possui um dependente ativo.
                    // Como o Provider é global, por segurança escutamos a raiz do usuário logado,
                    // mas garantimos flexibilidade caso precise apontar para rotas específicas.
                    remindersRef = collection(db, 'users', currentUserUid, 'reminders');
                } catch (e) {
                    remindersRef = collection(db, 'users', currentUserUid, 'reminders');
                }

                const q = query(
                    remindersRef,
                    orderBy('criadoEm', 'desc')
                );

                const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                    const fetchedReminders = snapshot.docs.map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    })) as NotificationReminder[];
                    
                    setReminders(fetchedReminders);
                }, (error) => {
                    console.log("Erro no listener de lembretes:", error);
                });

                return () => unsubscribeSnapshot();
            } else {
                setReminders([]);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const addReminder = useCallback((data: Omit<NotificationReminder, 'id' | 'createdAt' | 'isRead'>) => {
        const newReminder: NotificationReminder = {
            ...data,
            id: `temp_${Date.now()}`,
            createdAt: new Date().toISOString(),
            isRead: false,
        };
        setReminders((prev) => [newReminder, ...prev]);
    }, []);

    const markAsRead = useCallback(async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        setReminders((prev) =>
            prev.map((rmd) => (rmd.id === id ? { ...rmd, isRead: true } : rmd))
        );

        try {
            const reminderRef = doc(db, 'users', userId, 'reminders', id);
            await updateDoc(reminderRef, { isRead: true });
        } catch (error) {
            console.log("Erro ao marcar como lido no Firebase:", error);
        }
    }, []);

    const removeReminder = useCallback(async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        setReminders((prev) => prev.filter((rmd) => rmd.id !== id));

        try {
            const reminderRef = doc(db, 'users', userId, 'reminders', id);
            await deleteDoc(reminderRef);
        } catch (error) {
            console.log("Erro ao excluir do Firebase:", error);
        }
    }, []);

    return (
        <ReminderContext.Provider value={{ reminders, addReminder, markAsRead, removeReminder }}>
            {children}
        </ReminderContext.Provider>
    );
};

export const useReminders = (): ReminderContextData => {
    const context = useContext(ReminderContext);
    if (!context) {
        throw new Error('useReminders deve ser usado dentro de um ReminderProvider');
    }
    return context;
};