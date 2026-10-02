import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    StyleSheet, 
    ScrollView, 
    ActivityIndicator, 
    KeyboardAvoidingView,
    Platform,
    BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { themes } from '../../../../global/themes';
import { NoteTypeKey, SUBFORM_STRATEGY_REGISTRY, createInitialSubformData, validateSubformData } from './noteSubforms';

// Importações do Firebase
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../../config/firebaseConfig';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Modal Global de Notificação
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

interface NewNoteViewProps { 
    onSaveSuccess?: () => void; 
}

type NewNoteRouteParams = {
    NewNoteView: {
        targetUserId?: string;
    };
};

interface NoteTypeConfig { 
    key: NoteTypeKey; 
    label: string; 
    icon: keyof typeof Feather.glyphMap; 
}

const NOTE_TYPES_CONFIG: NoteTypeConfig[] = [
    { key: 'Glicemia', label: 'Glicemia', icon: 'droplet' },
    { key: 'Pressão', label: 'Pressão', icon: 'heart' },
    { key: 'Oxigenação do sangue', label: 'Oxigenação do Sangue', icon: 'wind' },
    { key: 'Medicação', label: 'Medicação', icon: 'plus-square' },
    { key: 'Temperatura corporal', label: 'Temperatura Corporal', icon: 'thermometer' },
];

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL (NEWNOTEVIEW)
// ---------------------------------------------------------------------------
export function NewNoteView({ onSaveSuccess }: NewNoteViewProps) {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<NewNoteRouteParams, 'NewNoteView'>>();

    const { fontScale, isHighContrast, theme } = useAccessibility();

    // 1. OBTÉM O USUÁRIO LOGADO E O TARGET USER ID
    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId = route.params?.targetUserId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

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

    // 2. IDENTIFICAÇÃO DO PERFIL SELECIONADO E VERIFICAÇÃO DE DEPENDENTES
    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                if (!currentUserUid) return;

                try {
                    // Verifica se o usuário logado possui dependentes cadastrados
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents = Array.isArray(currentUserData.dependentes) && currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    // Define o nome do perfil em edição
                    if (selectedUserId) {
                        if (selectedUserId === currentUserUid) {
                            if (isMounted) setTargetUserName('Meu Perfil (Responsável)');
                        } else {
                            // Tenta buscar na subcoleção de dependentes
                            const dependentDoc = await getDoc(doc(db, 'users', currentUserUid, 'dependentes', selectedUserId));
                            if (dependentDoc.exists() && isMounted) {
                                const data = dependentDoc.data();
                                setTargetUserName(data.apelido || data.nome || 'Dependente');
                            } else {
                                // Fallback para a coleção raiz de usuários
                                const targetUserDoc = await getDoc(doc(db, 'users', selectedUserId));
                                if (targetUserDoc.exists() && isMounted) {
                                    const data = targetUserDoc.data();
                                    setTargetUserName(data.apelido || data.nome || 'Dependente');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao verificar permissões e perfil no NewNoteView:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [selectedUserId, currentUserUid])
    );

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

        if (!selectedUserId) {
            setModalState({
                visible: true,
                type: 'error',
                title: 'Erro',
                subtitle: 'Usuário não identificado. Por favor, tente novamente.'
            });
            return;
        }

        setIsSaving(true);

        try {
            const novaAnotacao = {
                tipoMedicao: selectedType,
                dados: dataToValidate,
                dataRegistro: new Date().toISOString(),
                criadoPor: currentUserUid || selectedUserId
            };

            // Salva na subcoleção 'notes' do perfil de destino (dependente ou próprio usuário)
            let notasRef;
            if (currentUserUid && selectedUserId !== currentUserUid) {
                notasRef = collection(db, 'users', currentUserUid, 'dependentes', selectedUserId, 'notes');
            } else {
                notasRef = collection(db, 'users', selectedUserId, 'notes');
            }

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

    // Configuração de cores e ícones do modal baseado no estado
    const getModalConfig = () => {
        switch (modalState.type) {
            case 'success':
                return {
                    iconName: 'check-circle-outline' as const,
                    iconColor: isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754'),
                    closeButtonColor: isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754')
                };
            case 'warning':
                return {
                    iconName: 'alert-circle-outline' as const,
                    iconColor: isHighContrast ? theme.buttonPrimary : (themes.colors.orange || '#f0ad4e'),
                    closeButtonColor: isHighContrast ? theme.buttonPrimary : (themes.colors.orange || '#f0ad4e')
                };
            case 'error':
            default:
                return {
                    iconName: 'close-circle-outline' as const,
                    iconColor: isHighContrast ? theme.buttonPrimary : '#D9534F',
                    closeButtonColor: isHighContrast ? theme.buttonPrimary : '#D9534F'
                };
        }
    };

    const modalConfig = getModalConfig();

    return (
        <SafeAreaView 
            style={[{ flex: 1, backgroundColor: '#FFFFFF' }, isHighContrast && { backgroundColor: theme.background }]} 
            edges={['top', 'left', 'right']}
        >
            {/* CABEÇALHO PADRÃO COM BOTÃO VOLTAR */}
            <View style={[
                styles.header,
                isHighContrast && { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }
            ]}>
                <TouchableOpacity 
                    style={styles.headerBackButton} 
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                </TouchableOpacity>
                <Text style={[
                    styles.headerTitle,
                    { fontSize: 20 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>REGISTROS DE SAÚDE</Text>
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
                    {/* INDICADOR VISUAL DO PERFIL SELECIONADO (Exibido apenas se for responsável) */}
                    {isResponsavel && targetUserName ? (
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
                                <Text style={styles.profileBadgeName}>{targetUserName}</Text>
                            </Text>
                        </View>
                    ) : null}

                    {!selectedType ? (
                        <View style={styles.fieldSection}>
                            <Text style={[
                                styles.fieldLabel,
                                { fontSize: 18 * fontScale },
                                isHighContrast && { color: theme.textPrimary }
                            ]}>
                                SELECIONE O TIPO DE MEDIÇÃO
                            </Text>
                            <View style={styles.buttonsGrid}>
                                {NOTE_TYPES_CONFIG.map((item) => (
                                    <TouchableOpacity
                                        key={item.key}
                                        style={[
                                            styles.typeCardButton,
                                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                        ]}
                                        onPress={() => handleSelectType(item.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={item.label}
                                    >
                                        <View style={[
                                            styles.iconWrapper,
                                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                                        ]}>
                                            <Feather name={item.icon} size={26} color={isHighContrast ? theme.buttonText : themes.colors.notBlack} />
                                        </View> 
                                        <Text style={[
                                            styles.typeCardText,
                                            { fontSize: 20 * fontScale },
                                            isHighContrast && { color: theme.textPrimary }
                                        ]}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.formSection}>
                            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedType('')}>
                                <Feather name="arrow-left" size={24} color={isHighContrast ? theme.buttonPrimary : themes.colors.orange} />
                                <Text style={[
                                    styles.backButtonText,
                                    { fontSize: 18 * fontScale },
                                    isHighContrast && { color: theme.buttonPrimary }
                                ]}>Trocar Medição</Text>
                            </TouchableOpacity>

                            <View style={styles.dynamicFormArea}>
                                {SubformComponent && subformData && (
                                    <SubformComponent data={subformData} onChange={handleSubformChange} errors={errors} />
                                )}
                            </View>

                            <TouchableOpacity 
                                style={[
                                    styles.saveButton, 
                                    isHighContrast && { backgroundColor: theme.buttonPrimary },
                                    isSaving && styles.saveButtonDisabled
                                ]} 
                                onPress={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color={isHighContrast ? theme.buttonText : "#FFFFFF"} size="small" />
                                ) : (
                                    <Text style={[
                                        styles.saveButtonText,
                                        { fontSize: 24 * fontScale },
                                        isHighContrast && { color: theme.buttonText }
                                    ]}>SALVAR ANOTAÇÃO</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    <CustomNotificationModal
                        visible={modalState.visible}
                        title={modalState.title}
                        subtitle={modalState.subtitle}
                        iconName={modalConfig.iconName}
                        iconColor={modalConfig.iconColor}
                        closeText="ENTENDIDO"
                        closeButtonColor={modalConfig.closeButtonColor}
                        onClose={handleCloseModal}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
    container: {
        width: '100%',
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
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