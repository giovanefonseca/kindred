import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';

// Firebase
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';
import { themes } from '../../../../global/themes';

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
// DICIONÁRIO DE TRADUÇÃO E FORMATAÇÃO VISUAL DOS CAMPOS DE LEMBRETES
// ---------------------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
    medicamento: 'Medicamento',
    dosagem: 'Dosagem',
    dose: 'Dose Administrada',
    frequencia: 'Frequência',
    instrucoes: 'Instruções / Horários',
    repetirDiario: 'Repetir Diariamente',
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
        .filter(([k]) => k !== 'time' && k !== 'horario') // Evita duplicar o horário já exibido no topo
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

    // Estados
    const [generating, setGenerating] = useState(false);
    
    // Perfil selecionado na HomePage
    const activeUserId = route.params?.activeUserId || auth.currentUser?.uid || '';
    const [activeUserName, setActiveUserName] = useState<string>('Usuário');

    // Período selecionado: 7, 30, 999 (Tudo) ou 'custom'
    const [selectedPeriod, setSelectedPeriod] = useState<number | 'custom'>(30);
    
    // Intervalo de datas personalizado (Objetos Date)
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());

    // Controle de exibição dos DatePickers do Android/iOS
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

// Categorias de lembretes selecionadas (Inicia vazio/desmarcado)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Sanitizar strings para nomes de arquivo seguros (sem acentos e espaços)
    const sanitizeFileName = (text: string) => {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .toLowerCase();
    };

    // Alternar seleção individual das categorias
    const toggleCategory = (categoryId: string) => {
        setSelectedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(item => item !== categoryId)
                : [...prev, categoryId]
        );
    };

    // Alternar entre Marcar Todos e Desmarcar Todos
    const handleToggleAllCategories = () => {
        if (selectedCategories.length === REMINDER_CATEGORIES.length) {
            setSelectedCategories([]);
        } else {
            setSelectedCategories(REMINDER_CATEGORIES.map(c => c.id));
        }
    };

    // Mudança de Data Inicial via Seletor
    const onChangeStartDate = (event: any, selectedDate?: Date) => {
        setShowStartPicker(Platform.OS === 'ios');
        if (selectedDate) {
            setStartDate(selectedDate);
        }
    };

    // Mudança de Data Final via Seletor
    const onChangeEndDate = (event: any, selectedDate?: Date) => {
        setShowEndPicker(Platform.OS === 'ios');
        if (selectedDate) {
            setEndDate(selectedDate);
        }
    };

    // Formatar Date para DD/MM/AAAA
    const formatDateToBR = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Carrega o nome do perfil selecionado
    useEffect(() => {
        const fetchUserName = async () => {
            if (!activeUserId) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', activeUserId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
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
        if (!activeUserId) {
            Alert.alert('Erro', 'Nenhum perfil identificado para gerar o relatório.');
            return;
        }

        if (selectedCategories.length === 0) {
            Alert.alert('Atenção', 'Selecione pelo menos uma categoria de lembrete.');
            return;
        }

        let filterStart: Date | null = null;
        let filterEnd: Date | null = null;

        if (selectedPeriod === 'custom') {
            filterStart = new Date(startDate);
            filterStart.setHours(0, 0, 0, 0);

            filterEnd = new Date(endDate);
            filterEnd.setHours(23, 59, 59, 999);

            if (filterStart > filterEnd) {
                Alert.alert('Intervalo Inválido', 'A data inicial não pode ser posterior à data final.');
                return;
            }
        } else {
            const now = new Date();
            filterStart = new Date();
            filterStart.setHours(0, 0, 0, 0);

            if (selectedPeriod === 999) {
                filterEnd = new Date(now.getFullYear() + 2, 11, 31);
            } else {
                filterEnd = new Date();
                filterEnd.setDate(now.getDate() + (selectedPeriod as number));
                filterEnd.setHours(23, 59, 59, 999);
            }
        }

        setGenerating(true);

        try {
            const remindersRef = collection(db, 'users', activeUserId, 'reminders');
            const remindersSnap = await getDocs(query(remindersRef));
            const remindersList: any[] = [];
            remindersSnap.forEach(d => remindersList.push({ id: d.id, ...d.data() }));

            // Filtro e Mapeamento dos Lembretes por Datas do Calendário
            const calendarMap: { [key: string]: any[] } = {};

            remindersList.forEach(item => {
                const category = item.categoria || item.type || 'Medicação';
                const isMatchingCategory = selectedCategories.includes(category) || selectedCategories.includes('Outros');

                if (!isMatchingCategory) return;

                const rawDate = item.dataAgendamento || item.data || item.proximaData;
                const itemDate = rawDate ? new Date(rawDate) : null;

                if (itemDate && filterStart && filterEnd && itemDate >= filterStart && itemDate <= filterEnd) {
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
                else if (!rawDate || item.recorrente) {
                    const key = 'Uso Contínuo / Recorrente';
                    if (!calendarMap[key]) calendarMap[key] = [];
                    calendarMap[key].push({
                        title: item.title || item.titulo || 'Lembrete Contínuo',
                        time: item.dadosFormulario?.time || item.dadosFormulario?.horario || item.horario || 'Rotina',
                        category: category,
                        details: item.subtitle || item.frequencia || 'Uso contínuo conforme indicação',
                        dadosFormulario: item.dadosFormulario || null
                    });
                }
            });

            const now = new Date();
            const periodLabel = selectedPeriod === 'custom'
                ? `De ${formatDateToBR(startDate)} até ${formatDateToBR(endDate)}`
                : selectedPeriod === 999 ? 'Previsão Completa de Histórico e Futuro' : `Próximos ${selectedPeriod} Dias`;

            const sortedDates = Object.keys(calendarMap);

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

            // 1. Gerar PDF inicial temporário
            const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });

            // 2. Definir o sufixo da competência / período
            let periodSuffix = '';
            if (selectedPeriod === 'custom') {
                periodSuffix = `${formatDateToBR(startDate)}-a-${formatDateToBR(endDate)}`;
            } else if (selectedPeriod === 999) {
                periodSuffix = 'historico-completo';
            } else {
                periodSuffix = `proximos-${selectedPeriod}-dias`;
            }

            // 3. Montar nome formatado: lembretes_nomeusuario_periodo.pdf
            const cleanUserName = sanitizeFileName(activeUserName);
            const cleanPeriod = sanitizeFileName(periodSuffix);
            const fileName = `lembretes_${cleanUserName}_${cleanPeriod}.pdf`;

            // 4. Mover arquivo renomeado no FileSystem
            const targetUri = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.moveAsync({
                from: tempUri,
                to: targetUri,
            });

            // 5. Compartilhar com o nome customizado
            await Sharing.shareAsync(targetUri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Partilhar Calendário de Lembretes',
                UTI: 'com.adobe.pdf'
            });

        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            Alert.alert('Erro', 'Não foi possível gerar o relatório PDF.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
                    Gerar Relatórios
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* INDICADOR DO PERFIL ATUAL */}
                <View style={styles.profileIndicator}>
                    <MaterialCommunityIcons name="account-check" size={24} color="#5bc0de" />
                    <Text style={styles.profileIndicatorText}>
                        Gerando calendário de: <Text style={styles.profileNameBold}>{activeUserName}</Text>
                    </Text>
                </View>

                {/* 1. SELEÇÃO MÚLTIPLA DE CATEGORIAS */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>QUAIS LEMBRETES INCLUIR?</Text>
                    <TouchableOpacity onPress={handleToggleAllCategories} activeOpacity={0.7}>
                        <Text style={styles.toggleAllText}>
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
                                style={[styles.typeCard, isChecked && styles.typeCardChecked]}
                                onPress={() => toggleCategory(cat.id)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons 
                                    name={cat.icon as any} 
                                    size={30} 
                                    color={isChecked ? "#FFFFFF" : "#5bc0de"} 
                                />
                                <Text style={[styles.typeCardText, isChecked && styles.typeCardTextChecked]}>
                                    {cat.label}
                                </Text>
                                <MaterialCommunityIcons 
                                    name={isChecked ? "checkbox-marked" : "checkbox-blank-outline"} 
                                    size={24} 
                                    color={isChecked ? "#FFFFFF" : "#94A3B8"} 
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 2. SELEÇÃO DE PERÍODO / PREVISÃO */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>QUAL PREVISÃO DESEJA VER?</Text>
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
                                style={[styles.periodButton, isSelected && styles.periodButtonSelected]}
                                onPress={() => setSelectedPeriod(item.value as any)}
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons 
                                    name={item.icon as any} 
                                    size={36} 
                                    color={isSelected ? "#FFFFFF" : "#5bc0de"} 
                                />
                                <View style={styles.periodTextWrapper}>
                                    <Text style={[styles.periodTitle, isSelected && styles.periodTextSelected]}>
                                        {item.label}
                                    </Text>
                                    <Text style={[styles.periodSubtitle, isSelected && styles.periodSubtitleSelected]}>
                                        {item.sub}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons 
                                    name={isSelected ? "check-circle" : "checkbox-blank-circle-outline"} 
                                    size={28} 
                                    color={isSelected ? "#FFFFFF" : "#CBD5E1"} 
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* BOTÕES DE SELEÇÃO DE DATA COM POPUP NATIVO */}
                {selectedPeriod === 'custom' && (
                    <View style={styles.customDateContainer}>
                        <View style={styles.dateFieldWrapper}>
                            <Text style={styles.dateLabel}>DE (DATA INICIAL):</Text>
                            <TouchableOpacity 
                                style={styles.dateInputBox} 
                                onPress={() => setShowStartPicker(true)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="calendar-start" size={24} color="#5bc0de" />
                                <Text style={styles.dateValueText}>
                                    {formatDateToBR(startDate)}
                                </Text>
                                <MaterialCommunityIcons name="pencil-outline" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.dateFieldWrapper}>
                            <Text style={styles.dateLabel}>ATÉ (DATA FINAL):</Text>
                            <TouchableOpacity 
                                style={styles.dateInputBox} 
                                onPress={() => setShowEndPicker(true)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="calendar-end" size={24} color="#5bc0de" />
                                <Text style={styles.dateValueText}>
                                    {formatDateToBR(endDate)}
                                </Text>
                                <MaterialCommunityIcons name="pencil-outline" size={20} color="#94A3B8" />
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

            <View style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.generateButton, generating && styles.generateButtonDisabled]} 
                    onPress={handleGenerateReport}
                    disabled={generating}
                    activeOpacity={0.8}
                >
                    {generating ? (
                        <ActivityIndicator size="large" color="#FFFFFF" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="file-pdf-box" size={32} color="#FFFFFF" />
                            <Text style={styles.generateButtonText}>GERAR CALENDÁRIO PDF</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
        paddingBottom: 40,
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
    },
    sectionTitle: {
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
    footer: {
        padding: 20,
        paddingBottom: 28,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1.5,
        borderTopColor: '#E2E8F0',
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