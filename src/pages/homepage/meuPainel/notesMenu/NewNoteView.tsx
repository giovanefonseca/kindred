import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    StyleSheet, 
    ScrollView, 
    ActivityIndicator, 
    Modal,
    KeyboardAvoidingView,
    Platform,
    BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native'; // <-- Importado para o botão de voltar
import { themes } from '../../../../global/themes';
import { NoteTypeKey, SUBFORM_STRATEGY_REGISTRY, createInitialSubformData, validateSubformData } from './noteSubforms';

// Importações do Firebase
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../../../../config/firebaseConfig';

interface NewNoteViewProps { onSaveSuccess?: () => void; }
interface NoteTypeConfig { key: NoteTypeKey; label: string; icon: keyof typeof Feather.glyphMap; }

const NOTE_TYPES_CONFIG: NoteTypeConfig[] = [
    { key: 'Glicemia', label: 'Glicemia', icon: 'droplet' },
    { key: 'Pressão', label: 'Pressão', icon: 'heart' },
    { key: 'Oxigenação do sangue', label: 'Oxigenação do Sangue', icon: 'wind' },
    { key: 'Medicação', label: 'Medicação', icon: 'plus-square' },
    { key: 'Temperatura corporal', label: 'Temperatura Corporal', icon: 'thermometer' },
];

// ---------------------------------------------------------------------------
// COMPONENTE DO MODAL CUSTOMIZADO (ALERTA / SUCESSO)
// ---------------------------------------------------------------------------
interface CustomModalProps {
    visible: boolean;
    type: 'success' | 'warning' | 'error';
    title: string;
    subtitle: string;
    onClose: () => void;
}

function CustomModal({ visible, type, title, subtitle, onClose }: CustomModalProps) {
    const isSuccess = type === 'success';
    const isWarning = type === 'warning';
    
    const iconName = isSuccess ? 'check' : isWarning ? 'alert-triangle' : 'x-circle';
    const primaryColor = isSuccess 
        ? (themes.colors.secureGreen || '#198754') 
        : isWarning 
        ? (themes.colors.orange || '#f0ad4e') 
        : '#D9534F';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: primaryColor }]}>
                        <Feather name={iconName} size={40} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={modalStyles.subtitle}>{subtitle}</Text>

                    <TouchableOpacity 
                        style={[modalStyles.closeButton, { backgroundColor: primaryColor }]} 
                        onPress={onClose} 
                        activeOpacity={0.8}
                    >
                        <Text style={modalStyles.closeText}>ENTENDIDO</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL (NEWNOTEVIEW)
// ---------------------------------------------------------------------------
export function NewNoteView({ onSaveSuccess }: NewNoteViewProps) {
    const navigation = useNavigation<any>(); // Hook para navegação
    const [selectedType, setSelectedType] = useState<NoteTypeKey | ''>('');
    const [subformData, setSubformData] = useState<any>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const [modalState, setModalState] = useState<{
        visible: boolean;
        type: 'success' | 'warning' | 'error';
        title: string;
        subtitle: string;
    }>({
        visible: false,
        type: 'success',
        title: '',
        subtitle: ''
    });

    useEffect(() => {
        const onBackPress = () => {
            if (selectedType) {
                setSelectedType('');
                return true; 
            }
            return false; 
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
    }, [selectedType]);

    const handleSelectType = (type: NoteTypeKey) => {
        setSelectedType(type);
        const initialData = createInitialSubformData(type) || {};
        if (type === 'Glicemia' && (initialData.emJejum === undefined || initialData.emJejum === null)) {
            initialData.emJejum = true;
        }
        setSubformData(initialData);
        setErrors({});
    };

    const handleSubformChange = (newData: any) => {
        setSubformData((prev: any) => ({
            ...prev,
            ...newData,
            emJejum: newData.emJejum !== undefined ? newData.emJejum : (prev?.emJejum ?? true)
        }));
    };

    const handleSave = async () => {
        if (!selectedType) return;
        
        const dataToValidate = {
            ...subformData,
            emJejum: subformData?.emJejum ?? true
        };

        const { isValid, errors: validationErrors } = validateSubformData(selectedType, dataToValidate);
        if (!isValid) {
            setErrors(validationErrors);
            setModalState({
                visible: true,
                type: 'warning',
                title: 'Atenção',
                subtitle: 'Por favor, preencha todos os campos obrigatórios em destaque.'
            });
            return;
        }

        const userId = auth.currentUser?.uid;

        if (!userId) {
            setModalState({
                visible: true,
                type: 'error',
                title: 'Erro',
                subtitle: 'Usuário não autenticado. Por favor, faça login novamente.'
            });
            return;
        }

        setIsSaving(true);

        try {
            const novaAnotacao = {
                tipoMedicao: selectedType,
                dados: dataToValidate,
                dataRegistro: new Date().toISOString(),
            };

            const notasRef = collection(db, 'users', userId, 'notes');
            await addDoc(notasRef, novaAnotacao);

            setModalState({
                visible: true,
                type: 'success',
                title: 'SUCESSO!',
                subtitle: 'Anotação salva com sucesso!'
            });

        } catch (error) {
            console.error("Erro ao salvar anotação: ", error);
            setModalState({
                visible: true,
                type: 'error',
                title: 'Erro',
                subtitle: 'Não foi possível conectar ao servidor. Tente novamente.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        const wasSuccess = modalState.type === 'success';
        setModalState(prev => ({ ...prev, visible: false }));
        
        if (wasSuccess) {
            setSelectedType('');
            if (onSaveSuccess) {
                onSaveSuccess();
            } else {
                navigation.goBack();
            }
        }
    };

    const SubformComponent = selectedType ? SUBFORM_STRATEGY_REGISTRY[selectedType] : null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
            {/* CABEÇALHO PADRÃO COM BOTÃO VOLTAR */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.headerBackButton} 
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>REGISTROS DE SAÚDE</Text>
                <View style={{ width: 28 }} />
            </View>

            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView 
                    contentContainerStyle={styles.container} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >

                    {!selectedType ? (
                        <View style={styles.fieldSection}>
                            <Text style={styles.fieldLabel}>SELECIONE O TIPO DE MEDIÇÃO</Text>
                            <View style={styles.buttonsGrid}>
                                {NOTE_TYPES_CONFIG.map((item) => (
                                    <TouchableOpacity
                                        key={item.key}
                                        style={styles.typeCardButton}
                                        onPress={() => handleSelectType(item.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={item.label}
                                    >
                                        <View style={styles.iconWrapper}>
                                            <Feather name={item.icon} size={26} color={themes.colors.notBlack} />
                                        </View> 
                                        <Text style={styles.typeCardText}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.formSection}>
                            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedType('')}>
                                <Feather name="arrow-left" size={24} color={themes.colors.orange} />
                                <Text style={styles.backButtonText}>Trocar Medição</Text>
                            </TouchableOpacity>

                            <View style={styles.dynamicFormArea}>
                                {SubformComponent && subformData && (
                                    <SubformComponent data={subformData} onChange={handleSubformChange} errors={errors} />
                                )}
                            </View>

                            <TouchableOpacity 
                                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
                                onPress={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={styles.saveButtonText}>SALVAR ANOTAÇÃO</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    <CustomModal
                        visible={modalState.visible}
                        type={modalState.type}
                        title={modalState.title}
                        subtitle={modalState.subtitle}
                        onClose={handleCloseModal}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // Estilos do novo Cabeçalho
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',

    },
    headerBackButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
    },
    
    // Container do conteúdo com paddings para desgrudar das bordas
    container: {
        width: '100%',
        flexGrow: 1,
        paddingHorizontal: 20, // <- Isso evita que o banner e botões toquem as bordas
        paddingTop: 16,
        paddingBottom: 40,
    },
    topBanner: {
        width: '100%',
        backgroundColor: themes.colors.orange,
        borderRadius: 24, // <- Arredondamento mais suave, estilo "pílula gorda"
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    fieldSection: {
        marginBottom: 18,
    },
    fieldLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themes.colors.notBlack,
        marginBottom: 12,
        letterSpacing: 0.3,
    },
    buttonsGrid: {
        flexDirection: 'column',
        gap: 12,
    },
    typeCardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themes.colors.secondary,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 16,
        minHeight: 64,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    iconWrapper: {
        marginRight: 18,
        width: 50,
        height: 50,
        borderRadius: 50,
        backgroundColor: themes.colors.orange,
        alignItems: 'center',
        justifyContent: 'center',
    },
    formSection: {
        flex: 1,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingRight: 16,
        marginBottom: 20,
    },
    backButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: themes.colors.orange,
        marginLeft: 8,
    },
    typeCardText: {
        fontSize: 20,
        fontWeight: '600',
        color: themes.colors.notBlack,
        flex: 1,
    },
    dynamicFormArea: {
        width: '100%',
        minHeight: 120,
        marginBottom: 16,
    },
    saveButton: {
        width: '100%',
        backgroundColor: themes.colors.primary,
        borderRadius: 50,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 24,
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
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 16 
    },
    title: { 
        fontSize: 22, 
        fontWeight: '900', 
        color: themes.colors.notBlack || '#1A1A1A', 
        textAlign: 'center', 
        marginBottom: 8 
    },
    subtitle: { 
        fontSize: 18, 
        fontWeight: 'normal', 
        color: themes.colors.notBlack || '#555555', 
        textAlign: 'center', 
        marginBottom: 24,
        lineHeight: 24,
    },
    closeButton: { 
        width: '100%', 
        borderRadius: 16, 
        paddingVertical: 14, 
        alignItems: 'center' 
    },
    closeText: { 
        color: '#FFFFFF', 
        fontSize: 18, 
        fontWeight: 'bold' 
    },
});