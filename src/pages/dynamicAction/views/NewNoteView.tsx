import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { themes } from '../../../global/themes';
import { NoteTypeKey, SUBFORM_STRATEGY_REGISTRY, createInitialSubformData, validateSubformData } from './noteSubforms';

// Importações do Firebase
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../../../config/firebaseConfig';

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
// COMPONENTE DO MODAL CUSTOMIZADO
// ---------------------------------------------------------------------------
interface CustomModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    onClose: () => void;
}

function CustomModal({ visible, title, subtitle, onClose }: CustomModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.modalCard}>
                    <View style={modalStyles.iconCircle}>
                        <Feather name="check" size={40} color="#FFFFFF" />
                    </View>

                    <Text style={modalStyles.title}>{title}</Text>
                    <Text style={modalStyles.subtitle}>{subtitle}</Text>

                    <TouchableOpacity style={modalStyles.closeButton} onPress={onClose} activeOpacity={0.8}>
                        <Text style={modalStyles.closeText}>OK</Text>
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
    const [selectedType, setSelectedType] = useState<NoteTypeKey | ''>('');
    const [subformData, setSubformData] = useState<any>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Estado do Modal Customizado
    const [modalVisible, setModalVisible] = useState(false);

    const handleSelectType = (type: NoteTypeKey) => {
        setSelectedType(type);
        setSubformData(createInitialSubformData(type));
        setErrors({});
    };

    const handleSave = async () => {
        if (!selectedType) return;
        
        // 1. Validação local dos dados
        const { isValid, errors: validationErrors } = validateSubformData(selectedType, subformData);
        if (!isValid) {
            setErrors(validationErrors);
            return Alert.alert('Atenção', 'Preencha todos os campos obrigatórios em destaque.');
        }

        const userId = auth.currentUser?.uid;

        if (!userId) {
            return Alert.alert('Erro', 'Usuário não autenticado. Faça login novamente.');
        }

        setIsSaving(true);

        try {
            const novaAnotacao = {
                tipoMedicao: selectedType,
                dados: subformData,
                dataRegistro: new Date().toISOString(),
            };

            const notasRef = collection(db, 'users', userId, 'notes');
            await addDoc(notasRef, novaAnotacao);

            // Abre o modal customizado sem textos técnicos
            setModalVisible(true);

        } catch (error) {
            console.error("Erro ao salvar anotação: ", error);
            Alert.alert('Erro', 'Não foi possível conectar ao servidor. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        setModalVisible(false);
        setSelectedType('');
        if (onSaveSuccess) onSaveSuccess();
    };

    const SubformComponent = selectedType ? SUBFORM_STRATEGY_REGISTRY[selectedType] : null;

    return (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.topBanner}>
                <Text style={styles.bannerTitle}>
                    {selectedType ? `NOVA ANOTAÇÃO: ${selectedType.toUpperCase()}` : 'NOVA ANOTAÇÃO DE SAÚDE'}
                </Text>
            </View>

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
                            <SubformComponent data={subformData} onChange={setSubformData} errors={errors} />
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

            {/* Modal Customizado de Confirmação */}
            <CustomModal
                visible={modalVisible}
                title="SUCESSO!"
                subtitle="Anotação salva com sucesso!"
                onClose={handleCloseModal}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingBottom: 30,
    },
    topBanner: {
        width: '100%',
        backgroundColor: themes.colors.orange,
        borderRadius: 50,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
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
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: themes.colors.orange,
        borderRadius: 50,
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
        fontSize: 18,
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

// ---------------------------------------------------------------------------
// ESTILOS EXCLUSIVOS DO MODAL CUSTOMIZADO
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
        backgroundColor: themes.colors.secureGreen, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 16 
    },
    title: { 
        fontSize: 22, 
        fontWeight: '900', 
        color: themes.colors.notBlack, 
        textAlign: 'center', 
        marginBottom: 8 
    },
    subtitle: { 
        fontSize: 18, 
        fontWeight: 'regular', 
        color: themes.colors.notBlack, 
        textAlign: 'center', 
        marginBottom: 24 
    },
    closeButton: { 
        width: '100%', 
        backgroundColor: themes.colors.secureGreen, 
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