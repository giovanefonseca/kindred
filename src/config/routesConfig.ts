import { themes } from '../global/themes';

export type ActionViewKey = 'emergency' | 'note' | 'reminder' | 'water';

export interface ActionRouteConfig {
    id: string;
    slug: string;
    label: string;
    bannerTitle: string;
    color: string;
    iconFamily: 'MaterialCommunityIcons' | 'FontAwesome5' | 'FontAwesome';
    iconName: string;
    viewKey: ActionViewKey;
    accessibilityLabel: string;
    accessibilityHint: string;
}

export const routesConfig: ActionRouteConfig[] = [
    {
        id: '1',
        slug: 'chamar-ajuda',
        label: 'CHAMAR\nAJUDA',
        bannerTitle: 'CONTATOS DE EMERGÊNCIA',
        color: themes.colors.darkRed,
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'alert',
        viewKey: 'emergency',
        accessibilityLabel: 'Chamar Ajuda',
        accessibilityHint: 'Abre a tela de emergência com contatos de socorro para ligação rápida',
    },
    {
        id: '2',
        slug: 'nova-anotacao',
        label: 'NOVA\nANOTAÇÃO',
        bannerTitle: 'NOVA ANOTAÇÃO',
        color: themes.colors.orange,
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'pencil',
        viewKey: 'note',
        accessibilityLabel: 'Nova Anotação',
        accessibilityHint: 'Abre o formulário para registrar medições como glicemia, pressão e medicação',
    },
    {
        id: '3',
        slug: 'definir-lembrete',
        label: 'DEFINIR\nLEMBRETE',
        bannerTitle: 'DEFINIR LEMBRETE',
        color: themes.colors.secureGreen,
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'calendar-blank-outline',
        viewKey: 'reminder',
        accessibilityLabel: 'Definir Lembrete',
        accessibilityHint: 'Abre o agendamento de alarmes e lembretes para remédios, exames ou consultas',
    },
    {
        id: '4',
        slug: 'registrar-agua',
        label: 'REGISTRAR\nÁGUA',
        bannerTitle: 'REGISTRAR ÁGUA',
        color: themes.colors.primary,
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'cup-water',
        viewKey: 'water',
        accessibilityLabel: 'Registrar Água',
        accessibilityHint: 'Abre o controle diário de hidratação com registro de copos consumidos',
    },
];

/**
 * Retorna todos os botões/rotas cadastrados
 */
export function getAllActionRoutes(): ActionRouteConfig[] {
    return routesConfig;
}

/**
 * Busca e valida uma rota a partir de seu slug
 */
export function getActionRouteBySlug(slug: string): ActionRouteConfig | undefined {
    return routesConfig.find((route) => route.slug === slug);
}

