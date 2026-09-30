import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Modal,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

// Firebase
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';
import { themes } from '../../../../global/themes';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

interface ReminderCategory {
    id: string;
    label: string;
    icon: string;
}

const REMINDER_CATEGORIES: ReminderCategory[] = [
    { id: 'Medicação', label: 'Medicamentos & Remédios', icon: 'pill' },
    { id: 'Consulta', label: 'Consultas Médicas', icon: 'doctor' },
    { id: 'Exame', label: 'Exames & Procedimentos', icon: 'file-document-outline' },
    { id: 'Outros', label: 'Outros Lembretes', icon: 'bell-outline' },
];

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL DE ERRO / AVISO (MODELO PADRÃO)
// ---------------------------------------------------------------------------
interface ErrorModalProps {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

function ErrorModal({ visible, title, message, onClose }: ErrorModalProps) {
    const { fontScale, isHighContrast, theme } = useAccessibility();

    if (!visible) return null;

    const handleCloseModal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCloseModal}>
            <View style={modalStyles.overlay}>
                <View style={[
                    modalStyles.modalCard,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 2 }
                ]}>
                    <View style={[
                        modalStyles.iconCircleError,
                        isHighContrast && { backgroundColor: theme.border }
                    ]}>
                        <MaterialCommunityIcons name="close" size={40} color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                    </View>

                    <Text style={[
                        modalStyles.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>{title}</Text>

                    <Text style={[
                        modalStyles.subtitleError,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.buttonPrimary }
                    ]}>Atenção</Text>

                    <View style={[
                        modalStyles.detailsContainer,
                        isHighContrast && { backgroundColor: theme.background, borderColor: theme.border }
                    ]}>
                        <Text style={[
                            modalStyles.detailsText,
                            { fontSize: 15 * fontScale },
                            isHighContrast && { color: theme.textSecondary }
                        ]}>{message}</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            modalStyles.closeButtonError,
                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                        ]}
                        onPress={handleCloseModal}
                        activeOpacity={0.8}
                        accessibilityLabel="Entendido, fechar aviso"
                        accessibilityRole="button"
                    >
                        <Text style={[
                            modalStyles.closeText,
                            { fontSize: 18 * fontScale },
                            isHighContrast && { color: theme.buttonText }
                        ]}>ENTENDIDO</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// DICIONÁRIO DE TRADUÇÃO E FORMATAÇÃO VISUAL DOS CAMPOS DE LEMBRETES
// ---------------------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
    medicamento: 'Medicamento',
    dosagem: 'Dosagem',
    dose: 'Dose Administrada',
    frequencia: 'Frequência',
    instrucoes: 'Instruções / Horários',
    repetirDiario: 'Repetir Diariamente',
    repetirDiariamente: 'Repetir Diariamente',
    medico: 'Médico / Especialista',
    especialidade: 'Especialidade',
    local: 'Local / Endereço',
    dataConsulta: 'Data da Consulta',
    horario: 'Horário Agendado',
    time: 'Horário',
    tipoExame: 'Tipo de Exame',
    jejum: 'Exige Jejum',
    emJejum: 'Estava em Jejum',
    observacoes: 'Observações Adicionais',
    observacao: 'Observação',
    notas: 'Notas',
    descricao: 'Descrição',
};

const formatFieldValue = (key: string, val: any): string => {
    if (typeof val === 'boolean') {
        return val 
            ? `<span style="color: #0f5132; background-color: #d1e7dd; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Sim</span>`
            : `<span style="color: #842029; background-color: #f8d7da; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Não</span>`;
    }

    if (val === null || val === undefined || val === '') return '<i style="color: #999;">Não informado</i>';

    return String(val);
};

const renderReminderDetails = (dados: any): string => {
    if (!dados || typeof dados !== 'object') return '';

    const itemsHtml = Object.entries(dados)
        .filter(([k]) => k !== 'time' && k !== 'horario')
        .map(([k, v]) => {
            const label = FIELD_LABELS[k] || k;
            const formattedVal = formatFieldValue(k, v);
            return `
                <li style="margin-bottom: 4px; font-size: 14px;">
                    <span style="color: #198754; font-weight: bold;">${label}:</span> ${formattedVal}
                </li>
            `;
        })
        .join('');

    if (!itemsHtml) return '';

    return `<ul style="list-style: none; padding-left: 0; margin-top: 8px; margin-bottom: 0;">${itemsHtml}</ul>`;
};

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export function GenerateRemindersReports() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    // Contexto Global de Acessibilidade
    const { fontScale, isHighContrast, theme } = useAccessibility();

    // Estados
    const [generating, setGenerating] = useState(false);
    
    // Perfil selecionado na HomePage / Parâmetros
    const activeUserId = route.params?.activeUserId || route.params?.targetUserId || route.params?.userId || auth.currentUser?.uid || '';
    const [activeUserName, setActiveUserName] = useState<string>('Usuário');

    // Período selecionado: 7, 30, 999 (Tudo) ou 'custom'
    const [selectedPeriod, setSelectedPeriod] = useState<number | 'custom'>(30);
    
    // Intervalo de datas personalizado
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());

    // Controle de exibição dos DatePickers
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Categorias de lembretes selecionadas
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Estado do Modal de Erro
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('Erro');
    const [errorMessage, setErrorMessage] = useState('');

    const showError = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        setErrorModalVisible(true);
    };

    // Sanitizar strings para nomes de arquivo seguros
    const sanitizeFileName = (text: string) => {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .toLowerCase();
    };

    // Alternar seleção individual das categorias
    const toggleCategory = (categoryId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(item => item !== categoryId)
                : [...prev, categoryId]
        );
    };

    // Alternar entre Marcar Todos e Desmarcar Todos
    const handleToggleAllCategories = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (selectedCategories.length === REMINDER_CATEGORIES.length) {
            setSelectedCategories([]);
        } else {
            setSelectedCategories(REMINDER_CATEGORIES.map(c => c.id));
        }
    };

    const handleSelectPeriod = (val: number | 'custom') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedPeriod(val);
    };

    const handleOpenStartPicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowStartPicker(true);
    };

    const handleOpenEndPicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowEndPicker(true);
    };

    const onChangeStartDate = (event: any, selectedDate?: Date) => {
        setShowStartPicker(Platform.OS === 'ios');
        if (selectedDate) {
            setStartDate(selectedDate);
        }
    };

    const onChangeEndDate = (event: any, selectedDate?: Date) => {
        setShowEndPicker(Platform.OS === 'ios');
        if (selectedDate) {
            setEndDate(selectedDate);
        }
    };

    const formatDateToBR = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Helper para converter "DD/MM/YYYY" em timestamp numérico para ordenação correta
    const parseBRDateToTimestamp = (dateStr: string) => {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        }
        return 0;
    };

    // Carrega o nome do perfil selecionado (considerando coleção do usuário ou subcoleção de dependentes)
    useEffect(() => {
        const fetchUserName = async () => {
            if (!activeUserId) return;
            const responsibleId = auth.currentUser?.uid;

            try {
                // 1. Tenta buscar no perfil do responsável se for o próprio ID
                if (responsibleId && activeUserId === responsibleId) {
                    const userDoc = await getDoc(doc(db, 'users', activeUserId));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setActiveUserName(data.apelido || data.nome || 'Usuário');
                        return;
                    }
                }

                // 2. Se for um ID diferente, busca na subcoleção de dependentes do responsável
                if (responsibleId) {
                    const depDoc = await getDoc(doc(db, 'users', responsibleId, 'dependentes', activeUserId));
                    if (depDoc.exists()) {
                        const data = depDoc.data();
                        setActiveUserName(data.apelido || data.nome || 'Dependente');
                        return;
                    }
                }

                // 3. Fallback: Busca diretamente na raiz de 'users'
                const fallbackDoc = await getDoc(doc(db, 'users', activeUserId));
                if (fallbackDoc.exists()) {
                    const data = fallbackDoc.data();
                    setActiveUserName(data.apelido || data.nome || 'Usuário');
                }
            } catch (error) {
                console.error('Erro ao buscar nome do usuário:', error);
            }
        };

        fetchUserName();
    }, [activeUserId]);

    // Geração do PDF no formato de Agenda / Calendário
    const handleGenerateReport = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (!activeUserId) {
            showError('Erro ao Gerar', 'Nenhum perfil identificado para gerar o relatório.');
            return;
        }

        if (selectedCategories.length === 0) {
            showError('Atenção', 'Selecione pelo menos uma categoria de lembrete.');
            return;
        }

        let filterStart: Date;
        let filterEnd: Date;

        if (selectedPeriod === 'custom') {
            filterStart = new Date(startDate);
            filterStart.setHours(0, 0, 0, 0);

            filterEnd = new Date(endDate);
            filterEnd.setHours(23, 59, 59, 999);

            if (filterStart > filterEnd) {
                showError('Intervalo Inválido', 'A data inicial não pode ser posterior à data final.');
                return;
            }
        } else {
            const now = new Date();
            filterStart = new Date();
            filterStart.setHours(0, 0, 0, 0);

            if (selectedPeriod === 999) {
                filterEnd = new Date(now.getFullYear() + 1, 11, 31); // Limite de 1 ano para evitar travamentos
            } else {
                filterEnd = new Date();
                filterEnd.setDate(now.getDate() + (selectedPeriod as number));
                filterEnd.setHours(23, 59, 59, 999);
            }
        }

        setGenerating(true);

        try {
            const responsibleId = auth.currentUser?.uid;
            let remindersRef;

            // Busca na subcoleção do dependente se aplicável ou direto na raiz do usuário
            if (responsibleId && activeUserId !== responsibleId) {
                const depRemindersRef = collection(db, 'users', responsibleId, 'dependentes', activeUserId, 'reminders');
                const depSnap = await getDocs(query(depRemindersRef));
                if (!depSnap.empty) {
                    remindersRef = depRemindersRef;
                }
            }

            if (!remindersRef) {
                remindersRef = collection(db, 'users', activeUserId, 'reminders');
            }

            const remindersSnap = await getDocs(query(remindersRef));
            const remindersList: any[] = [];
            remindersSnap.forEach(d => remindersList.push({ id: d.id, ...d.data() }));

            const calendarMap: { [key: string]: any[] } = {};

            remindersList.forEach(item => {
                // Mapeamento/Normalização da categoria do lembrete
                const categoryKey = item.categoryKey || item.categoria || item.type || '';
                let category = 'Outros';
                if (categoryKey.includes('remedio') || categoryKey.includes('Medica') || categoryKey.includes('remedio')) category = 'Medicação';
                else if (categoryKey.includes('consulta')) category = 'Consulta';
                else if (categoryKey.includes('exame')) category = 'Exame';

                const isMatchingCategory = selectedCategories.includes(category) || selectedCategories.includes('Outros');
                if (!isMatchingCategory) return;

                const isDaily = item.dadosFormulario?.repetirDiariamente === true || 
                                item.dadosFormulario?.repetirDiario === true || 
                                item.recorrente === true;

                const rawDate = item.dataAgendamento || item.data || item.proximaData;
                const itemStartDate = rawDate ? new Date(rawDate) : new Date();

                // Lógica 1: Lembrete com Repetição Diária (Projeta para todos os dias do intervalo)
                if (isDaily) {
                    const currentLoopDate = new Date(filterStart);
                    
                    // Começa a partir da data de criação/agendamento do remédio (se for posterior ao início do filtro)
                    if (itemStartDate > filterStart) {
                        currentLoopDate.setTime(itemStartDate.getTime());
                        currentLoopDate.setHours(0, 0, 0, 0);
                    }

                    while (currentLoopDate <= filterEnd) {
                        const dateKey = formatDateToBR(currentLoopDate);
                        if (!calendarMap[dateKey]) calendarMap[dateKey] = [];

                        calendarMap[dateKey].push({
                            title: item.title || item.dadosFormulario?.nomeRemedio || item.dadosFormulario?.titulo || 'Lembrete',
                            time: item.dadosFormulario?.time || item.dadosFormulario?.horario || item.horario || '--:--',
                            category: category,
                            details: item.subtitle || item.descricao || item.observacao || '',
                            dadosFormulario: item.dadosFormulario || null
                        });

                        currentLoopDate.setDate(currentLoopDate.getDate() + 1);
                    }
                } 
                // Lógica 2: Lembrete Único / Consulta / Exame
                else if (rawDate) {
                    const itemDate = new Date(rawDate);
                    if (itemDate >= filterStart && itemDate <= filterEnd) {
                        const dateKey = formatDateToBR(itemDate);
                        if (!calendarMap[dateKey]) calendarMap[dateKey] = [];
                        calendarMap[dateKey].push({
                            title: item.title || item.titulo || 'Lembrete',
                            time: item.dadosFormulario?.time || item.dadosFormulario?.horario || item.horario || '--:--',
                            category: category,
                            details: item.subtitle || item.descricao || item.observacao || '',
                            dadosFormulario: item.dadosFormulario || null
                        });
                    }
                }
            });

            const now = new Date();
            const periodLabel = selectedPeriod === 'custom'
                ? `De ${formatDateToBR(startDate)} até ${formatDateToBR(endDate)}`
                : selectedPeriod === 999 ? 'Previsão Completa' : `Próximos ${selectedPeriod} Dias`;

            // Ordena as datas do calendário em ordem cronológica crescente
            const sortedDates = Object.keys(calendarMap).sort((a, b) => {
                return parseBRDateToTimestamp(a) - parseBRDateToTimestamp(b);
            });

            const htmlContent = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 30px; color: #1A1A1A; line-height: 1.6; }
                        .header { text-align: center; border-bottom: 4px solid #198754; padding-bottom: 20px; margin-bottom: 30px; }
                        .header h1 { color: #198754; margin: 0; font-size: 28px; text-transform: uppercase; }
                        .header p { font-size: 18px; color: #444; margin: 8px 0 0 0; }
                        .filter-badge { display: inline-block; background-color: #d1e7dd; color: #0f5132; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-top: 10px; }
                        .date-header { background-color: #198754; color: #FFFFFF; padding: 10px 16px; border-radius: 8px; font-size: 20px; font-weight: bold; margin-top: 28px; }
                        .card { background-color: #F8F9FA; border: 2px solid #E0E0E0; border-left: 8px solid #198754; padding: 16px; margin-top: 12px; border-radius: 8px; }
                        .card-title { font-size: 18px; font-weight: bold; margin: 0 0 6px 0; color: #000; }
                        .card-time { font-size: 15px; color: #198754; font-weight: bold; margin-bottom: 6px; }
                        .card-desc { font-size: 15px; color: #333; margin: 0; }
                        .empty { font-size: 18px; color: #777; font-style: italic; padding: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Calendário e Agenda de Lembretes</h1>
                        <p>Paciente/Perfil: <strong>${activeUserName}</strong></p>
                        <p>Emissão: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <div class="filter-badge">Período: ${periodLabel}</div>
                        <div class="filter-badge">Categorias: ${selectedCategories.join(', ')}</div>
                    </div>

                    ${sortedDates.length > 0 
                        ? sortedDates.map(dateKey => `
                            <div class="date-header">🗓 ${dateKey}</div>${calendarMap[dateKey].map(item => {
                                const detailsHtml = renderReminderDetails(item.dadosFormulario);
                                return `
                                    <div class="card">
                                        <p class="card-title">[${item.category}] ${item.title}</p>
                                        <p class="card-time">⏰ Horário / Frequência: ${item.time}</p>
                                        ${item.details ? `<p class="card-desc">📌 Resumo: ${item.details}</p>` : ''}
                                        ${detailsHtml}
                                    </div>
                                `;
                            }).join('')}
                        `).join('')
                        : '<p class="empty">Nenhum lembrete, consulta ou exame encontrado para as opções selecionadas.</p>'
                    }
                </body>
                </html>
            `;

            const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });

            let periodSuffix = '';
            if (selectedPeriod === 'custom') {
                periodSuffix = `${formatDateToBR(startDate)}-a-${formatDateToBR(endDate)}`;
            } else if (selectedPeriod === 999) {
                periodSuffix = 'historico-completo';
            } else {
                periodSuffix = `proximos-${selectedPeriod}-dias`;
            }

            const cleanUserName = sanitizeFileName(activeUserName);
            const cleanPeriod = sanitizeFileName(periodSuffix);
            const fileName = `lembretes_${cleanUserName}_${cleanPeriod}.pdf`;

            const targetUri = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.moveAsync({
                from: tempUri,
                to: targetUri,
            });

            await Sharing.shareAsync(targetUri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Partilhar Calendário de Lembretes',
                UTI: 'com.adobe.pdf'
            });

        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            showError('Erro de Emissão', 'Não foi possível gerar o relatório PDF.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <View style={[styles.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            {/* ÁREA SUPERIOR (STATUS BAR / HEADER / CORPO DA TELA) */}
            <SafeAreaView 
                style={[
                    styles.container,
                    isHighContrast && { backgroundColor: theme.background }
                ]} 
                edges={['top', 'left', 'right']}
            >
                <View style={[
                    styles.header,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderBottomColor: theme.border, borderBottomWidth: 1 }
                ]}>
                    <TouchableOpacity 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.goBack();
                        }} 
                        style={styles.backButton} 
                        activeOpacity={0.7}
                        accessibilityLabel="Voltar para a tela anterior"
                        accessibilityRole="button"
                    >
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        styles.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]} numberOfLines={1} adjustsFontSizeToFit>
                        Gerar Relatórios
                    </Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    {/* INDICADOR DO PERFIL ATUAL */}
                    <View style={[
                        styles.profileIndicator,
                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                    ]}>
                        <MaterialCommunityIcons 
                            name="account-check" 
                            size={24} 
                            color={isHighContrast ? theme.buttonPrimary : "#5bc0de"} 
                        />
                        <Text style={[
                            styles.profileIndicatorText,
                            { fontSize: 16 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>
                            Gerando calendário de: <Text style={[
                                styles.profileNameBold,
                                isHighContrast && { color: theme.buttonPrimary }
                            ]}>{activeUserName}</Text>
                        </Text>
                    </View>

                    {/* 1. SELEÇÃO MÚLTIPLA DE CATEGORIAS */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[
                            styles.sectionTitle,
                            { fontSize: 16 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>QUAIS LEMBRETES INCLUIR?</Text>
                        <TouchableOpacity 
                            onPress={handleToggleAllCategories} 
                            activeOpacity={0.7}
                            accessibilityLabel={selectedCategories.length === REMINDER_CATEGORIES.length ? "Desmarcar todas as categorias" : "Marcar todas as categorias"}
                            accessibilityRole="button"
                        >
                            <Text style={[
                                styles.toggleAllText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.buttonPrimary }
                            ]}>
                                {selectedCategories.length === REMINDER_CATEGORIES.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.typesGrid}>
                        {REMINDER_CATEGORIES.map((cat) => {
                            const isChecked = selectedCategories.includes(cat.id);
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.typeCard,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                        isChecked && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.typeCardChecked)
                                    ]}
                                    onPress={() => toggleCategory(cat.id)}
                                    activeOpacity={0.8}
                                    accessibilityLabel={`Categoria ${cat.label}, ${isChecked ? "selecionado" : "não selecionado"}`}
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons 
                                        name={cat.icon as any} 
                                        size={30} 
                                        color={isChecked ? (isHighContrast ? theme.buttonText : "#FFFFFF") : (isHighContrast ? theme.buttonPrimary : "#5bc0de")} 
                                    />
                                    <Text style={[
                                        styles.typeCardText,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                        isChecked && (isHighContrast ? { color: theme.buttonText } : styles.typeCardTextChecked)
                                    ]}>
                                        {cat.label}
                                    </Text>
                                    <MaterialCommunityIcons 
                                        name={isChecked ? "checkbox-marked" : "checkbox-blank-outline"} 
                                        size={24} 
                                        color={isChecked ? (isHighContrast ? theme.buttonText : "#FFFFFF") : (isHighContrast ? theme.textSecondary : "#94A3B8")} 
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* 2. SELEÇÃO DE PERÍODO / PREVISÃO */}
                    <Text style={[
                        styles.sectionTitle,
                        { marginTop: 24, fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>QUAL PREVISÃO DESEJA VER?</Text>

                    <View style={styles.periodGrid}>
                        {[
                            { label: 'Próximos 7 Dias', sub: '1 Semana à frente', value: 7, icon: 'calendar-week' },
                            { label: 'Próximos 30 Dias', sub: '1 Mês à frente', value: 30, icon: 'calendar-month' },
                            { label: 'Histórico & Futuro', sub: 'Previsão completa', value: 999, icon: 'calendar-clock' },
                            { label: 'Escolher Intervalo', sub: 'Definir data inicial e final', value: 'custom', icon: 'calendar-range' }
                        ].map((item) => {
                            const isSelected = selectedPeriod === item.value;
                            return (
                                <TouchableOpacity
                                    key={String(item.value)}
                                    style={[
                                        styles.periodButton,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                        isSelected && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.periodButtonSelected)
                                    ]}
                                    onPress={() => handleSelectPeriod(item.value as any)}
                                    activeOpacity={0.85}
                                    accessibilityLabel={`Período ${item.label}, ${isSelected ? "selecionado" : "não selecionado"}`}
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons 
                                        name={item.icon as any} 
                                        size={36} 
                                        color={isSelected ? (isHighContrast ? theme.buttonText : "#FFFFFF") : (isHighContrast ? theme.buttonPrimary : "#5bc0de")} 
                                    />
                                    <View style={styles.periodTextWrapper}>
                                        <Text style={[
                                            styles.periodTitle,
                                            { fontSize: 18 * fontScale },
                                            isHighContrast && { color: theme.textPrimary },
                                            isSelected && (isHighContrast ? { color: theme.buttonText } : styles.periodTextSelected)
                                        ]}>
                                            {item.label}
                                        </Text>
                                        <Text style={[
                                            styles.periodSubtitle,
                                            { fontSize: 14 * fontScale },
                                            isHighContrast && { color: theme.textSecondary },
                                            isSelected && (isHighContrast ? { color: theme.buttonText } : styles.periodSubtitleSelected)
                                        ]}>
                                            {item.sub}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons 
                                        name={isSelected ? "check-circle" : "checkbox-blank-circle-outline"} 
                                        size={28} 
                                        color={isSelected ? (isHighContrast ? theme.buttonText : "#FFFFFF") : (isHighContrast ? theme.textSecondary : "#CBD5E1")} 
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* BOTÕES DE SELEÇÃO DE DATA COM POPUP NATIVO */}
                    {selectedPeriod === 'custom' && (
                        <View style={[
                            styles.customDateContainer,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                        ]}>
                            <View style={styles.dateFieldWrapper}>
                                <Text style={[
                                    styles.dateLabel,
                                    { fontSize: 14 * fontScale },
                                    isHighContrast && { color: theme.textPrimary }
                                ]}>DE (DATA INICIAL):</Text>
                                <TouchableOpacity 
                                    style={[
                                        styles.dateInputBox,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                    ]} 
                                    onPress={handleOpenStartPicker}
                                    activeOpacity={0.8}
                                    accessibilityLabel="Botão para alterar a data inicial do intervalo"
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons 
                                        name="calendar-start" 
                                        size={24} 
                                        color={isHighContrast ? theme.buttonPrimary : "#5bc0de"} 
                                    />
                                    <Text style={[
                                        styles.dateValueText,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.textPrimary }
                                    ]}>
                                        {formatDateToBR(startDate)}
                                    </Text>
                                    <MaterialCommunityIcons 
                                        name="pencil-outline" 
                                        size={20} 
                                        color={isHighContrast ? theme.textSecondary : "#94A3B8"} 
                                    />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.dateFieldWrapper}>
                                <Text style={[
                                    styles.dateLabel,
                                    { fontSize: 14 * fontScale },
                                    isHighContrast && { color: theme.textPrimary }
                                ]}>ATÉ (DATA FINAL):</Text>
                                <TouchableOpacity 
                                    style={[
                                        styles.dateInputBox,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                    ]} 
                                    onPress={handleOpenEndPicker}
                                    activeOpacity={0.8}
                                    accessibilityLabel="Botão para alterar a data final do intervalo"
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons 
                                        name="calendar-end" 
                                        size={24} 
                                        color={isHighContrast ? theme.buttonPrimary : "#5bc0de"} 
                                    />
                                    <Text style={[
                                        styles.dateValueText,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.textPrimary }
                                    ]}>
                                        {formatDateToBR(endDate)}
                                    </Text>
                                    <MaterialCommunityIcons 
                                        name="pencil-outline" 
                                        size={20} 
                                        color={isHighContrast ? theme.textSecondary : "#94A3B8"} 
                                    />
                                </TouchableOpacity>
                            </View>

                            {showStartPicker && (
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={onChangeStartDate}
                                />
                            )}

                            {showEndPicker && (
                                <DateTimePicker
                                    value={endDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={onChangeEndDate}
                                />
                            )}
                        </View>
                    )}

                </ScrollView>
            </SafeAreaView>

            {/* RODAPÉ ISOLADO ENVELOPADO COM SAFE AREA VIEW (edges=['bottom']) */}
            <SafeAreaView 
                edges={['bottom']} 
                style={[
                    styles.footerSafeArea,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderTopColor: theme.border }
                ]}
            >
                <View style={styles.footerInner}>
                    <TouchableOpacity 
                        style={[
                            styles.generateButton,
                            isHighContrast && { backgroundColor: theme.buttonPrimary },
                            generating && styles.generateButtonDisabled
                        ]} 
                        onPress={handleGenerateReport}
                        disabled={generating}
                        activeOpacity={0.8}
                        accessibilityLabel="Gerar e compartilhar calendário em PDF"
                        accessibilityRole="button"
                    >
                        {generating ? (
                            <ActivityIndicator size="large" color={isHighContrast ? theme.buttonText : "#FFFFFF"} />
                        ) : (
                            <>
                                <MaterialCommunityIcons 
                                    name="file-pdf-box" 
                                    size={32} 
                                    color={isHighContrast ? theme.buttonText : "#FFFFFF"} 
                                />
                                <Text style={[
                                    styles.generateButtonText,
                                    { fontSize: 20 * fontScale },
                                    isHighContrast && { color: theme.buttonText }
                                ]}>GERAR CALENDÁRIO PDF</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* MODAL DE ERRO REUTILIZADO */}
            <ErrorModal
                visible={errorModalVisible}
                title={errorTitle}
                message={errorMessage}
                onClose={() => setErrorModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    mainWrapper: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.notBlack,
        textTransform: 'uppercase',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
    },
    profileIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 20,
        gap: 10,
    },
    profileIndicatorText: {
        fontSize: 16,
        color: '#334155',
    },
    profileNameBold: {
        fontWeight: 'bold',
        color: '#5bc0de',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8, // Garante um espaço mínimo entre o título e o botão
    },
    sectionTitle: {
        flex: 1, // Permite que o título ocupe o espaço disponível sem empurrar o botão
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
        letterSpacing: 0.3,
    },
    toggleAllText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0284c7',
    },
    typesGrid: {
        gap: 10,
        marginBottom: 10,
    },
    typeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
    },
    typeCardChecked: {
        backgroundColor: '#5bc0de',
        borderColor: '#5bc0de',
    },
    typeCardText: {
        flex: 1,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#334155',
    },
    typeCardTextChecked: {
        color: '#FFFFFF',
    },
    periodGrid: {
        gap: 12,
        marginTop: 12,
        marginBottom: 10,
    },
    periodButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 2.5,
        borderColor: '#E2E8F0',
        borderRadius: 24,
        paddingVertical: 16,
        paddingHorizontal: 18,
        minHeight: 76,
    },
    periodButtonSelected: {
        borderColor: 'transparent',
        backgroundColor: '#5bc0de',
        elevation: 4,
    },
    periodTextWrapper: {
        flex: 1,
        marginLeft: 14,
    },
    periodTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    periodSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    periodTextSelected: {
        color: '#FFFFFF',
    },
    periodSubtitleSelected: {
        color: '#E2E8F0',
    },
    customDateContainer: {
        backgroundColor: '#F8FAFC',
        borderWidth: 2,
        borderColor: '#5bc0de',
        borderRadius: 20,
        padding: 16,
        marginTop: 12,
        gap: 14,
    },
    dateFieldWrapper: {
        width: '100%',
    },
    dateLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 6,
    },
    dateInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 10,
    },
    dateValueText: {
        flex: 1,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    footerSafeArea: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1.5,
        borderTopColor: '#E2E8F0',
    },
    footerInner: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    generateButton: {
        flexDirection: 'row',
        backgroundColor: themes.colors.darkRed,
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minHeight: 68,
        elevation: 4,
    },
    generateButtonDisabled: {
        opacity: 0.6,
        elevation: 0,
    },
    generateButtonText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    iconCircleError: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: themes.colors.darkRed || '#DC3545',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitleError: {
        fontSize: 16,
        color: themes.colors.darkRed || '#DC3545',
        textAlign: 'center',
        marginBottom: 16,
        fontWeight: 'bold',
    },
    detailsContainer: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    detailsText: {
        fontSize: 15,
        color: '#333333',
        lineHeight: 22,
        textAlign: 'center',
    },
    closeButtonError: {
        width: '100%',
        backgroundColor: themes.colors.darkRed || '#DC3545',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});