export type ReminderCategoryType = 'remedio' | 'consulta' | 'exame' | 'outros';

export interface EditableReminder {
    id: string;
    userId?: string;
    categoryKey?: ReminderCategoryType;
    notificationId?: string | null;
    dataAgendamento?: string | null;
    dadosFormulario?: {
        // comuns
        advanceHours?: number;
        repetirDiariamente?: boolean;
        // remédio
        nomeRemedio?: string;
        time?: string;
        // consulta
        medico?: string;
        especialidade?: string;
        levarExames?: boolean;
        dataConsulta?: string;
        // exame
        tipoExame?: string;
        exigeJejum?: boolean;
        dataExame?: string;
        // outros
        titulo?: string;
        dataEvento?: string;
    };
}

export interface SubformProps {
    editingReminder?: EditableReminder | null;
    activeUserId?: string;
    onSaveSuccess: (details?: string) => void;
    onSaveError: (errorMessage?: string) => void;
}