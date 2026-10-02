import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    addDoc,
    Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { NotificationService } from '../services/NotificationService';

export interface NotificationReminder {
    id: string;
    title: string;
    subtitle: string;
    categoryKey: string;
    iconFamily: 'FontAwesome5' | 'MaterialCommunityIcons' | string;
    iconName: string;
    createdAt: string;
    isRead: boolean;
    notificationId: string | null;
    dataAgendamento: string | null;
}

type NewReminder = Omit<
    NotificationReminder,
    'id' | 'createdAt' | 'isRead' | 'notificationId' | 'dataAgendamento'
> & {
    notificationId?: string | null;
    dataAgendamento?: string | null;
};

interface ReminderContextData {
    reminders: NotificationReminder[];
    addReminder: (reminder: NewReminder) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    removeReminder: (id: string) => Promise<void>;
}

const ReminderContext = createContext<ReminderContextData | undefined>(undefined);

// Converte Timestamp do Firestore, string ou ausente em string ISO
function toIsoString(value: any): string {
    if (!value) return new Date(0).toISOString();
    if (typeof value === 'string') return value;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    return new Date(0).toISOString();
}

export const ReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [reminders, setReminders] = useState<NotificationReminder[]>([]);

    // Referência sempre atualizada, para os callbacks lerem sem mudar de identidade
    const remindersRef = useRef<NotificationReminder[]>([]);
    useEffect(() => {
        remindersRef.current = reminders;
    }, [reminders]);

    useEffect(() => {
        let unsubscribeSnapshot: Unsubscribe | null = null;

        const stopSnapshot = () => {
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
        };

        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            // Sempre encerra o listener anterior antes de criar outro
            stopSnapshot();

            if (!user) {
                setReminders([]);
                return;
            }

            // Sem orderBy: o Firestore excluiria documentos sem o campo "criadoEm".
            // A ordenação é feita no cliente.
            unsubscribeSnapshot = onSnapshot(
                collection(db, 'users', user.uid, 'reminders'),
                (snapshot) => {
                    const fetched = snapshot.docs.map((docSnap) => {
                        const data = docSnap.data();
                        return {
                            id: docSnap.id,
                            title: data.title ?? '',
                            subtitle: data.subtitle ?? '',
                            categoryKey: data.categoryKey ?? '',
                            iconFamily: data.iconFamily ?? 'MaterialCommunityIcons',
                            iconName: data.iconName ?? 'bell',
                            createdAt: toIsoString(data.createdAt ?? data.criadoEm),
                            isRead: data.isRead === true,
                            notificationId: data.notificationId ?? null,
                            dataAgendamento: data.dataAgendamento ?? null,
                        } as NotificationReminder;
                    });

                    fetched.sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );
                    setReminders(fetched);
                },
                (error) => {
                    console.error('Erro no listener de lembretes:', error);
                }
            );
        });

        return () => {
            stopSnapshot();
            unsubscribeAuth();
        };
    }, []);

    const addReminder = useCallback(async (data: NewReminder) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            // O snapshot atualiza a lista automaticamente
            await addDoc(collection(db, 'users', userId, 'reminders'), {
                ...data,
                notificationId: data.notificationId ?? null,
                dataAgendamento: data.dataAgendamento ?? null,
                isRead: false,
                criadoEm: new Date().toISOString(), // mesmo formato dos subforms
            });
        } catch (error) {
            console.error('Erro ao adicionar lembrete no Firebase:', error);
        }
    }, []);

    const markAsRead = useCallback(async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        setReminders((prev) =>
            prev.map((rmd) => (rmd.id === id ? { ...rmd, isRead: true } : rmd))
        );

        try {
            await updateDoc(doc(db, 'users', userId, 'reminders', id), { isRead: true });
        } catch (error) {
            console.error('Erro ao marcar como lido no Firebase:', error);
        }
    }, []);

    const removeReminder = useCallback(async (id: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Cancela o alarme agendado junto com o lembrete
        const notificationId = remindersRef.current.find((r) => r.id === id)?.notificationId;
        await NotificationService.cancelReminder(notificationId);

        setReminders((prev) => prev.filter((rmd) => rmd.id !== id));

        try {
            await deleteDoc(doc(db, 'users', userId, 'reminders', id));
        } catch (error) {
            console.error('Erro ao excluir do Firebase:', error);
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