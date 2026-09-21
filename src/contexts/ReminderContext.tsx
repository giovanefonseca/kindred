import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

// Importações do Firebase
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

    // NOVO: Ouvinte em tempo real do Firebase (Sincronização Automática)
    useEffect(() => {
        // Observa se há um utilizador logado
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (user) {
                // Cria a query para buscar os lembretes ordenados do mais recente para o mais antigo
                const q = query(
                    collection(db, 'users', user.uid, 'reminders'),
                    orderBy('criadoEm', 'desc')
                );

                // onSnapshot fica a "ouvir" o banco de dados continuamente
                const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                    const fetchedReminders = snapshot.docs.map(doc => ({
                        id: doc.id, // ID real do documento no Firebase
                        ...doc.data()
                    })) as NotificationReminder[];
                    
                    setReminders(fetchedReminders); // Atualiza a tela instantaneamente
                });

                return () => unsubscribeSnapshot(); // Limpa o ouvinte ao desmontar
            } else {
                setReminders([]); // Limpa os lembretes se o utilizador sair da conta
            }
        });

        return () => unsubscribeAuth();
    }, []);

    // 2. Casos de Uso (Use Cases) encapsulados
    
    // Mantivemos a função addReminder para compatibilidade com o seu código do SetReminderView.
    // Como o onSnapshot já está a atualizar a tela automaticamente, ela agora funciona apenas como um backup local rápido.
    const addReminder = useCallback((data: Omit<NotificationReminder, 'id' | 'createdAt' | 'isRead'>) => {
        const newReminder: NotificationReminder = {
            ...data,
            id: `temp_${Date.now()}`, // ID temporário que será rapidamente substituído pelo ID do Firebase
            createdAt: new Date().toISOString(),
            isRead: false,
        };
        setReminders((prev) => [newReminder, ...prev]);
    }, []);

    // ATUALIZADO: Marca como lido no Firebase
    const markAsRead = useCallback(async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Atualiza visualmente primeiro (Optimistic UI)
        setReminders((prev) =>
            prev.map((rmd) => (rmd.id === id ? { ...rmd, isRead: true } : rmd))
        );

        // Envia a alteração para o Firebase
        try {
            const reminderRef = doc(db, 'users', userId, 'reminders', id);
            await updateDoc(reminderRef, { isRead: true });
        } catch (error) {
            console.log("Erro ao marcar como lido no Firebase:", error);
        }
    }, []);

    // ATUALIZADO: Apaga do Firebase
    const removeReminder = useCallback(async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Atualiza visualmente primeiro (Optimistic UI)
        setReminders((prev) => prev.filter((rmd) => rmd.id !== id));

        // Envia a exclusão para o Firebase
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

// 3. Hook customizado para injeção limpa nos componentes
export const useReminders = (): ReminderContextData => {
    const context = useContext(ReminderContext);
    if (!context) {
        throw new Error('useReminders deve ser usado dentro de um ReminderProvider');
    }
    return context;
};