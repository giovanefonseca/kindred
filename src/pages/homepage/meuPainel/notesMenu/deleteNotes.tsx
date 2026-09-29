import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Firebase
import { collection, query, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

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

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO DE EXCLUSÃO
// ---------------------------------------------------------------------------
interface CustomDeleteModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    onClose: () => void;
    onDelete: () => void;
}

function CustomDeleteModal({ visible, title, subtitle, onClose, onDelete }: CustomDeleteModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={modalStyles.iconCircle}>
                        <Feather name="alert-triangle" size={40} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={modalStyles.subtitle}>{subtitle}</Text>

                    <View style={modalStyles.buttonRow}>
                        <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose} activeOpacity={0.8}>
                            <Text style={modalStyles.cancelText}>CANCELAR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={modalStyles.deleteButtonModal} onPress={onDelete} activeOpacity={0.8}>
                            <Text style={modalStyles.deleteTextModal}>SIM, EXCLUIR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export function DeleteNotes() {
    const navigation = useNavigation();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    // Estados do Modal Customizado de Exclusão
    const [modalVisible, setModalVisible] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<{ id: string; tipo: string } | null>(null);

    // 1. Busca as anotações em tempo real
    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'users', userId, 'notes')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Note[];
            
            // Ordena manualmente por data decrescente (suportando dataRegistro ou criadoEm)
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

        return () => unsubscribe();
    }, []);

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
        setNoteToDelete({ id: noteId, tipo: tipoMedicao });
        setModalVisible(true);
    };

    // 3. Executa a exclusão instantânea na UI e remove no Firebase em segundo plano
    const handleDeleteExecute = () => {
        if (!noteToDelete) return;

        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const noteIdToDelete = noteToDelete.id;

        // Fecha o modal e limpa o estado
        setModalVisible(false);
        setNoteToDelete(null);

        // Apaga no Firestore
        const noteRef = doc(db, 'users', userId, 'notes', noteIdToDelete);
        deleteDoc(noteRef).catch((error) => {
            console.error("Erro ao excluir:", error);
            Alert.alert('Erro', 'Não foi possível excluir a anotação.');
        });
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
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
            
            {/* CABEÇALHO */}
            <View style={style.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={style.backButton}>
                    <Feather name="arrow-left" size={28} color="#1A11A" />
                </TouchableOpacity>
                <Text style={style.title}>EXCLUIR ANOTAÇÕES</Text>
            </View>

            {/* AVISO VISUAL */}
            <View style={style.warningBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#856404" />
                <Text style={style.warningText}>Atenção: Os itens apagados não poderão ser recuperados.</Text>
            </View>

            {/* LISTA DE ANOTAÇÕES PARA EXCLUIR */}
            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="large" color="#d9534f" style={{ marginTop: 50 }} />
                ) : notes.length === 0 ? (
                    <View style={style.emptyState}>
                        <MaterialCommunityIcons name="folder-check-outline" size={60} color="#CCC" />
                        <Text style={style.emptyStateText}>Sua lista está vazia. Não há nada para excluir.</Text>
                    </View>
                ) : (
                    notes.map((note) => {
                        const resolvedType = getResolvedType(note);
                        const rawDate = note.dataRegistro || note.criadoEm;

                        return (
                            <View key={note.id} style={style.noteCard}>
                                
                                {/* DADOS DA NOTA (Esquerda) */}
                                <View style={style.noteInfo}>
                                    <Text style={style.noteTypeTitle}>{resolvedType.toUpperCase()}</Text>
                                    <Text style={style.noteDate}>{formatDateBr(rawDate)}</Text>
                                    
                                    {note.origem === 'voz' && (
                                        <View style={style.voiceBadgeContainer}>
                                            <FontAwesome name="microphone" size={12} color="#198754" />
                                            <Text style={style.voiceBadgeText}>Gravado por voz</Text>
                                        </View>
                                    )}

                                    {/* EXIBIÇÃO: SE FOR ANOTAÇÃO DE VOZ */}
                                    {note.text ? (
                                        <View style={style.voiceDataBox}>
                                            <Text style={style.voiceDataText}>{note.text}</Text>
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
                                                    <Text key={key} style={style.dataSummary}>
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

            {/* Modal de Confirmação Customizado */}
            <CustomDeleteModal
                visible={modalVisible}
                title="Excluir Anotação"
                subtitle={`Tem certeza que deseja apagar permanentemente esta anotação de ${noteToDelete?.tipo || ''}?`}
                onClose={() => setModalVisible(false)}
                onDelete={handleDeleteExecute}
            />
        </SafeAreaView>
    );
}

// ==========================================
// ESTILOS DIRETOS NO FICHEIRO
// ==========================================
const style = StyleSheet.create({
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
    }
});

// ---------------------------------------------------------------------------
// ESTILOS DO MODAL CUSTOMIZADO
// ---------------------------------------------------------------------------
const modalStyles = StyleSheet.create({
    overlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: 24 
    },
    modalCard: { 
        width: '100%', 
        backgroundColor: '#FFFFFF', 
        borderRadius: 28, 
        borderWidth: 2, 
        borderColor: 'transparent', 
        padding: 24, 
        alignItems: 'center', 
        elevation: 8, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 6 
    },
    iconCircle: { 
        width: 70, 
        height: 70, 
        borderRadius: 35, 
        backgroundColor: '#d9534f', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 16 
    },
    title: { 
        fontSize: 22, 
        fontWeight: '900', 
        color: '#1A1A1A', 
        textAlign: 'center', 
        marginBottom: 8 
    },
    subtitle: { 
        fontSize: 16, 
        fontWeight: '500', 
        color: '#555', 
        textAlign: 'center', 
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: { 
        flex: 1, 
        backgroundColor: '#F0F0F0', 
        borderRadius: 16, 
        paddingVertical: 14, 
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    cancelText: { 
        color: '#555', 
        fontSize: 16, 
        fontWeight: 'bold' 
    },
    deleteButtonModal: { 
        flex: 1, 
        backgroundColor: '#d9534f', 
        borderRadius: 16, 
        paddingVertical: 14, 
        alignItems: 'center' 
    },
    deleteTextModal: { 
        color: '#FFFFFF', 
        fontSize: 16, 
        fontWeight: 'bold' 
    },
});