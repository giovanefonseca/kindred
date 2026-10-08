import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Firebase
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Componente Modal Adaptável Padronizado
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Tipagem flexível para aceitar dados do Formulário e da Voz
interface Note {
    id: string;
    tipoMedicao?: string;
    dados?: Record<string, any>;
    dataRegistro?: string;
    text?: string;
    criadoEm?: string;
    origem?: string;
    rawSpeech?: string;
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const LABELS_MAP: Record<string, string> = {
    valorMgDl: 'Glicemia (mg/dL)',
    emJejum: 'Estava em jejum?',
    sistolica: 'Número Maior (Máxima)',
    diastolica: 'Número Menor (Mínima)',
    postura: 'Postura',
    braco: 'Braço Utilizado',
    estadoEmocional: 'Estado Emocional',
    spO2: 'Nível de Oxigênio (%)',
    frequenciaCardiacaBpm: 'Batimentos (BPM)',
    nivelAtividade: 'Nível de Atividade',
    sintomasRespiratorios: 'Sintomas Respiratórios',
    nomeMedicamento: 'Medicamento',
    dosagem: 'Dosagem',
    horarioInsercao: 'Horário do Registro',
    horarioPlanejado: 'Horário Planejado',
    reacoesAdversas: 'Reações Adversas',
    alivioSintomas: 'Alívio dos Sintomas',
    valorCelsius: 'Temperatura (°C)',
    localMedicao: 'Local da Medição',
    usoAntitermicos: 'Usou Antitérmico?',
    sintomasAssociados: 'Sintomas Associados',
};

const noteTime = (n: Note) => new Date(n.dataRegistro || n.criadoEm || 0).getTime();

export function ViewNotes() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    // Recupera o ID do usuário/dependente selecionado ou usa o UID do usuário logado
    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId = route.params?.targetUserId || route.params?.activeUserId || route.params?.userId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros selecionados
    const [filterType, setFilterType] = useState<string>('Todas');
    const [filterDays, setFilterDays] = useState<number>(7);

    // Controle do Modal Customizado
    const [modalConfig, setModalConfig] = useState<{
        visible: boolean;
        title: string;
        subtitle: string;
        iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
        iconColor?: string;
    }>({
        visible: false,
        title: '',
        subtitle: ''
    });

    // Contexto Global de Acessibilidade com fallbacks seguros
    const accessibility = useAccessibility();
    const fontScale = accessibility?.fontScale ?? 1;
    const isHighContrast = accessibility?.isHighContrast ?? false;
    const theme = accessibility?.theme ?? {
        background: '#FFFFFF',
        cardBackground: '#FFFFFF',
        border: '#CBD5E1',
        textPrimary: '#1A1A1A',
        textSecondary: '#666666',
        buttonPrimary: '#198754',
        buttonText: '#FFFFFF',
    };

    const availableTypes = ['Todas', 'Glicemia', 'Pressão', 'Oxigenação do sangue', 'Medicação', 'Temperatura corporal', 'Anotação de Voz'];

    // Identificação do perfil selecionado e verificação de dependentes
    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                if (!currentUserUid) return;

                try {
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents = Array.isArray(currentUserData.dependentes) && currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    if (selectedUserId) {
                        if (selectedUserId === currentUserUid) {
                            if (isMounted) setTargetUserName('Meu Perfil (Responsável)');
                        } else {
                            const dependentDoc = await getDoc(doc(db, 'users', currentUserUid, 'dependentes', selectedUserId));
                            if (dependentDoc.exists() && isMounted) {
                                const data = dependentDoc.data();
                                setTargetUserName(data.apelido || data.nome || 'Dependente');
                            } else {
                                const targetUserDoc = await getDoc(doc(db, 'users', selectedUserId));
                                if (targetUserDoc.exists() && isMounted) {
                                    const data = targetUserDoc.data();
                                    setTargetUserName(data.apelido || data.nome || 'Dependente');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao verificar perfil selecionado em ViewNotes:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [selectedUserId, currentUserUid])
    );

    // Listener das notas.
    // Fonte principal: users/{selectedUserId}/notes (mesmo caminho que NewNoteView grava).
    // Fonte legada (somente leitura): users/{resp}/dependentes/{dep}/notes, mesclada por id,
    // para não perder notas antigas gravadas no caminho aninhado.
    // Deps SEM `theme`/`isHighContrast`: o objeto theme pode mudar de referência a cada render e recriar o listener.
    useFocusEffect(
        useCallback(() => {
            if (!selectedUserId) {
                setLoading(false);
                return;
            }

            setLoading(true);

            let primary: Note[] = [];
            let legacy: Note[] = [];

            const emit = () => {
                const byId = new Map<string, Note>();
                legacy.forEach((n) => byId.set(`legacy-${n.id}`, n));
                primary.forEach((n) => byId.set(n.id, n));
                const merged = Array.from(byId.values()).sort((a, b) => noteTime(b) - noteTime(a));
                setNotes(merged);
                setLoading(false);
            };

            const toNotes = (snapshot: any): Note[] =>
                snapshot.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() })) as Note[];

            const unsubPrimary = onSnapshot(
                query(collection(db, 'users', selectedUserId, 'notes')),
                (snapshot) => {
                    primary = toNotes(snapshot);
                    emit();
                },
                (error) => {
                    console.error('Erro ao buscar notas:', error);
                    setModalConfig({
                        visible: true,
                        title: 'Erro',
                        subtitle: 'Não foi possível carregar as anotações do servidor.',
                        iconName: 'close-circle-outline',
                    });
                    setLoading(false);
                }
            );

            let unsubLegacy: (() => void) | null = null;
            if (currentUserUid && selectedUserId !== currentUserUid) {
                unsubLegacy = onSnapshot(
                    query(collection(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'notes')),
                    (snapshot) => {
                        legacy = toNotes(snapshot);
                        emit();
                    },
                    (error) => {
                        // Caminho legado é opcional: falha de permissão/inexistência não deve quebrar a tela
                        console.warn('Notas legadas indisponíveis:', error?.code || error);
                    }
                );
            }

            return () => {
                unsubPrimary();
                if (unsubLegacy) unsubLegacy();
            };
        }, [selectedUserId, currentUserUid])
    );

    // Mapeamento normalizado para cobrir todas as variações de escrita e termos salvos
    const getResolvedType = (note: Note): string => {
        const rawType = (note.tipoMedicao || '').toLowerCase().trim();

        if (rawType.includes('glicemia') || rawType.includes('açúcar') || rawType.includes('acucar')) return 'Glicemia';
        if (rawType.includes('pressão') || rawType.includes('pressao')) return 'Pressão';
        if (rawType.includes('oxigenação') || rawType.includes('oxigenacao') || rawType.includes('saturação')) return 'Oxigenação do sangue';
        if (rawType.includes('medicação') || rawType.includes('medicacao') || rawType.includes('remédio')) return 'Medicação';
        if (rawType.includes('temperatura') || rawType.includes('febre')) return 'Temperatura corporal';
        if (rawType.includes('voz') || note.origem === 'voz') return 'Anotação de Voz';

        // Fallback analisando o texto livre ou conteúdo interno
        if (note.text) {
            const lowerText = note.text.toLowerCase();
            if (lowerText.includes('glicemia') || lowerText.includes('açúcar')) return 'Glicemia';
            if (lowerText.includes('pressão')) return 'Pressão';
            if (lowerText.includes('oxigenação') || lowerText.includes('saturação')) return 'Oxigenação do sangue';
            if (lowerText.includes('temperatura') || lowerText.includes('febre')) return 'Temperatura corporal';
            if (lowerText.includes('remédio') || lowerText.includes('medicamento')) return 'Medicação';
            return 'Anotação de Voz';
        }

        return 'Anotação de Voz';
    };

    const filteredNotes = notes.filter((note) => {
        const resolvedType = getResolvedType(note);

        if (filterType !== 'Todas') {
            if (filterType === 'Anotação de Voz') {
                if (note.origem !== 'voz' && resolvedType !== 'Anotação de Voz') return false;
            } else if (resolvedType !== filterType) {
                return false;
            }
        }

        if (filterDays > 0) {
            const rawDate = note.dataRegistro || note.criadoEm;
            if (rawDate) {
                const noteDate = new Date(rawDate);
                const limitDate = new Date();
                limitDate.setDate(limitDate.getDate() - filterDays);

                if (noteDate < limitDate) {
                    return false;
                }
            }
        }
        return true;
    });

    // Formatação manual: toLocaleDateString com hour/minute é pouco confiável no Hermes/Android
    const formatDateBr = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${dd} ${MONTHS_PT[date.getMonth()]}, ${hh}:${mm}`;
    };

    const getIconForType = (type: string) => {
        const color = isHighContrast ? theme.buttonPrimary : themes.colors.orange;
        switch (type) {
            case 'Glicemia': return <MaterialCommunityIcons name="water" size={28} color={color} />;
            case 'Pressão': return <MaterialCommunityIcons name="heart-pulse" size={28} color={color} />;
            case 'Medicação': return <MaterialCommunityIcons name="pill" size={28} color={color} />;
            case 'Temperatura corporal': return <MaterialCommunityIcons name="thermometer" size={28} color={color} />;
            case 'Oxigenação do sangue': return <MaterialCommunityIcons name="lungs" size={28} color={color} />;
            default: return <MaterialCommunityIcons name="note-text" size={28} color={color} />;
        }
    };

    const isEmptyValue = (value: any) =>
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

    const renderValue = (value: any) => {
        if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
    };

    return (
        <View style={[style.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView style={[style.container, isHighContrast && { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
                {/* CABEÇALHO */}
                <View style={[style.header, isHighContrast && { backgroundColor: theme.cardBackground, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                    <TouchableOpacity
                        style={style.backButton}
                        onPress={() => navigation.goBack()}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                    >
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        style.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>Histórico de Saúde</Text>
                </View>

                {/* ÁREA DE FILTROS */}
                <View style={[style.filtersContainer, isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>

                    {isResponsavel && targetUserName ? (
                        <View
                            style={[
                                style.profileBadge,
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
                                    style.profileBadgeText,
                                    { fontSize: 14 * fontScale },
                                    isHighContrast && { color: theme.textPrimary },
                                ]}
                            >
                                Perfil selecionado:{' '}
                                <Text style={style.profileBadgeName}>{targetUserName}</Text>
                            </Text>
                        </View>
                    ) : null}

                    <Text style={[
                        style.filterSectionTitle,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>Filtrar por tipo:</Text>

                    <View style={style.scrollWrapper}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={style.filtersScroll}
                            nestedScrollEnabled={true}
                            directionalLockEnabled={true}
                            overScrollMode="always"
                        >
                            {availableTypes.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        style.filterPill,
                                        isHighContrast && { backgroundColor: theme.background, borderColor: theme.border },
                                        filterType === type && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : style.filterPillActive)
                                    ]}
                                    onPress={() => setFilterType(type)}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Filtrar por ${type}`}
                                    accessibilityState={{ selected: filterType === type }}
                                >
                                    <Text style={[
                                        style.filterPillText,
                                        { fontSize: 16 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                        filterType === type && (isHighContrast ? { color: theme.buttonText } : style.filterPillTextActive)
                                    ]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <Text style={[
                        style.filterSectionTitle,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>Filtrar por período:</Text>
                    <View style={style.dateFilterRow}>
                        {[
                            { days: 7, label: 'Últimos 7 dias' },
                            { days: 30, label: 'Últimos 30 dias' },
                            { days: 0, label: 'Tudo' },
                        ].map((opt) => {
                            const active = filterDays === opt.days;
                            return (
                                <TouchableOpacity
                                    key={opt.days}
                                    style={[
                                        style.dateBtn,
                                        isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
                                        active && (isHighContrast ? { backgroundColor: theme.buttonPrimary } : style.dateBtnActive)
                                    ]}
                                    onPress={() => setFilterDays(opt.days)}
                                    accessibilityRole="button"
                                    accessibilityLabel={opt.label}
                                    accessibilityState={{ selected: active }}
                                >
                                    <Text style={[
                                        style.dateBtnText,
                                        { fontSize: 14 * fontScale },
                                        isHighContrast && { color: theme.textPrimary },
                                        active && (isHighContrast ? { color: theme.buttonText } : style.dateBtnTextActive)
                                    ]}>{opt.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* LISTA DE ANOTAÇÕES */}
                <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <ActivityIndicator size="large" color={isHighContrast ? theme.buttonPrimary : themes.colors.orange} style={{ marginTop: 50 }} />
                    ) : filteredNotes.length === 0 ? (
                        <View style={style.emptyState}>
                            <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color={isHighContrast ? theme.textSecondary : "#CCC"} />
                            <Text style={[
                                style.emptyStateText,
                                { fontSize: 18 * fontScale },
                                isHighContrast && { color: theme.textSecondary }
                            ]}>Nenhum registro encontrado para este filtro.</Text>
                        </View>
                    ) : (
                        filteredNotes.map((note, index) => {
                            const resolvedType = getResolvedType(note);
                            const rawDate = note.dataRegistro || note.criadoEm;

                            return (
                                <View key={`${note.id}-${index}`} style={[
                                    style.noteCard,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                                ]}>
                                    <View style={style.noteHeader}>
                                        <View style={style.noteTypeArea}>
                                            {getIconForType(resolvedType)}
                                            <Text style={[
                                                style.noteTypeTitle,
                                                { fontSize: 20 * fontScale },
                                                isHighContrast && { color: theme.textPrimary }
                                            ]}>{resolvedType}</Text>
                                        </View>
                                        <Text style={[
                                            style.noteDate,
                                            { fontSize: 14 * fontScale },
                                            isHighContrast && { color: theme.textSecondary }
                                        ]}>{formatDateBr(rawDate)}</Text>
                                    </View>

                                    {note.origem === 'voz' && (
                                        <View style={style.voiceBadgeContainer}>
                                            <FontAwesome name="microphone" size={14} color={isHighContrast ? theme.buttonPrimary : "#198754"} />
                                            <Text style={[
                                                style.voiceBadgeText,
                                                { fontSize: 13 * fontScale },
                                                isHighContrast && { color: theme.buttonPrimary }
                                            ]}>Gravado por voz</Text>
                                        </View>
                                    )}

                                    <View style={[
                                        style.divider,
                                        isHighContrast && { backgroundColor: theme.border }
                                    ]} />

                                    {/* EXIBIÇÃO: NOTA DE VOZ */}
                                    {note.text ? (
                                        <View style={[
                                            style.voiceNoteBox,
                                            isHighContrast && { backgroundColor: theme.background, borderColor: theme.border }
                                        ]}>
                                            <Text style={[
                                                style.voiceNoteText,
                                                { fontSize: 18 * fontScale },
                                                isHighContrast && { color: theme.textPrimary }
                                            ]}>{note.text}</Text>
                                            {note.rawSpeech && note.rawSpeech !== note.text && (
                                                <Text style={[
                                                    style.rawSpeechText,
                                                    { fontSize: 13 * fontScale },
                                                    isHighContrast && { color: theme.textSecondary }
                                                ]}>Fala original: "{note.rawSpeech}"</Text>
                                            )}
                                        </View>
                                    ) : (
                                        /* EXIBIÇÃO: FORMULÁRIO PADRÃO (campos vazios são omitidos) */
                                        <View style={style.noteDataArea}>
                                            {note.dados && Object.entries(note.dados)
                                                .filter(([, value]) => !isEmptyValue(value))
                                                .map(([key, value]) => (
                                                    <View key={key} style={[
                                                        style.dataRow,
                                                        isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }
                                                    ]}>
                                                        <Text style={[
                                                            style.dataLabel,
                                                            { fontSize: 16 * fontScale },
                                                            isHighContrast && { color: theme.textSecondary }
                                                        ]}>{LABELS_MAP[key] || key}</Text>
                                                        <Text style={[
                                                            style.dataValue,
                                                            { fontSize: 20 * fontScale },
                                                            isHighContrast && { color: theme.buttonPrimary }
                                                        ]}>{renderValue(value)}</Text>
                                                    </View>
                                                ))}
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {/* MODAL PADRONIZADO DE NOTIFICAÇÃO/ERRO */}
                <CustomNotificationModal
                    visible={modalConfig.visible}
                    title={modalConfig.title}
                    subtitle={modalConfig.subtitle}
                    iconName={modalConfig.iconName || 'alert-circle-outline'}
                    iconColor={modalConfig.iconColor || (isHighContrast ? theme.buttonPrimary : '#DC3545')}
                    closeText="Entendi"
                    closeButtonColor={modalConfig.iconColor || (isHighContrast ? theme.buttonPrimary : '#DC3545')}
                    onClose={() => setModalConfig(prev => ({ ...prev, visible: false }))}
                />
            </SafeAreaView>

            {/* ESPAÇAMENTO SEGURO DA BARRA NATIVA DO SISTEMA */}
            <SafeAreaView edges={['bottom']} style={isHighContrast && { backgroundColor: theme.background }} />
        </View>
    );
}

export default ViewNotes;

const style = StyleSheet.create({
    mainWrapper: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
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
        color: themes.colors.notBlack || '#1A1A1A',
        textTransform: 'uppercase',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 40,
    },
    filtersContainer: {
        backgroundColor: '#FFFFFF',
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
        paddingHorizontal: 20,
    },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF3FF',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginTop: 15,
        marginBottom: 5,
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
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 15,
        marginBottom: 10,
    },
    scrollWrapper: {
        height: 52,
        width: '100%',
    },
    filtersScroll: {
        alignItems: 'center',
        paddingRight: 20,
    },
    filterPill: {
        backgroundColor: '#F0F0F0',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 30,
        marginRight: 10,
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterPillActive: {
        backgroundColor: themes.colors.orange,
        borderColor: 'transparent',
    },
    filterPillText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#555',
        textAlign: 'center',
    },
    filterPillTextActive: {
        color: '#FFFFFF',
    },
    dateFilterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    dateBtn: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        paddingVertical: 14,
        paddingHorizontal: 6,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateBtnActive: {
        backgroundColor: themes.colors.notBlack || '#333',
    },
    dateBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#555',
        textAlign: 'center',
    },
    dateBtnTextActive: {
        color: '#FFFFFF',
    },
    noteCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 3,
        borderColor: themes.colors.orange,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    noteTypeArea: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    noteTypeTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1A1A1A',
        marginLeft: 10,
        flexShrink: 1,
    },
    noteDate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#777',
        marginLeft: 8,
    },
    voiceBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    voiceBadgeText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#198754',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginBottom: 16,
        marginTop: 4,
    },
    voiceNoteBox: {
        backgroundColor: '#F9FAFB',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    voiceNoteText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    rawSpeechText: {
        fontSize: 13,
        color: '#6B7280',
        fontStyle: 'italic',
        marginTop: 6,
    },
    noteDataArea: {
        gap: 10,
    },
    dataRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F9F9F9',
        padding: 12,
        borderRadius: 8,
        gap: 12,
    },
    dataLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#555',
        flexShrink: 1,
    },
    dataValue: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.orange,
        textAlign: 'right',
        flexShrink: 1,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyStateText: {
        fontSize: 18,
        color: '#888',
        textAlign: 'center',
        marginTop: 15,
        fontWeight: 'bold',
        paddingHorizontal: 20,
    }
});