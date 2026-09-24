import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { cancelReminderNotification } from '../components/Notify';

function sanitizeForFirestore(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, sanitizeForFirestore(v)])
    );
}

/** Cria um novo lembrete. Retorna o ID do documento criado. */
export async function createReminder(
    userId: string,
    reminderData: Record<string, any>
): Promise<string> {
    const cleanData = sanitizeForFirestore(reminderData);
    const remindersRef = collection(db, 'users', userId, 'reminders');
    const docRef = await addDoc(remindersRef, cleanData);
    return docRef.id;
}

/**
 * Atualiza um lembrete existente.
 * IMPORTANTE: cancela a notificação antiga ANTES de sobrescrever,
 * para não deixar um alarme "fantasma" agendado com dados velhos.
 */
export async function updateReminder(
    userId: string,
    reminderId: string,
    oldNotificationId: string | null | undefined,
    reminderData: Record<string, any>
): Promise<void> {
    await cancelReminderNotification(oldNotificationId);

    const cleanData = sanitizeForFirestore(reminderData);
    const reminderRef = doc(db, 'users', userId, 'reminders', reminderId);
    await updateDoc(reminderRef, cleanData);
}

/**
 * Exclui um lembrete e cancela a notificação associada a ele.
 */
export async function deleteReminder(
    userId: string,
    reminderId: string,
    notificationId: string | null | undefined
): Promise<void> {
    await cancelReminderNotification(notificationId);

    const reminderRef = doc(db, 'users', userId, 'reminders', reminderId);
    await deleteDoc(reminderRef);
}