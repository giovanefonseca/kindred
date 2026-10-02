import React, { useState, useEffect, useCallback } from 'react';
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
import { collection, query, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
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

    useFocusEffect(
        useCallback(() => {
            if (!selectedUserId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            let unsubscribe: (() => void) | null = null;

            const setupListener = async () => {
                let notesRef;

                if (currentUserUid && selectedUserId !== currentUserUid) {
                    try {
                        const depNotesRef = collection(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'notes');
                        const depSnap = await getDocs(depNotesRef);
                        if (!depSnap.empty) {
                            notesRef = depNotesRef;
                        }
                    } catch (e) {
                        // Ignora
                    }
                }

                if (!notesRef) {
                    notesRef = collection(db, 'users', selectedUserId, 'notes');
                }

                const q = query(notesRef);

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const fetchedNotes = snapshot.docs.map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    })) as Note[];

                    fetchedNotes.sort((a, b) => {
                        const dateA = new Date(a.dataRegistro || a.criadoEm || 0).getTime();
                        const dateB = new Date(b.dataRegistro || b.criadoEm || 0).getTime();
                        return dateB - dateA;
                    });

                    setNotes(fetchedNotes);
                    setLoading(false);
                }, (error) => {
                    console.error('Erro ao buscar notas:', error);
                    setModalConfig({
                        visible: true,
                        title: 'Erro',
                        subtitle: 'Não foi possível carregar as anotações do servidor.',
                        iconName: 'close-circle-outline',
                        iconColor: isHighContrast ? theme.buttonPrimary : '#DC3545'
                    });
                    setLoading(false);
                });
            };

            setupListener();

            return () => {
                if (unsubscribe) unsubscribe();
            };
        }, [selectedUserId, currentUserUid, isHighContrast, theme])
    );

    const getResolvedType = (note: Note): string => {
        if (note.tipoMedicao) return note.tipoMedicao;
        if (note.text) {
            const lowerText = note.text.toLowerCase();
            if (lowerText.includes('glicemia') || lowerText.includes('açúcar')) return 'Glicemia';
            if (lowerText.includes('pressão')) return 'Pressão';
            if (lowerText.includes('oxigenação') || lowerText.includes('saturação')) return 'Oxigenação do sangue';
            if (lowerText.includes('peso')) return 'Peso';
            if (lowerText.includes('temperatura') || lowerText.includes('febre')) return 'Temperatura corporal';
            return 'Anotação de Voz';
        }
        return 'Glicemia';
    };

    const filteredNotes = notes.filter((note) => {
        const resolvedType = getResolvedType(note);

        if (filterType !== 'Todas') {
            if (filterType === 'Anotação de Voz') {
                if (note.origem !== 'voz') return false;
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

    const formatDateBr = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(' de ', ' ');
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

    return (
        <View style={[style.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView style={[style.container, isHighContrast && { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
                {/* CABEÇALHO */}
                <View style={[style.header, isHighContrast && { backgroundColor: theme.cardBackground, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                    <TouchableOpacity style={style.backButton} onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        style.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>Histórico de Saúde</Text>
                </View>

                {/* ÁREA DE FILTROS E CONTEÚDO */}
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
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style.filtersScroll}>
                        {availableTypes.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    style.filterPill,
                                    isHighContrast && { backgroundColor: theme.background, borderColor: theme.border },
                                    filterType === type && (isHighContrast ? { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary } : style.filterPillActive)
                                ]}
                                onPress={() => setFilterType(type)}
                                activeOpacity={0.8}
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

                    <Text style={[
                        style.filterSectionTitle,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>Filtrar por período:</Text>
                    <View style={style.dateFilterRow}>
                        <TouchableOpacity
                            style={[
                                style.dateBtn,
                                isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
                                filterDays === 7 && (isHighContrast ? { backgroundColor: theme.buttonPrimary } : style.dateBtnActive)
                            ]}
                            onPress={() => setFilterDays(7)}
                        >
                            <Text style={[
                                style.dateBtnText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.textPrimary },
                                filterDays === 7 && (isHighContrast ? { color: theme.buttonText } : style.dateBtnTextActive)
                            ]}>Últimos 7 dias</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                style.dateBtn,
                                isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
                                filterDays === 30 && (isHighContrast ? { backgroundColor: theme.buttonPrimary } : style.dateBtnActive)
                            ]}
                            onPress={() => setFilterDays(30)}
                        >
                            <Text style={[
                                style.dateBtnText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.textPrimary },
                                filterDays === 30 && (isHighContrast ? { color: theme.buttonText } : style.dateBtnTextActive)
                            ]}>Últimos 30 dias</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                style.dateBtn,
                                isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
                                filterDays === 0 && (isHighContrast ? { backgroundColor: theme.buttonPrimary } : style.dateBtnActive)
                            ]}
                            onPress={() => setFilterDays(0)}
                        >
                            <Text style={[
                                style.dateBtnText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.textPrimary },
                                filterDays === 0 && (isHighContrast ? { color: theme.buttonText } : style.dateBtnTextActive)
                            ]}>Tudo</Text>
                        </TouchableOpacity>
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
                        filteredNotes.map((note) => {
                            const resolvedType = getResolvedType(note);
                            const rawDate = note.dataRegistro || note.criadoEm;

                            return (
                                <View key={note.id} style={[
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
                                        /* EXIBIÇÃO: FORMULÁRIO PADRÃO */
                                        <View style={style.noteDataArea}>
                                            {note.dados && Object.entries(note.dados).map(([key, value]) => {
                                                const labelsMap: Record<string, string> = {
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

                                                const labelFormatado = labelsMap[key] || key.toUpperCase();

                                                const renderValue = () => {
                                                    if (typeof value === 'boolean') {
                                                        return value ? 'Sim' : 'Não';
                                                    }
                                                    if (Array.isArray(value)) {
                                                        return value.join(', ');
                                                    }
                                                    return String(value);
                                                };

                                                return (
                                                    <View key={key} style={[
                                                        style.dataRow,
                                                        isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }
                                                    ]}>
                                                        <Text style={[
                                                            style.dataLabel,
                                                            { fontSize: 16 * fontScale },
                                                            isHighContrast && { color: theme.textSecondary }
                                                        ]}>{labelFormatado}</Text>
                                                        <Text style={[
                                                            style.dataValue,
                                                            { fontSize: 20 * fontScale },
                                                            isHighContrast && { color: theme.buttonPrimary }
                                                        ]}>{renderValue()}</Text>
                                                    </View>
                                                );
                                            })}
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
        paddingHorizontal: 20, // Garante respiro alinhado dentro do container de filtros
    },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF3FF',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginTop: 15, // Mantém o espaçamento superior padronizado igual ao modelo de referência
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
    filtersScroll: {
        paddingBottom: 5,
    },
    filterPill: {
        backgroundColor: '#F0F0F0',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginRight: 10, // Utilizado margin-right em vez de marginHorizontal para melhor espaçamento no scroll horizontal
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
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
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
    },
    noteTypeTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1A1A1A',
        marginLeft: 10,
    },
    noteDate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#777',
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
    },
    dataLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#555',
        textAlign: 'center',
    },
    dataValue: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.orange,
        textAlign: 'center',
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