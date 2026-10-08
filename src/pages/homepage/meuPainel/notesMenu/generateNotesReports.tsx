import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// Expo SDK 54+: 'expo-file-system/legacy'. Em versões anteriores, use 'expo-file-system'.
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

// Firebase
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';
import { themes } from '../../../../global/themes';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Componente Modal Adaptável Padronizado
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

interface MeasurementType {
    id: string;
    label: string;
    icon: string;
}

const MEASUREMENT_TYPES: MeasurementType[] = [
    { id: 'Pressão Arterial', label: 'Pressão Arterial', icon: 'heart-pulse' },
    { id: 'Glicemia', label: 'Glicemia (Açúcar)', icon: 'water' },
    { id: 'Peso', label: 'Peso Corporal', icon: 'scale-bathroom' },
    { id: 'Temperatura', label: 'Temperatura', icon: 'thermometer' },
    { id: 'Anotação de Voz', label: 'Anotações de Voz', icon: 'microphone' },
    { id: 'Sintomas', label: 'Sintomas / Queixas', icon: 'stethoscope' },
    { id: 'Outros', label: 'Geral / Outros', icon: 'notebook-outline' },
];

const KNOWN_TYPE_IDS = MEASUREMENT_TYPES.map(t => t.id);

const FIELD_LABELS: Record<string, string> = {
    emJejum: 'Estava em jejum',
    valorMgDl: 'Quantos Mg/Dl',
    sistolica: 'Pressão Sistólica (Máx)',
    diastolica: 'Pressão Diastólica (Mín)',
    braco: 'Braço utilizado',
    estadoEmocional: 'Estado emocional',
    postura: 'Postura',
    glicemia: 'Nível de Glicemia',
    peso: 'Peso Corporal',
    temperatura: 'Temperatura',
    pulsacao: 'Pulsação / Batimentos',
    sintomas: 'Sintomas Relatados',
    observacao: 'Observação',
    observacoes: 'Observações',
    notas: 'Notas Adicionais',
    medicamento: 'Medicamento Utilizado',
    dose: 'Dose Administrada',
    frequencia: 'Frequência',
    tipoMedicao: ''
};

const formatFieldValue = (key: string, val: any): string => {
    if (typeof val === 'boolean') {
        return val
            ? `<span style="color: #155724; background-color: #d4edda; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Sim</span>`
            : `<span style="color: #721c24; background-color: #f8d7da; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Não</span>`;
    }

    if (val === null || val === undefined || val === '') return '<i style="color: #999;">Não informado</i>';

    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('glicemia')) return `<strong>${val} mg/dL</strong>`;
    if (lowerKey.includes('temperatura')) return `<strong>${val} °C</strong>`;
    if (lowerKey.includes('peso')) return `<strong>${val} kg</strong>`;
    if (lowerKey.includes('sistolica') || lowerKey.includes('diastolica')) return `<strong>${val} mmHg</strong>`;
    if (lowerKey.includes('pulsacao')) return `<strong>${val} bpm</strong>`;

    return String(val);
};

const renderNoteDetails = (dados: any): string => {
    if (!dados || typeof dados !== 'object') return '';

    const itemsHtml = Object.entries(dados)
        .map(([k, v]) => {
            const label = FIELD_LABELS[k] || k;
            const formattedVal = formatFieldValue(k, v);
            return `
                <li style="margin-bottom: 6px; font-size: 15px;">
                    <span style="color: #0369a1; font-weight: bold;">${label}:</span> ${formattedVal}
                </li>
            `;
        })
        .join('');

    return `<ul style="list-style: none; padding-left: 0; margin-top: 8px; margin-bottom: 0;">${itemsHtml}</ul>`;
};

// Converte string, number, Date ou Timestamp do Firestore em Date (ou null se inválido)
const toDateSafe = (raw: any): Date | null => {
    if (!raw) return null;
    let d: Date;
    if (typeof raw?.toDate === 'function') {
        d = raw.toDate();
    } else if (raw?.seconds !== undefined) {
        d = new Date(raw.seconds * 1000);
    } else {
        d = new Date(raw);
    }
    return isNaN(d.getTime()) ? null : d;
};

const getNoteDate = (note: any): Date | null =>
    toDateSafe(note.dataRegistro || note.criadoEm || note.createdAt);

// Formato seguro para nome de arquivo (sem "/")
const formatDateForFile = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}-${m}-${date.getFullYear()}`;
};

const sanitizeForFileName = (text: string) =>
    text
        .replace(/[\\/:*?"<>|]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'perfil';

export function GenerateNotesReports() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    const { fontScale, isHighContrast, theme } = useAccessibility();

    const [generating, setGenerating] = useState(false);

    const responsibleUid = auth.currentUser?.uid || '';
    const activeUserId = route.params?.targetUserId || route.params?.activeUserId || route.params?.userId || responsibleUid;

    const initialUserName = route.params?.targetUserName || route.params?.activeUserName || route.params?.userName || (activeUserId === responsibleUid ? 'Meu Perfil (Responsável)' : '');
    const initialIsResponsavel = route.params?.isResponsavel ?? true;

    const [activeUserName, setActiveUserName] = useState<string>(initialUserName);
    const [isResponsavel, setIsResponsavel] = useState<boolean>(initialIsResponsavel);

    const [selectedPeriod, setSelectedPeriod] = useState<number | 'custom'>(30);
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('Erro');
    const [errorMessage, setErrorMessage] = useState('');

    const showError = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        setErrorModalVisible(true);
    };

    const toggleMeasurementType = (typeId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(item => item !== typeId)
                : [...prev, typeId]
        );
    };

    const handleToggleAllTypes = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (selectedTypes.length === MEASUREMENT_TYPES.length) {
            setSelectedTypes([]);
        } else {
            setSelectedTypes(MEASUREMENT_TYPES.map(m => m.id));
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

    useEffect(() => {
        const fetchUserDataIfNeeded = async () => {
            if (activeUserName || !activeUserId) return;

            try {
                if (responsibleUid && activeUserId !== responsibleUid) {
                    const depDoc = await getDoc(doc(db, 'users', responsibleUid, 'dependentes', activeUserId));
                    if (depDoc.exists()) {
                        const data = depDoc.data();
                        setActiveUserName(data.apelido || data.nome || 'Dependente');
                        return;
                    }
                }

                const targetUserDoc = await getDoc(doc(db, 'users', activeUserId));
                if (targetUserDoc.exists()) {
                    const data = targetUserDoc.data();
                    setActiveUserName(data.apelido || data.nome || 'Dependente');
                }
            } catch (error) {
                console.error('Erro ao buscar nome do usuário:', error);
            }
        };

        fetchUserDataIfNeeded();
    }, [activeUserId, responsibleUid, activeUserName]);

    const getResolvedType = (note: any): string => {
        if (note.tipoMedicao) {
            if (note.tipoMedicao === 'Pressão') return 'Pressão Arterial';
            return note.tipoMedicao;
        }
        if (note.text) {
            const lowerText = String(note.text).toLowerCase();
            if (lowerText.includes('glicemia') || lowerText.includes('açúcar')) return 'Glicemia';
            if (lowerText.includes('pressão')) return 'Pressão Arterial';
            if (lowerText.includes('peso')) return 'Peso';
            if (lowerText.includes('temperatura') || lowerText.includes('febre')) return 'Temperatura';
            if (lowerText.includes('oxigenação') || lowerText.includes('saturação')) return 'Outros';
            return 'Anotação de Voz';
        }
        return note.tipo || note.categoria || 'Outros';
    };

    const handleGenerateReport = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (!activeUserId) {
            showError('Erro ao Gerar', 'Nenhum perfil identificado para gerar o relatório.');
            return;
        }

        if (selectedTypes.length === 0) {
            showError('Atenção', 'Selecione pelo menos um tipo de medição para gerar o relatório.');
            return;
        }

        let filterStart: Date | null = null;
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
            filterEnd = new Date();
            filterEnd.setHours(23, 59, 59, 999);
            if (selectedPeriod !== 999) {
                filterStart = new Date();
                filterStart.setDate(now.getDate() - (selectedPeriod as number));
                filterStart.setHours(0, 0, 0, 0);
            }
        }

        setGenerating(true);

        // Deixa o spinner renderizar antes do processamento pesado
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const notesMap = new Map<string, any>();

            // 1. Busca no caminho do dependente
            if (responsibleUid && activeUserId !== responsibleUid) {
                try {
                    const dependentNotesRef = collection(db, 'users', responsibleUid, 'dependentes', activeUserId, 'notes');
                    const depSnap = await getDocs(query(dependentNotesRef));
                    depSnap.forEach(d => notesMap.set(d.id, { id: d.id, ...d.data() }));
                } catch (e) {}
            }

            // 2. Busca no caminho direto do usuário
            try {
                const directNotesRef = collection(db, 'users', activeUserId, 'notes');
                const directSnap = await getDocs(query(directNotesRef));
                directSnap.forEach(d => {
                    if (!notesMap.has(d.id)) {
                        notesMap.set(d.id, { id: d.id, ...d.data() });
                    }
                });
            } catch (e) {}

            const notesList = Array.from(notesMap.values());

            const filteredNotes = notesList.filter(note => {
                const noteDate = getNoteDate(note);

                let isWithinDate = true;
                if (noteDate) {
                    if (filterStart && noteDate < filterStart) isWithinDate = false;
                    if (noteDate > filterEnd) isWithinDate = false;
                }

                // Tipos desconhecidos contam como "Outros"
                const resolved = getResolvedType(note);
                const noteType = KNOWN_TYPE_IDS.includes(resolved) ? resolved : 'Outros';

                const isMatchingType =
                    selectedTypes.includes(noteType) ||
                    (selectedTypes.includes('Anotação de Voz') && note.origem === 'voz');

                return isWithinDate && isMatchingType;
            });

            filteredNotes.sort((a, b) => {
                const dateA = getNoteDate(a)?.getTime() ?? 0;
                const dateB = getNoteDate(b)?.getTime() ?? 0;
                return dateB - dateA;
            });

            const now = new Date();
            const periodLabel = selectedPeriod === 'custom'
                ? `De ${formatDateToBR(startDate)} até ${formatDateToBR(endDate)}`
                : selectedPeriod === 999 ? 'Todo o Histórico' : `Últimos ${selectedPeriod} Dias`;

            const notesHtml = filteredNotes.map(note => {
                const noteDate = getNoteDate(note);
                const dateFormatted = noteDate
                    ? noteDate.toLocaleDateString('pt-BR') + ' às ' + noteDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : 'Data não informada';

                let contentHtml = '';

                if (note.text || note.origem === 'voz') {
                    contentHtml = `
                        <div class="voice-box">
                            <p class="voice-text"><strong>🎤 Gravado por Voz:</strong><br> ${note.text || 'Sem texto processado'}</p>${note.rawSpeech && note.rawSpeech !== note.text ? `<p class="voice-raw">Fala original detectada: "${note.rawSpeech}"</p>` : ''}
                        </div>
                    `;
                }
                else if (note.dados && typeof note.dados === 'object' && Object.keys(note.dados).length > 0) {
                    contentHtml = renderNoteDetails(note.dados);
                }
                else {
                    const rawVal = note.valor || note.descricao || note.observacao || 'Sem detalhes';
                    contentHtml = `<p class="card-desc" style="margin-top: 10px;"><strong>Resultado/Nota:</strong> ${rawVal}</p>`;
                }

                return `
                    <div class="card">
                        <p class="card-title">${getResolvedType(note)}</p>
                        <p class="card-date">🗓 Registrado em: ${dateFormatted}</p>${contentHtml}
                    </div>
                `;
            }).join('');

            const htmlContent = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 30px; color: #1A1A1A; line-height: 1.6; }
                        .header { text-align: center; border-bottom: 4px solid #5bc0de; padding-bottom: 20px; margin-bottom: 30px; }
                        .header h1 { color: #0284c7; margin: 0; font-size: 30px; text-transform: uppercase; }
                        .header p { font-size: 18px; color: #444; margin: 8px 0 0 0; }
                        .filter-badge { display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-top: 10px; }
                        h2 { background-color: #5bc0de; color: #FFFFFF; padding: 12px 18px; border-radius: 8px; font-size: 22px; margin-top: 30px; }
                        .card { background-color: #F8F9FA; border: 2px solid #E0E0E0; border-left: 8px solid #5bc0de; padding: 18px; margin-bottom: 16px; border-radius: 8px; page-break-inside: avoid; }
                        .card-title { font-size: 20px; font-weight: bold; margin: 0 0 8px 0; color: #0284c7; text-transform: uppercase; }
                        .card-date { font-size: 16px; color: #475569; font-weight: bold; margin-bottom: 6px; }
                        .card-desc { font-size: 16px; color: #1e293b; margin: 0; }
                        .empty { font-size: 18px; color: #777; font-style: italic; padding: 10px; }
                        .voice-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; margin-top: 12px; }
                        .voice-text { margin: 0; font-size: 16px; color: #166534; }
                        .voice-raw { margin: 8px 0 0 0; font-size: 14px; color: #15803d; font-style: italic; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Relatório de Medições e Anotações</h1>
                        <p>Paciente/Perfil: <strong>${activeUserName || 'Não informado'}</strong></p>
                        <p>Emissão: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <div class="filter-badge">Período: ${periodLabel}</div>
                        <div class="filter-badge">Categorias: ${selectedTypes.join(', ')}</div>
                    </div>

                    <h2>REGISTROS E MEDIÇÕES</h2>
                    ${filteredNotes.length > 0
                        ? notesHtml
                        : '<p class="empty">Nenhuma anotação ou medição encontrada para o período e opções selecionadas.</p>'
                    }
                </body>
                </html>
            `;

            const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });

            // Data inicial do nome: no "Todo o Histórico" usa a nota mais antiga encontrada
            let fileStartLabel = 'inicio';
            if (filterStart) {
                fileStartLabel = formatDateForFile(filterStart);
            } else {
                const dates = filteredNotes
                    .map(n => getNoteDate(n)?.getTime())
                    .filter((t): t is number => typeof t === 'number');
                if (dates.length > 0) {
                    fileStartLabel = formatDateForFile(new Date(Math.min(...dates)));
                }
            }

            // Renomeia o PDF: anotações_{usuario}_{dataInicial}_até_{dataFinal}.pdf
            const fileName = `anotações_${sanitizeForFileName(activeUserName || 'perfil')}_${fileStartLabel}_até_${formatDateForFile(filterEnd)}.pdf`;
            const newUri = `${FileSystem.cacheDirectory}${fileName}`;

            await FileSystem.deleteAsync(newUri, { idempotent: true });
            await FileSystem.moveAsync({ from: tempUri, to: newUri });

            await Sharing.shareAsync(newUri, {
                mimeType: 'application/pdf',
                dialogTitle: fileName,
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

                    {isResponsavel && activeUserName ? (
                        <View style={styles.profileBadgeWrapper}>
                            <View
                                style={[
                                    styles.profileBadge,
                                    isHighContrast && {
                                        backgroundColor: theme.cardBackground,
                                        borderColor: theme.border,
                                        borderWidth: 1,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="account"
                                    size={20}
                                    color={isHighContrast ? theme.textPrimary : themes.colors.primary}
                                />
                                <Text
                                    style={[
                                        styles.profileBadgeText,
                                        { fontSize: 14 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                    ]}
                                >
                                    Perfil selecionado:{' '}
                                    <Text style={styles.profileBadgeName}>{activeUserName}</Text>
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {/* 1. SELEÇÃO MÚLTIPLA DE TIPOS DE MEDIÇÃO */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[
                            styles.sectionTitle,
                            { fontSize: 16 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>QUAIS MEDIÇÕES INCLUIR?</Text>
                        <TouchableOpacity
                            onPress={handleToggleAllTypes}
                            activeOpacity={0.7}
                            accessibilityLabel={selectedTypes.length === MEASUREMENT_TYPES.length ? "Desmarcar todos os tipos de medição" : "Marcar todos os tipos de medição"}
                            accessibilityRole="button"
                        >
                            <Text style={[
                                styles.toggleAllText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.buttonPrimary }
                            ]}>
                                {selectedTypes.length === MEASUREMENT_TYPES.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.typesGrid}>
                        {MEASUREMENT_TYPES.map((type) => {
                            const isChecked = selectedTypes.includes(type.id);
                            return (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.typeCard,
                                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border },
                                        isChecked && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : styles.typeCardChecked)
                                    ]}
                                    onPress={() => toggleMeasurementType(type.id)}
                                    activeOpacity={0.8}
                                    accessibilityLabel={`Medição ${type.label}, ${isChecked ? "selecionado" : "não selecionado"}`}
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons
                                        name={type.icon as any}
                                        size={30}
                                        color={isChecked ? (isHighContrast ? theme.buttonText : "#FFFFFF") : (isHighContrast ? theme.buttonPrimary : "#5bc0de")}
                                    />
                                    <Text style={[
                                        styles.typeCardText,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                        isChecked && (isHighContrast ? { color: theme.buttonText } : styles.typeCardTextChecked)
                                    ]}>
                                        {type.label}
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

                    {/* 2. SELEÇÃO DE PERÍODO */}
                    <Text style={[
                        styles.sectionTitle,
                        { marginTop: 24, fontSize: 18 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>QUAL PERÍODO DESEJA VER?</Text>

                    <View style={styles.periodGrid}>
                        {[
                            { label: 'Últimos 7 Dias', sub: '1 Semana', value: 7, icon: 'calendar-week' },
                            { label: 'Últimos 30 Dias', sub: '1 Mês', value: 30, icon: 'calendar-month' },
                            { label: 'Todo o Histórico', sub: 'Completo', value: 999, icon: 'calendar-clock' },
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
                        accessibilityLabel="Criar e compartilhar relatório em PDF"
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
                                ]}>CRIAR RELATÓRIO PDF</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <CustomNotificationModal
                visible={errorModalVisible}
                title={errorTitle}
                subtitle={errorMessage}
                iconName="alert-circle-outline"
                iconColor="#EF4444"
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
    profileBadgeWrapper: {
        marginBottom: 20,
    },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF3FF',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-start',
        gap: 6,
        maxWidth: '100%',
    },
    profileBadgeText: {
        color: '#333333',
        fontWeight: '500',
        flexShrink: 1,
    },
    profileBadgeName: {
        fontWeight: '900',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        flex: 1,
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
        paddingTop: 12,
        paddingBottom: 12,
    },
    generateButton: {
        flexDirection: 'row',
        backgroundColor: themes.colors.darkRed,
        paddingVertical: 12,
        paddingHorizontal: 16,
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
        flex: 1,
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
});