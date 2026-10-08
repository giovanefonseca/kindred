import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';

export type DailyLogType = 'remedio' | 'agua' | 'recado' | 'emergencia';
export type DailyLogStatus = 'concluido' | 'pendente' | 'atrasado';

export interface CreateDailyLogDTO {
    dependentUid: string;
    tipo: DailyLogType;
    titulo: string;
    status: DailyLogStatus; // obrigatório: evita logs invisíveis por default errado
    descricao?: string;
    horario?: string;
    dataStr?: string; // YYYY-MM-DD
    quantidadeMl?: number;
    refId?: string; // id da nota/lembrete de origem
}

const pad = (n: number) => String(n).padStart(2, '0');

const logsCollection = (dependentUid: string) =>
    collection(db, 'users', dependentUid, 'dailyLogs');

const buildPayload = (dto: Omit<CreateDailyLogDTO, 'dependentUid'>) => {
    const now = new Date();
    const payload: Record<string, any> = {
        tipo: dto.tipo,
        titulo: dto.titulo,
        descricao: dto.descricao ?? '',
        horario: dto.horario ?? `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        data: dto.dataStr ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        status: dto.status,
        criadoPor: auth.currentUser?.uid ?? null,
        timestamp: serverTimestamp(),
    };
    if (dto.quantidadeMl !== undefined) payload.quantidadeMl = dto.quantidadeMl;
    if (dto.refId) payload.refId = dto.refId;
    return payload;
};

export const DailyLogService = {
    buildPayload,
    logsCollection,

    /** Registra um evento em users/{dependentUid}/dailyLogs */
    async addLog(dto: CreateDailyLogDTO): Promise<string> {
        if (!dto.dependentUid) {
            throw new Error('UID do dependente é obrigatório para registrar log diário.');
        }
        const ref = await addDoc(logsCollection(dto.dependentUid), buildPayload(dto));
        return ref.id;
    },

    /** Para uso dentro de um writeBatch (atomicidade com notes, total de água etc.) */
    addLogToBatch(batch: ReturnType<typeof writeBatch>, dto: CreateDailyLogDTO): string {
        if (!dto.dependentUid) {
            throw new Error('UID do dependente é obrigatório para registrar log diário.');
        }
        const ref = doc(logsCollection(dto.dependentUid));
        batch.set(ref, buildPayload(dto));
        return ref.id;
    },
};