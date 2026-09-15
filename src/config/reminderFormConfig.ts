import { themes } from '../global/themes';

export type FieldType = 'text' | 'time' | 'date' | 'boolean' | 'number';

export interface FormFieldConfig {
    name: string;
    label: string;
    placeholder?: string;
    type: FieldType;
    required: boolean;
    defaultValue?: any;
    validate?: (value: any) => string | null;
}

export interface ReminderCategoryConfig {
    id: string;
    key: string;
    label: string;
    iconFamily: 'FontAwesome5' | 'MaterialCommunityIcons';
    iconName: string;
    color: string;
    fields: FormFieldConfig[];
}

/**
 * Estratégia de validação padrão (Strategy Pattern)
 */
export const ValidationStrategies = {
    requiredText: (value: any, label: string): string | null => {
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
            return `O campo "${label}" é obrigatório.`;
        }
        return null;
    },
    requiredTime: (value: any, label: string): string | null => {
        if (!value || typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
            return `Informe um horário válido para "${label}".`;
        }
        return null;
    },
};

/**
 * Dicionário centralizado de categorias e seus campos (Configuration Pattern / OCP)
 * Para adicionar uma nova categoria (ex: "Contas", "Reuniões"), basta incluir um novo objeto aqui.
 */
export const reminderCategoriesConfig: ReminderCategoryConfig[] = [
    {
        id: '1',
        key: 'remedio',
        label: 'REMÉDIO',
        iconFamily: 'FontAwesome5',
        iconName: 'pills',
        color: themes.colors.secureGreen,
        fields: [
            {
                name: 'nomeRemedio',
                label: 'NOME DO REMÉDIO',
                placeholder: 'Ex: Insulina, Losartana 50mg...',
                type: 'text',
                required: true,
                defaultValue: '',
                validate: (val) => ValidationStrategies.requiredText(val, 'Nome do Remédio'),
            },
            {
                name: 'qualDia',
                label: 'QUAL DIA?',
                placeholder: 'Ex: Hoje, A partir de amanhã...',
                type: 'text',
                required: true,
                defaultValue: '',
                validate: (val) => ValidationStrategies.requiredText(val, 'Qual dia?'),
            },
            {
                name: 'horario',
                label: 'PARA QUE HORAS?',
                type: 'time',
                required: true,
                defaultValue: '14:30',
                validate: (val) => ValidationStrategies.requiredTime(val, 'Horário'),
            },
            {
                name: 'repetirDiario',
                label: 'REPETIR TODO DIA?',
                type: 'boolean',
                required: false,
                defaultValue: true,
            },
        ],
    },
    {
        id: '2',
        key: 'exame',
        label: 'EXAME',
        iconFamily: 'FontAwesome5',
        iconName: 'user-md',
        color: themes.colors.secureGreen,
        fields: [
            {
                name: 'tipoConsulta',
                label: 'TIPO DO EXAME',
                placeholder: 'Ex: Exame de Sangue, Raio-X...',
                type: 'text',
                required: true,
                defaultValue: '',
                validate: (val) => ValidationStrategies.requiredText(val, 'Tipo do Exame'),
            },
            {
                name: 'dataConsulta',
                label: 'DATA DO EXAME',
                placeholder: 'Ex: Amanhã às 7h, ou DD/MM/AAAA',
                type: 'text',
                required: true,
                defaultValue: '',
                validate: (val) => ValidationStrategies.requiredText(val, 'Data do Exame'),
            },
            {
                name: 'horario',
                label: 'PARA QUE HORAS?',
                type: 'time',
                required: true,
                defaultValue: '07:00',
                validate: (val) => ValidationStrategies.requiredTime(val, 'Horário'),
            },
            {
                name: 'jejum',
                label: 'EXIGE JEJUM?',
                type: 'boolean',
                required: false,
                defaultValue: true,
            },
        ],
    },
    {
        id: '3',
        key: 'consulta',
        label: 'CONSULTA',
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'account-group',
        color: themes.colors.secureGreen,
        fields: [
            {
                name: 'especialidadeMedico',
                label: 'ESPECIALIDADE OU MÉDICO',
                placeholder: 'Ex: Cardiologista - Dr. Roberto',
                type: 'text',
                required: true,
                defaultValue: '',
                validate: (val) => ValidationStrategies.requiredText(val, 'Especialidade ou Médico'),
            },
            {
                name: 'dataConsulta',
                label: 'DATA DA CONSULTA',
                placeholder: 'Ex: Próxima terça-feira, 20/10',
                type: 'text',
                required: true,
                defaultValue: '',
                validate: (val) => ValidationStrategies.requiredText(val, 'Data da Consulta'),
            },
            {
                name: 'horario',
                label: 'PARA QUE HORAS?',
                type: 'time',
                required: true,
                defaultValue: '10:00',
                validate: (val) => ValidationStrategies.requiredTime(val, 'Horário'),
            },
            {
                name: 'levarExames',
                label: 'LEVAR EXAMES ANTERIORES?',
                type: 'boolean',
                required: false,
                defaultValue: false,
            },
        ],
    },
];

/**
 * Retorna todas as categorias configuradas
 */
export function getReminderCategories(): ReminderCategoryConfig[] {
    return reminderCategoriesConfig;
}

/**
 * Retorna a categoria configurada pela chave
 */
export function getReminderCategoryByKey(key: string): ReminderCategoryConfig | undefined {
    return reminderCategoriesConfig.find((cat) => cat.key === key);
}

/**
 * Constrói o estado inicial dos campos de uma categoria específica
 */
export function createInitialCategoryState(category: ReminderCategoryConfig): Record<string, any> {
    const initialState: Record<string, any> = {};
    category.fields.forEach((field) => {
        initialState[field.name] = field.defaultValue !== undefined ? field.defaultValue : '';
    });
    return initialState;
}

/**
 * Executa a validação dinâmica de todos os campos da categoria atualmente selecionada.
 * Garante que apenas os dados pertinentes à categoria façam parte do payload final.
 */
export function validateCategoryPayload(
    category: ReminderCategoryConfig,
    values: Record<string, any>
): {
    isValid: boolean;
    errors: Record<string, string>;
    cleanPayload: Record<string, any>;
} {
    const errors: Record<string, string> = {};
    const cleanPayload: Record<string, any> = {};

    for (const field of category.fields) {
        const val = values[field.name];
        cleanPayload[field.name] = val;

        // Executa validador contextual se existir
        if (field.validate) {
            const errorMsg = field.validate(val);
            if (errorMsg) {
                errors[field.name] = errorMsg;
            }
        } else if (field.required) {
            // Fallback genérico de obrigatoriedade
            if (val === undefined || val === null || val === '') {
                errors[field.name] = `O campo "${field.label}" é obrigatório.`;
            }
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        cleanPayload,
    };
}

