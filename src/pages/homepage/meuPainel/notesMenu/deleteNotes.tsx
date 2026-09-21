import React, { useState, useEffect } from 'react';
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Firebase
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

interface Note {
    id: string;
    tipoMedicao: string;
    dados: Record<string, any>;
    dataRegistro: string;
}

export function DeleteNotes() {
    const navigation = useNavigation();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Busca as anotações em tempo real
    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const q = query(
            collection(db, 'users', userId, 'notes'),
            orderBy('dataRegistro', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Note[];
            
            setNotes(fetchedNotes);
            setLoading(false);
        }, (error) => {
            console.error('Erro ao buscar notas:', error);
            Alert.alert('Erro', 'Não foi possível carregar as anotações.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Função de Exclusão com Confirmação de Segurança
    const handleDelete = (noteId: string, tipoMedicao: string) => {
        Alert.alert(
            "Excluir Anotação",
            `Tem certeza que deseja apagar permanentemente esta anotação de ${tipoMedicao}?`,
            [
                { 
                    text: "Cancelar", 
                    style: "cancel" 
                },
                { 
                    text: "Sim, Excluir", 
                    style: "destructive", // Fica vermelho no iOS
                    onPress: async () => {
                        const userId = auth.currentUser?.uid;
                        if (!userId) return;

                        try {
                            const noteRef = doc(db, 'users', userId, 'notes', noteId);
                            await deleteDoc(noteRef);
                            // Não é necessário atualizar o estado (setNotes) manualmente 
                            // porque o onSnapshot fará o cartão sumir automaticamente da tela!
                        } catch (error) {
                            console.error("Erro ao excluir:", error);
                            Alert.alert('Erro', 'Não foi possível excluir a anotação.');
                        }
                    } 
                }
            ]
        );
    };

    const formatDateBr = (isoString: string) => {
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
                <TouchableOpacity 
                    style={style.backButton} 
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Voltar"
                >
                    <Feather name="arrow-left" size={32} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={style.title}>Excluir Registros</Text>
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
                    notes.map((note) => (
                        <View key={note.id} style={style.noteCard}>
                            
                            {/* DADOS DA NOTA (Esquerda) */}
                            <View style={style.noteInfo}>
                                <Text style={style.noteTypeTitle}>{note.tipoMedicao.toUpperCase()}</Text>
                                <Text style={style.noteDate}>{formatDateBr(note.dataRegistro)}</Text>
                                
                                <View style={style.noteDataArea}>
                                    {Object.entries(note.dados).map(([key, value]) => (
                                        <Text key={key} style={style.dataSummary}>
                                            • {key}: <Text style={{fontWeight: 'bold'}}>{typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}</Text>
                                        </Text>
                                    ))}
                                </View>
                            </View>

                            {/* BOTÃO DE EXCLUIR (Direita) */}
                            <TouchableOpacity 
                                style={style.deleteButton}
                                activeOpacity={0.7}
                                onPress={() => handleDelete(note.id, note.tipoMedicao)}
                                accessibilityLabel={`Excluir anotação de ${note.tipoMedicao}`}
                                accessibilityRole="button"
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FFFFFF" />
                            </TouchableOpacity>
                            
                        </View>
                    ))
                )}
            </ScrollView>
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
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        marginRight: 15,
        padding: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#d9534f', // Título vermelho para indicar área de perigo
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
        borderColor: '#ffebee', // Borda avermelhada suave
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
        marginBottom: 4,
    },
    noteDate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#777',
        marginBottom: 8,
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
        borderRadius: 16, // Botão grande e quadrado arredondado
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