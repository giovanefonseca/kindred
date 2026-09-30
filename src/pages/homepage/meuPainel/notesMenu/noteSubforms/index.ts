import React from 'react';
import {
    NoteTypeKey,
    BaseSubformProps,
    GlicemiaFormData,
    PressaoFormData,
    OxigenacaoFormData,
    MedicacaoFormData,
    TemperaturaFormData,
    initialGlicemiaData,
    initialPressaoData,
    initialOxigenacaoData,
    initialMedicacaoData,
    initialTemperaturaData,
    getCurrentTimeString,
} from './types';

import { GlicemiaForm } from './GlicemiaForm';
import { PressaoForm } from './PressaoForm';
import { OxigenacaoForm } from './OxigenacaoForm';
import { MedicacaoForm } from './MedicacaoForm';
import { TemperaturaForm } from './TemperaturaForm';

export * from './types';

// ==========================================
// 1. STRATEGY REGISTRY DOS COMPONENTES
// ==========================================
export const SUBFORM_STRATEGY_REGISTRY: Record<
    NoteTypeKey,
    React.ComponentType<BaseSubformProps<any>>
> = {
    'Glicemia': GlicemiaForm,
    'Pressão': PressaoForm,
    'Oxigenação do sangue': OxigenacaoForm,
    'Medicação': MedicacaoForm,
    'Temperatura corporal': TemperaturaForm,
};

// ==========================================
// 2. FACTORY DE ESTADO INICIAL
// ==========================================
export function createInitialSubformData(typeKey: NoteTypeKey): any {
    const currentTime = getCurrentTimeString();

    switch (typeKey) {
        case 'Glicemia':
            return { 
                ...initialGlicemiaData, 
                emJejum: initialGlicemiaData?.emJejum ?? true // Garante 'SIM' (true) por padrão
            };

        case 'Pressão':
            return { 
                ...initialPressaoData 
            };

        case 'Oxigenação do sangue':
            return { 
                ...initialOxigenacaoData 
            };

        case 'Medicação':
            return { 
                ...initialMedicacaoData, 
                horarioInsercao: initialMedicacaoData?.horarioInsercao || currentTime,
                horarioPlanejado: initialMedicacaoData?.horarioPlanejado || currentTime,
            };

        case 'Temperatura corporal':
            return { 
                ...initialTemperaturaData, 
                sintomasAssociados: initialTemperaturaData?.sintomasAssociados ?? [] 
            };

        default:
            return {};
    }
}

// ==========================================
// 3. ESTRATÉGIA DE VALIDAÇÃO ISOLADA
// ==========================================
export function validateSubformData(
    typeKey: NoteTypeKey,
    data: any
): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const safeData = data || {};

    switch (typeKey) {
        case 'Glicemia': {
            const gData = safeData as Partial<GlicemiaFormData>;
            if (!gData.valorMgDl || !gData.valorMgDl.trim()) {
                errors.valorMgDl = 'Por favor, informe o valor da glicemia.';
            }
            break;
        }

        case 'Pressão': {
            const pData = safeData as Partial<PressaoFormData>;
            if (!pData.sistolica || !pData.sistolica.trim()) {
                errors.sistolica = 'Informe a pressão sistólica.';
            }
            if (!pData.diastolica || !pData.diastolica.trim()) {
                errors.diastolica = 'Informe a pressão diastólica.';
            }
            break;
        }

        case 'Oxigenação do sangue': {
            const oData = safeData as Partial<OxigenacaoFormData>;
            if (!oData.spO2 || !oData.spO2.trim()) {
                errors.spO2 = 'Informe a porcentagem de oxigênio.';
            }
            if (!oData.frequenciaCardiacaBpm || !oData.frequenciaCardiacaBpm.trim()) {
                errors.frequenciaCardiacaBpm = 'Informe a frequência cardíaca (BPM).';
            }
            break;
        }

        case 'Medicação': {
            const mData = safeData as Partial<MedicacaoFormData>;
            if (!mData.nomeMedicamento || !mData.nomeMedicamento.trim()) {
                errors.nomeMedicamento = 'Informe o nome do medicamento.';
            }
            if (!mData.dosagem || !mData.dosagem.trim()) {
                errors.dosagem = 'Informe a dosagem do medicamento.';
            }
            break;
        }

        case 'Temperatura corporal': {
            const tData = safeData as Partial<TemperaturaFormData>;
            if (!tData.valorCelsius || !tData.valorCelsius.trim()) {
                errors.valorCelsius = 'Informe a temperatura corporal.';
            }
            break;
        }

        default:
            break;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}