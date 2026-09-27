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
    { id: 'Sintomas', label: 'Sintomas / Queixas', icon: 'stethoscope' },
    { id: 'Outros', label: 'Geral / Outros', icon: 'notebook-outline' },
];

// ---------------------------------------------------------------------------
// DICIONÁRIO DE TRADUÇÃO E FORMATAÇÃO VISUAL DOS CAMPOS
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export function GenerateNotesReports() {
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

    // Tipos de medição selecionados
 // Categorias de lembretes selecionadas (Inicia vazio/desmarcado)
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

    // Helper para sanitizar strings e tornar seguras para nomes de arquivos
    const sanitizeFileName = (text: string) => {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .toLowerCase();
    };

    // Alternar seleção individual sem restrição
    const toggleMeasurementType = (typeId: string) => {
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(item => item !== typeId)
                : [...prev, typeId]
        );
    };

    // Alternar entre Marcar Todos e Desmarcar Todos livremente
    const handleToggleAllTypes = () => {
        if (selectedTypes.length === MEASUREMENT_TYPES.length) {
            setSelectedTypes([]);
        } else {
            setSelectedTypes(MEASUREMENT_TYPES.map(m => m.id));
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

    // Helper para formatar Date para exibição na tela (DD/MM/AAAA)
    const formatDateToBR = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Carrega o nome do perfil selecionado na HomePage
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

    // Geração do PDF
    const handleGenerateReport = async () => {
        if (!activeUserId) {
            Alert.alert('Erro', 'Nenhum perfil identificado para gerar o relatório.');
            return;
        }

        if (selectedTypes.length === 0) {
            Alert.alert('Atenção', 'Selecione pelo menos um tipo de medição para gerar o relatório.');
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
            filterEnd = now;
            if (selectedPeriod !== 999) {
                filterStart = new Date();
                filterStart.setDate(now.getDate() - (selectedPeriod as number));
                filterStart.setHours(0, 0, 0, 0);
            }
        }

        setGenerating(true);

        try {
            const notesRef = collection(db, 'users', activeUserId, 'notes');
            const notesSnap = await getDocs(query(notesRef));
            const notesList: any[] = [];
            notesSnap.forEach(d => notesList.push({ id: d.id, ...d.data() }));

            // Aplicação dos Filtros de Data e Categoria
            const filteredNotes = notesList.filter(note => {
                const rawDate = note.dataRegistro || note.criadoEm || note.createdAt;
                const noteDate = rawDate ? new Date(rawDate) : null;

                let isWithinDate = true;
                if (noteDate) {
                    if (filterStart && noteDate < filterStart) isWithinDate = false;
                    if (filterEnd && noteDate > filterEnd) isWithinDate = false;
                }

                const noteType = note.tipoMedicao || note.tipo || note.categoria || 'Outros';
                const isMatchingType = selectedTypes.includes(noteType) || selectedTypes.includes('Outros');

                return isWithinDate && isMatchingType;
            });

            const now = new Date();
            const periodLabel = selectedPeriod === 'custom'
                ? `De ${formatDateToBR(startDate)} até ${formatDateToBR(endDate)}`
                : selectedPeriod === 999 ? 'Todo o Histórico' : `Últimos ${selectedPeriod} Dias`;

            // Template HTML do PDF
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
                        .card { background-color: #F8F9FA; border: 2px solid #E0E0E0; border-left: 8px solid #5bc0de; padding: 18px; margin-bottom: 16px; border-radius: 8px; }
                        .card-title { font-size: 20px; font-weight: bold; margin: 0 0 8px 0; color: #0284c7; }
                        .card-date { font-size: 16px; color: #475569; font-weight: bold; margin-bottom: 6px; }
                        .card-desc { font-size: 16px; color: #1e293b; margin: 0; }
                        .empty { font-size: 18px; color: #777; font-style: italic; padding: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Relatório de Medições e Anotações</h1>
                        <p>Paciente/Perfil: <strong>${activeUserName}</strong></p>
                        <p>Emissão: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <div class="filter-badge">Período: ${periodLabel}</div>
                        <div class="filter-badge">Categorias: ${selectedTypes.join(', ')}</div>
                    </div>

                    <h2>REGISTROS E MEDIÇÕES</h2>
                    ${filteredNotes.length > 0 
                        ? filteredNotes.map(note => {
                            const dateFormatted = note.dataRegistro 
                                ? new Date(note.dataRegistro).toLocaleDateString('pt-BR') + ' às ' + new Date(note.dataRegistro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                : 'Data não informada';

                            let contentHtml = '';
                            if (note.dados && typeof note.dados === 'object' && Object.keys(note.dados).length > 0) {
                                contentHtml = renderNoteDetails(note.dados);
                            } else {
                                const rawVal = note.valor || note.descricao || note.observacao || 'Sem detalhes';
                                contentHtml = `<p class="card-desc"><strong>Resultado/Nota:</strong> ${rawVal}</p>`;
                            }

                            return `
                                <div class="card">
                                    <p class="card-title">${note.tipoMedicao || note.titulo || note.tipo || 'Anotação'}</p>
                                    <p class="card-date">🗓 Registrado em: ${dateFormatted}</p>${contentHtml}
                                </div>
                            `;
                        }).join('')
                        : '<p class="empty">Nenhuma anotação ou medição encontrada para o período e opções selecionadas.</p>'
                    }
                </body>
                </html>
            `;

            // 1. Gerar PDF temporário inicial
            const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });

            // 2. Definir sufixo da competência / período
            let periodSuffix = '';
            if (selectedPeriod === 'custom') {
                periodSuffix = `${formatDateToBR(startDate)}-a-${formatDateToBR(endDate)}`;
            } else if (selectedPeriod === 999) {
                periodSuffix = 'historico-completo';
            } else {
                periodSuffix = `ultimos-${selectedPeriod}-dias`;
            }

            // 3. Montar nome limpo: anotacoes_nomeusuario_periodo.pdf
            const cleanUserName = sanitizeFileName(activeUserName);
            const cleanPeriod = sanitizeFileName(periodSuffix);
            const fileName = `anotacoes_${cleanUserName}_${cleanPeriod}.pdf`;

            // 4. Mover para o diretório de documentos com o nome customizado
            const targetUri = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.moveAsync({
                from: tempUri,
                to: targetUri,
            });

            // 5. Compartilhar ficheiro renomeado
            await Sharing.shareAsync(targetUri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Partilhar Relatório de Anotações',
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
                        Gerando relatório de: <Text style={styles.profileNameBold}>{activeUserName}</Text>
                    </Text>
                </View>

                {/* 1. SELEÇÃO MÚLTIPLA DE TIPOS DE MEDIÇÃO */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>QUAIS MEDIÇÕES INCLUIR?</Text>
                    <TouchableOpacity onPress={handleToggleAllTypes} activeOpacity={0.7}>
                        <Text style={styles.toggleAllText}>
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
                                style={[styles.typeCard, isChecked && styles.typeCardChecked]}
                                onPress={() => toggleMeasurementType(type.id)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons 
                                    name={type.icon as any} 
                                    size={30} 
                                    color={isChecked ? "#FFFFFF" : "#5bc0de"} 
                                />
                                <Text style={[styles.typeCardText, isChecked && styles.typeCardTextChecked]}>
                                    {type.label}
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

                {/* 2. SELEÇÃO DE PERÍODO */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>QUAL PERÍODO DESEJA VER?</Text>
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

                {/* BOTÕES DE SELEÇÃO DE DATA COM POPUP NATIVO DO ANDROID/IOS */}
                {selectedPeriod === 'custom' && (
                    <View style={styles.customDateContainer}>
                        
                        {/* Botão Data Inicial */}
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

                        {/* Botão Data Final */}
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

                        {/* Modal Nativo Data Inicial */}
                        {showStartPicker && (
                            <DateTimePicker
                                value={startDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onChangeStartDate}
                            />
                        )}

                        {/* Modal Nativo Data Final */}
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
                            <Text style={styles.generateButtonText}>CRIAR RELATÓRIO PDF</Text>
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