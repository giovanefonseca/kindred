import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { themes } from '../../../../global/themes';

// Firebase
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';

// Tipagem da anotação
interface Note {
    id: string;
    tipoMedicao: string;
    dados: Record<string, any>;
    dataRegistro: string;
}

export function ViewNotes() {
    const navigation = useNavigation();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros selecionados
    const [filterType, setFilterType] = useState<string>('Todas');
    const [filterDays, setFilterDays] = useState<number>(7);

    const availableTypes = ['Todas', 'Glicemia', 'Pressão', 'Oxigenação do sangue', 'Medicação', 'Temperatura corporal'];
    
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

    const filteredNotes = notes.filter((note) => {
        if (filterType !== 'Todas' && note.tipoMedicao !== filterType) {
            return false;
        }

        if (filterDays > 0) {
            const noteDate = new Date(note.dataRegistro);
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - filterDays);
            
            if (noteDate < limitDate) {
                return false;
            }
        }
        return true;
    });

    const formatDateBr = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        }).replace(' de ', ' '); 
    };

    const getIconForType = (type: string) => {
        switch(type) {
            case 'Glicemia': return <MaterialCommunityIcons name="water" size={28} color={themes.colors.orange} />;
            case 'Pressão': return <MaterialCommunityIcons name="heart-pulse" size={28} color={themes.colors.orange} />;
            case 'Medicação': return <MaterialCommunityIcons name="pill" size={28} color={themes.colors.orange} />;
            case 'Temperatura corporal': return <MaterialCommunityIcons name="thermometer" size={28} color={themes.colors.orange} />;
            case 'Oxigenação do sangue': return <MaterialCommunityIcons name="lungs" size={28} color={themes.colors.orange} />;
            default: return <MaterialCommunityIcons name="note-text" size={28} color={themes.colors.orange} />;
        }
    };

    return (
        <SafeAreaView style={style.container} edges={['top', 'left', 'right']}>
            {/* CABEÇALHO */}
            <View style={style.header}>
                <TouchableOpacity style={style.backButton} onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={style.title}>Histórico de Saúde</Text>
                <View style={style.headerShadow} />
            </View>

            {/* ÁREA DE FILTROS */}
            <View style={style.filtersContainer}>
                <Text style={style.filterSectionTitle}>Filtrar por tipo:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style.filtersScroll}>
                    {availableTypes.map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[style.filterPill, filterType === type && style.filterPillActive]}
                            onPress={() => setFilterType(type)}
                            activeOpacity={0.8}
                        >
                            <Text style={[style.filterPillText, filterType === type && style.filterPillTextActive]}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={style.filterSectionTitle}>Filtrar por período:</Text>
                <View style={style.dateFilterRow}>
                    <TouchableOpacity 
                        style={[style.dateBtn, filterDays === 7 && style.dateBtnActive]} 
                        onPress={() => setFilterDays(7)}
                    >
                        <Text style={[style.dateBtnText, filterDays === 7 && style.dateBtnTextActive]}>Últimos 7 dias</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[style.dateBtn, filterDays === 30 && style.dateBtnActive]} 
                        onPress={() => setFilterDays(30)}
                    >
                        <Text style={[style.dateBtnText, filterDays === 30 && style.dateBtnTextActive]}>Últimos 30 dias</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[style.dateBtn, filterDays === 0 && style.dateBtnActive]} 
                        onPress={() => setFilterDays(0)}
                    >
                        <Text style={[style.dateBtnText, filterDays === 0 && style.dateBtnTextActive]}>Tudo</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* LISTA DE ANOTAÇÕES */}
            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="large" color={themes.colors.orange} style={{ marginTop: 50 }} />
                ) : filteredNotes.length === 0 ? (
                    <View style={style.emptyState}>
                        <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color="#CCC" />
                        <Text style={style.emptyStateText}>Nenhum registo encontrado para este filtro.</Text>
                    </View>
                ) : (
                    filteredNotes.map((note) => (
                        <View key={note.id} style={style.noteCard}>
                            <View style={style.noteHeader}>
                                <View style={style.noteTypeArea}>
                                    {getIconForType(note.tipoMedicao)}
                                    <Text style={style.noteTypeTitle}>{note.tipoMedicao}</Text>
                                </View>
                                <Text style={style.noteDate}>{formatDateBr(note.dataRegistro)}</Text>
                            </View>
                            
                            <View style={style.divider} />

                            <View style={style.noteDataArea}>
                                {Object.entries(note.dados).map(([key, value]) => {
                                    // Dicionário para traduzir as chaves técnicas do banco de dados
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

                                    // Formata o valor dependendo do tipo de dado
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
                                        <View key={key} style={style.dataRow}>
                                            <Text style={style.dataLabel}>{labelFormatado}</Text>
                                            <Text style={style.dataValue}>{renderValue()}</Text>
                                        </View>
                                    );
                                })}
                            </View>
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
const { width } = Dimensions.get('window');

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
        // iOS shadow (direcionada, já funciona bem)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    headerShadow: {
        position: 'absolute',
        bottom: -6,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: 'transparent',
        // "sombra falsa" via borda com opacidade decrescente não dá em RN puro,
        // então o mais simples é usar um LinearGradient aqui (ver abaixo)
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
        color: themes.colors.notBlack,
        textTransform: 'uppercase',
        textAlign: 'center',
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
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
        paddingHorizontal: 20,
        marginTop: 15,
        marginBottom: 10,
    },
    filtersScroll: {
        paddingHorizontal: 15,
        paddingBottom: 5,
    },
    filterPill: {
        backgroundColor: '#F0F0F0',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginHorizontal: 5,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    filterPillActive: {
        backgroundColor: themes.colors.orange,
        borderColor: 'transparent',
    },
    filterPillText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#555',
    },
    filterPillTextActive: {
        color: '#FFFFFF',
    },
    dateFilterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        gap: 10,
    },
    dateBtn: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    dateBtnActive: {
        backgroundColor: themes.colors.notBlack || '#333',
    },
    dateBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#555',
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
        marginBottom: 12,
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
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginBottom: 16,
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
    },
    dataValue: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.orange,
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