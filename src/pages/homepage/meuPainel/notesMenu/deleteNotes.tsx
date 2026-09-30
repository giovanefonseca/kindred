import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

// Firebase
import { collection, query, onSnapshot, doc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';
import { themes } from '../../../../global/themes';

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
    // Campos do fluxo por voz
    text?: string;
    criadoEm?: string;
    origem?: string;
    rawSpeech?: string;
}

export function DeleteNotes() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    // Recupera o ID do usuário/dependente ativo
    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId = route.params?.targetUserId || route.params?.activeUserId || route.params?.userId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    // Estados do Modal Customizado de Exclusão
    const [modalVisible, setModalVisible] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<{ id: string; tipo: string } | null>(null);

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

    // Identificação do perfil selecionado e verificação de dependentes
    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                if (!currentUserUid) return;

                try {
                    // 1. Verifica se o usuário atual é responsável
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents = Array.isArray(currentUserData.dependentes) && currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    // 2. Busca o nome do perfil selecionado
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
                    console.error('Erro ao verificar perfil selecionado em DeleteNotes:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [selectedUserId, currentUserUid])
    );

    // 1. Busca as anotações em tempo real
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

                // Se selectedUserId pertence a um dependente, busca na subcoleção do responsável
                if (currentUserUid && selectedUserId !== currentUserUid) {
                    try {
                        const depNotesRef = collection(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'notes');
                        const depSnap = await getDocs(depNotesRef);
                        if (!depSnap.empty) {
                            notesRef = depNotesRef;
                        }
                    } catch (e) {
                        // Ignora erro
                    }
                }

                // Caso contrário, utiliza o caminho padrão do usuário
                if (!notesRef) {
                    notesRef = collection(db, 'users', selectedUserId, 'notes');
                }

                const q = query(notesRef);

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const fetchedNotes = snapshot.docs.map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    })) as Note[];

                    // Ordena manualmente por data decrescente
                    fetchedNotes.sort((a, b) => {
                        const dateA = new Date(a.dataRegistro || a.criadoEm || 0).getTime();
                        const dateB = new Date(b.dataRegistro || b.criadoEm || 0).getTime();
                        return dateB - dateA;
                    });

                    setNotes(fetchedNotes);
                    setLoading(false);
                }, (error) => {
                    console.error('Erro ao buscar notas:', error);
                    Alert.alert('Erro', 'Não foi possível carregar as anotações.');
                    setLoading(false);
                });
            };

            setupListener();

            return () => {
                if (unsubscribe) unsubscribe();
            };
        }, [selectedUserId, currentUserUid])
    );

    // Função para obter o título/tipo da anotação
    const getResolvedType = (note: Note): string => {
        if (note.tipoMedicao) return note.tipoMedicao;
        if (note.text) {
            const lowerText = note.text.toLowerCase();
            if (lowerText.includes('glicemia') || lowerText.includes('açúcar')) return 'Glicemia';
            if (lowerText.includes('pressão')) return 'Pressão';
            if (lowerText.includes('oxigenação') || lowerText.includes('saturação')) return 'Oxigenação';
            if (lowerText.includes('peso')) return 'Peso';
            if (lowerText.includes('temperatura') || lowerText.includes('febre')) return 'Temperatura';
            return 'Anotação de Voz';
        }
        return 'Anotação';
    };

    // 2. Aciona a abertura do modal personalizado
    const confirmDelete = (noteId: string, tipoMedicao: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setNoteToDelete({ id: noteId, tipo: tipoMedicao });
        setModalVisible(true);
    };

    // 3. Executa a exclusão instantânea na UI (Otimista) e remove no Firebase em ambos os caminhos possíveis
    const handleDeleteExecute = async () => {
        if (!noteToDelete || !selectedUserId) return;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const noteIdToDelete = noteToDelete.id;

        // Atualização Otimista na Interface
        setNotes(prev => prev.filter(item => item.id !== noteIdToDelete));

        // Fecha o modal
        setModalVisible(false);
        setNoteToDelete(null);

        try {
            // Se for dependente, apaga da subcoleção do responsável
            if (currentUserUid && selectedUserId !== currentUserUid) {
                const depNoteRef = doc(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'notes', noteIdToDelete);
                await deleteDoc(depNoteRef).catch(() => {});
            }

            // Garante o apagar também no caminho direto do usuário caso exista
            const mainNoteRef = doc(db, 'users', selectedUserId, 'notes', noteIdToDelete);
            await deleteDoc(mainNoteRef).catch(() => {});

        } catch (error) {
            console.error("Erro ao excluir anotação no Firestore:", error);
            Alert.alert('Erro', 'Não foi possível excluir a anotação no servidor.');
        }
    };

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

    return (
        <View style={[style.mainWrapper, isHighContrast && { backgroundColor: theme.background }]}>
            <SafeAreaView style={[style.container, isHighContrast && { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
                
                {/* CABEÇALHO */}
                <View style={[style.header, isHighContrast && { backgroundColor: theme.cardBackground, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={style.backButton}>
                        <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                    </TouchableOpacity>
                    <Text style={[
                        style.title,
                        { fontSize: 20 * fontScale },
                        isHighContrast && { color: theme.buttonPrimary }
                    ]}>EXCLUIR ANOTAÇÕES</Text>
                </View>

                {/* AVISO VISUAL */}
                <View style={[
                    style.warningBanner,
                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderBottomWidth: 1 }
                ]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={24} color={isHighContrast ? theme.buttonPrimary : "#856404"} />
                    <Text style={[
                        style.warningText,
                        { fontSize: 14 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]}>Atenção: Os itens apagados não poderão ser recuperados.</Text>
                </View>

                {/* LISTA DE ANOTAÇÕES PARA EXCLUIR */}
                <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    {/* BADGE VISUAL DE PERFIL SELECIONADO */}
                    {isResponsavel && targetUserName ? (
                        <View style={[
                            style.profileBadge,
                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                        ]}>
                            <MaterialCommunityIcons 
                                name="account" 
                                size={20} 
                                color={isHighContrast ? theme.textPrimary : themes.colors.primary} 
                            />
                            <Text style={[
                                style.profileBadgeText,
                                { fontSize: 14 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>
                                Perfil selecionado: <Text style={{ fontWeight: '900' }}>{targetUserName}</Text>
                            </Text>
                        </View>
                    ) : null}

                    {loading ? (
                        <ActivityIndicator size="large" color={isHighContrast ? theme.buttonPrimary : "#d9534f"} style={{ marginTop: 50 }} />
                    ) : notes.length === 0 ? (
                        <View style={style.emptyState}>
                            <MaterialCommunityIcons name="folder-check-outline" size={60} color={isHighContrast ? theme.textSecondary : "#CCC"} />
                            <Text style={[
                                style.emptyStateText,
                                { fontSize: 18 * fontScale },
                                isHighContrast && { color: theme.textSecondary }
                            ]}>Sua lista está vazia. Não há nada para excluir.</Text>
                        </View>
                    ) : (
                        notes.map((note) => {
                            const resolvedType = getResolvedType(note);
                            const rawDate = note.dataRegistro || note.criadoEm;

                            return (
                                <View key={note.id} style={[
                                    style.noteCard,
                                    isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                                ]}>
                                    
                                    {/* DADOS DA NOTA (Esquerda) */}
                                    <View style={style.noteInfo}>
                                        <Text style={[
                                            style.noteTypeTitle,
                                            { fontSize: 18 * fontScale },
                                            isHighContrast && { color: theme.textPrimary }
                                        ]}>{resolvedType.toUpperCase()}</Text>
                                        <Text style={[
                                            style.noteDate,
                                            { fontSize: 14 * fontScale },
                                            isHighContrast && { color: theme.textSecondary }
                                        ]}>{formatDateBr(rawDate)}</Text>
                                        
                                        {note.origem === 'voz' && (
                                            <View style={style.voiceBadgeContainer}>
                                                <FontAwesome name="microphone" size={12} color={isHighContrast ? theme.buttonPrimary : "#198754"} />
                                                <Text style={[
                                                    style.voiceBadgeText,
                                                    { fontSize: 12 * fontScale },
                                                    isHighContrast && { color: theme.buttonPrimary }
                                                ]}>Gravado por voz</Text>
                                            </View>
                                        )}

                                        {/* EXIBIÇÃO: SE FOR ANOTAÇÃO DE VOZ */}
                                        {note.text ? (
                                            <View style={[
                                                style.voiceDataBox,
                                                isHighContrast && { backgroundColor: theme.background, borderColor: theme.border }
                                            ]}>
                                                <Text style={[
                                                    style.voiceDataText,
                                                    { fontSize: 15 * fontScale },
                                                    isHighContrast && { color: theme.textPrimary }
                                                ]}>{note.text}</Text>
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
                                                        <Text key={key} style={[
                                                            style.dataSummary,
                                                            { fontSize: 15 * fontScale },
                                                            isHighContrast && { color: theme.textSecondary }
                                                        ]}>
                                                            • {labelFormatado} <Text style={{fontWeight: 'bold'}}>{renderValue()}</Text>
                                                        </Text>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>

                                    {/* BOTÃO DE EXCLUIR (Direita) */}
                                    <TouchableOpacity 
                                        style={style.deleteButton}
                                        activeOpacity={0.7}
                                        onPress={() => confirmDelete(note.id, resolvedType)}
                                        accessibilityLabel={`Excluir anotação de ${resolvedType}`}
                                        accessibilityRole="button"
                                    >
                                        <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FFFFFF" />
                                    </TouchableOpacity>
                                    
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {/* MODAL CUSTOMIZADO DE EXCLUSÃO VIA CHILDREN */}
                <CustomNotificationModal
                    visible={modalVisible}
                    title="Excluir Anotação"
                    subtitle={`Tem certeza que deseja apagar permanentemente esta anotação de ${noteToDelete?.tipo || ''}?`}
                    iconName="alert-outline"
                    iconColor="#EF4444"
                    hideDefaultButtons={true}
                    onClose={() => setModalVisible(false)}
                >
                    <View style={style.modalButtonRow}>
                        <TouchableOpacity 
                            style={[
                                style.modalCancelButton,
                                isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                            ]} 
                            onPress={() => setModalVisible(false)} 
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                style.modalCancelText,
                                { fontSize: 16 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>CANCELAR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={style.modalDeleteButton} 
                            onPress={handleDeleteExecute} 
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                style.modalDeleteText,
                                { fontSize: 16 * fontScale }
                            ]}>SIM, EXCLUIR</Text>
                        </TouchableOpacity>
                    </View>
                </CustomNotificationModal>

            </SafeAreaView>

            {/* ESPAÇAMENTO SEGURO DA BARRA NATIVA DO SISTEMA */}
            <SafeAreaView edges={['bottom']} style={isHighContrast && { backgroundColor: theme.background }} />
        </View>
    );
}

// ==========================================
// ESTILOS DIRETOS NO ARQUIVO
// ==========================================
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
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        position: 'relative',
        zIndex: 10,
    },
    backButton: {
        position: 'absolute',
        left: 20,
        padding: 4,
        zIndex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: "#d9534f",
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    warningBanner: {
        flexDirection: 'row',
        backgroundColor: '#fff3cd',
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#ffeeba',
    },
    warningText: {
        color: '#856404',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF3FF',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 16,
        gap: 6,
    },
    profileBadgeText: {
        color: '#333333',
        fontWeight: '500',
    },
    noteCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'gray',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        alignItems: 'center',
    },
    noteInfo: {
        flex: 1,
        paddingRight: 15,
    },
    noteTypeTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1A1A1A',
        marginBottom: 2,
    },
    noteDate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#777',
        marginBottom: 4,
    },
    voiceBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    voiceBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#198754',
    },
    voiceDataBox: {
        marginTop: 4,
        backgroundColor: '#F9FAFB',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    voiceDataText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#333333',
    },
    noteDataArea: {
        marginTop: 4,
    },
    dataSummary: {
        fontSize: 15,
        color: '#555',
        marginBottom: 2,
    },
    deleteButton: {
        backgroundColor: '#d9534f',
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#d9534f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
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
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    modalCancelText: {
        color: '#555',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalDeleteButton: {
        flex: 1,
        backgroundColor: '#d9534f',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalDeleteText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});