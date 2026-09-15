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
    switch (typeKey) {
        case 'Glicemia':
            return { ...initialGlicemiaData };
        case 'Pressão':
            return { ...initialPressaoData };
        case 'Oxigenação do sangue':
            return { ...initialOxigenacaoData };
        case 'Medicação':
            return { ...initialMedicacaoData, horarioInsercao: getCurrentTimeString() };
        case 'Temperatura corporal':
            return { ...initialTemperaturaData, sintomasAssociados: [] };
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

    if (typeKey === 'Glicemia') {
        const gData = data as GlicemiaFormData;
        if (!gData.valorMgDl || !gData.valorMgDl.trim()) {
            errors.valorMgDl = 'Por favor, informe o valor da glicemia.';
        }
        if (gData.emJejum === null || gData.emJejum === undefined) {
            errors.emJejum = 'Por favor, informe se a medição foi em jejum.';
        }
    } else if (typeKey === 'Pressão') {
        const pData = data as PressaoFormData;
        if (!pData.sistolica || !pData.sistolica.trim()) {
            errors.sistolica = 'Informe a pressão sistólica.';
        }
        if (!pData.diastolica || !pData.diastolica.trim()) {
            errors.diastolica = 'Informe a pressão diastólica.';
        }
    } else if (typeKey === 'Oxigenação do sangue') {
        const oData = data as OxigenacaoFormData;
        if (!oData.spO2 || !oData.spO2.trim()) {
            errors.spO2 = 'Informe a porcentagem de oxigênio.';
        }
        if (!oData.frequenciaCardiacaBpm || !oData.frequenciaCardiacaBpm.trim()) {
            errors.frequenciaCardiacaBpm = 'Informe a frequência cardíaca (BPM).';
        }
    } else if (typeKey === 'Medicação') {
        const mData = data as MedicacaoFormData;
        if (!mData.nomeMedicamento || !mData.nomeMedicamento.trim()) {
            errors.nomeMedicamento = 'Informe o nome do medicamento.';
        }
        if (!mData.dosagem || !mData.dosagem.trim()) {
            errors.dosagem = 'Informe a dosagem do medicamento.';
        }
    } else if (typeKey === 'Temperatura corporal') {
        const tData = data as TemperaturaFormData;
        if (!tData.valorCelsius || !tData.valorCelsius.trim()) {
            errors.valorCelsius = 'Informe a temperatura corporal.';
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

