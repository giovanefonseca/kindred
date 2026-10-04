import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

export type DailyLogType = 'remedio' | 'agua' | 'recado' | 'emergencia';
export type DailyLogStatus = 'concluido' | 'pendente' | 'atrasado';

export interface CreateDailyLogDTO {
    dependentUid: string;
    tipo: DailyLogType;
    titulo: string;
    descricao?: string;
    horario?: string;
    dataStr?: string; // Formato YYYY-MM-DD
    quantidadeMl?: number;
    status?: DailyLogStatus;
}

export const DailyLogService = {
    /**
     * Registra um novo evento diário na subcoleção dailyLogs do dependente.
     */
    async addLog({
        dependentUid,
        tipo,
        titulo,
        descricao = '',
        horario,
        dataStr,
        quantidadeMl,
        status = 'pendente'
    }: CreateDailyLogDTO): Promise<string> {
        if (!dependentUid) {
            throw new Error('UID do dependente é obrigatório para registrar log diário.');
        }

        const now = new Date();

        // Formatação de data respeitando fuso local (YYYY-MM-DD)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const formattedDate = dataStr || `${year}-${month}-${day}`;

        // Formatação de hora local (HH:mm)
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const formattedTime = horario || `${hours}:${minutes}`;

        const logPayload: Record<string, any> = {
            tipo,
            titulo,
            descricao,
            horario: formattedTime,
            data: formattedDate,
            status,
            timestamp: serverTimestamp()
        };

        if (quantidadeMl !== undefined) {
            logPayload.quantidadeMl = quantidadeMl;
        }

        const logsRef = collection(db, 'users', dependentUid, 'dailyLogs');
        const docRef = await addDoc(logsRef, logPayload);
        return docRef.id;
    }
};