export type NoteTypeKey =
    | 'Glicemia'
    | 'Pressão'
    | 'Oxigenação do sangue'
    | 'Medicação'
    | 'Temperatura corporal';

export interface BaseSubformProps<T> {
    data: T;
    onChange: (newData: T) => void;
    errors: Record<string, string>;
}

// 1. Glicemia
export interface GlicemiaFormData {
    valorMgDl: string;
    emJejum: boolean | null; // Sim (true) / Não (false)
}

export const initialGlicemiaData: GlicemiaFormData = {
    valorMgDl: '',
    emJejum: null,
};

// 2. Pressão Arterial
export interface PressaoFormData {
    sistolica: string;
    diastolica: string;
    postura: 'Sentado' | 'Deitado';
    braco: 'Direito' | 'Esquerdo';
    estadoEmocional: 'Calmo' | 'Estresse' | 'Dor';
}

export const initialPressaoData: PressaoFormData = {
    sistolica: '',
    diastolica: '',
    postura: 'Sentado',
    braco: 'Direito',
    estadoEmocional: 'Calmo',
};

// 3. Oxigenação do Sangue
export interface OxigenacaoFormData {
    spO2: string;
    frequenciaCardiacaBpm: string;
    nivelAtividade: 'Repouso' | 'Pós-esforço';
    sintomasRespiratorios: 'Nenhum' | 'Falta de ar' | 'Tosse' | 'Cansaço';
}

export const initialOxigenacaoData: OxigenacaoFormData = {
    spO2: '',
    frequenciaCardiacaBpm: '',
    nivelAtividade: 'Repouso',
    sintomasRespiratorios: 'Nenhum',
};

// 4. Medicação
export interface MedicacaoFormData {
    nomeMedicamento: string;
    dosagem: string;
    horarioInsercao: string; // Capturado automaticamente (ex: "11:00")
    horarioPlanejado: string; // ex: "08:00"
    reacoesAdversas: 'Nenhuma' | 'Tontura' | 'Enjoo' | 'Dor de cabeça' | 'Outras';
    alivioSintomas: 'Sim' | 'Parcial' | 'Não';
}

export function getCurrentTimeString(): string {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

export const initialMedicacaoData: MedicacaoFormData = {
    nomeMedicamento: '',
    dosagem: '',
    horarioInsercao: getCurrentTimeString(),
    horarioPlanejado: '',
    reacoesAdversas: 'Nenhuma',
    alivioSintomas: 'Sim',
};

// 5. Temperatura Corporal
export interface TemperaturaFormData {
    valorCelsius: string;
    localMedicao: 'Axila' | 'Boca' | 'Ouvido' | 'Testa';
    usoAntitermicos: boolean | null; // Sim (true) / Não (false)
    sintomasAssociados: string[]; // Seleção múltipla: 'Calafrios', 'Suor', 'Dor no corpo', etc.
}

export const initialTemperaturaData: TemperaturaFormData = {
    valorCelsius: '',
    localMedicao: 'Axila',
    usoAntitermicos: null,
    sintomasAssociados: [],
};

// Payload Unificado Final
export interface NoteSubmissionPayload {
    type: NoteTypeKey;
    timestamp: string;
    data:
        | GlicemiaFormData
        | PressaoFormData
        | OxigenacaoFormData
        | MedicacaoFormData
        | TemperaturaFormData;
}

