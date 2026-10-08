import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    StyleSheet, 
    ScrollView, 
    ActivityIndicator, 
    KeyboardAvoidingView,
    Platform,
    BackHandler,
    Animated,
    Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { themes } from '../../../../global/themes';
import { NoteTypeKey, SUBFORM_STRATEGY_REGISTRY, createInitialSubformData, validateSubformData } from './noteSubforms';

// Importações do Firebase
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../../config/firebaseConfig';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Modal Global de Notificação
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Serviço único de entrada para dailyLogs
import { DailyLogService } from '../../../../services/DailyLogService';

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

function AnimatedTypeCard({
    children,
    style,
    onPress,
    accessibilityLabel,
}: {
    children: React.ReactNode;
    style?: any;
    onPress: () => void;
    accessibilityLabel: string;
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            style={{ width: '100%' }}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
}

export function NewNoteView({ onSaveSuccess }: NewNoteViewProps) {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<NewNoteRouteParams, 'NewNoteView'>>();

    const { fontScale, isHighContrast, theme } = useAccessibility();

    // RESOLUÇÃO DE USUÁRIO E DEPENDENTE
    const currentUserUid = auth.currentUser?.uid || '';
    const selectedUserId = route.params?.targetUserId || currentUserUid;

    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

    const [selectedType, setSelectedType] = useState<NoteTypeKey | ''>('');
    const [subformData, setSubformData] = useState<any>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const isSavingRef = useRef(false); // guarda síncrona contra duplo toque

    const formFadeAnim = useRef(new Animated.Value(0)).current;
    const formSlideAnim = useRef(new Animated.Value(20)).current;

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
        if (selectedType) {
            formFadeAnim.setValue(0);
            formSlideAnim.setValue(20);

            Animated.parallel([
                Animated.timing(formFadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(formSlideAnim, {
                    toValue: 0,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [selectedType]);

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
                    console.error('Erro ao verificar permissões no NewNoteView:', error);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedType(type);
        const initialData = createInitialSubformData(type) || {};
        // "Em jejum" só faz sentido para Glicemia
        if (type === 'Glicemia' && (initialData.emJejum === undefined || initialData.emJejum === null)) {
            initialData.emJejum = true;
        }
        setSubformData(initialData);
        setErrors({});
    };

    const handleSubformChange = (newData: any) => {
        setSubformData((prev: any) => ({ ...prev, ...newData }));
    };

    const formatNoteDescription = (type: NoteTypeKey, data: any): string => {
        switch (type) {
            case 'Glicemia':
                return `${data.valor || '--'} mg/dL (${data.emJejum ? 'Em jejum' : 'Pós-refeição'})`;
            case 'Pressão':
                return `${data.sistolica || '--'}x${data.diastolica || '--'} mmHg${data.bpm ? ` (Pulso: ${data.bpm} bpm)` : ''}`;
            case 'Oxigenação do sangue':
                return `${data.valor || '--'}% SpO2`;
            case 'Medicação': {
                const nome = data.nomeMedicamento || 'Medicamento';
                return data.dosagem ? `${nome} - ${data.dosagem}` : nome;
            }
            case 'Temperatura corporal':
                return `${data.valor || '--'} °C`;
            default:
                return 'Registro de saúde salvo.';
        }
    };

    const handleSave = async () => {
        if (!selectedType || isSavingRef.current) return;

        const dataToValidate = { ...subformData };

        const { isValid, errors: validationErrors } = validateSubformData(selectedType, dataToValidate);
        if (!isValid) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

        isSavingRef.current = true;
        setIsSaving(true);

        try {
            // Caminho ÚNICO: users/{selectedUserId}/notes  e  users/{selectedUserId}/dailyLogs
            // (mesmo caminho que o DependentDetail e o DailyLogService usam)
            const noteRef = doc(collection(db, 'users', selectedUserId, 'notes'));
            const batch = writeBatch(db);

            // 1. Histórico detalhado em 'notes'
            batch.set(noteRef, {
                tipoMedicao: selectedType,
                dados: dataToValidate,
                dataRegistro: new Date().toISOString(),
                timestamp: serverTimestamp(),
                criadoPor: currentUserUid || selectedUserId,
            });

            // 2. Atividade em 'dailyLogs' (aparece em tempo real no painel), ligada à nota por refId
            DailyLogService.addLogToBatch(batch, {
                dependentUid: selectedUserId,
                tipo: 'recado',
                titulo: `Saúde: ${selectedType}`,
                descricao: formatNoteDescription(selectedType, dataToValidate),
                status: 'concluido',
                refId: noteRef.id,
            });

            // Atômico: ou grava os dois, ou nenhum
            await batch.commit();

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setModalState({
                visible: true,
                type: 'success',
                title: 'SUCESSO!',
                subtitle: 'Anotação salva com sucesso no histórico!'
            });

        } catch (error: any) {
            console.error("Erro ao salvar anotação: ", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            const isPermission = error?.code === 'permission-denied';
            setModalState({
                visible: true,
                type: 'error',
                title: 'Erro',
                subtitle: isPermission
                    ? 'Você não tem permissão para registrar anotações para este perfil.'
                    : 'Não foi possível conectar ao servidor. Tente novamente.'
            });
        } finally {
            isSavingRef.current = false;
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

    const getModalConfig = () => {
        switch (modalState.type) {
            case 'success':
                return {
                    iconName: 'check-circle' as const,
                    iconColor: isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754'),
                    closeButtonColor: isHighContrast ? theme.buttonPrimary : (themes.colors.secureGreen || '#198754'),
                    pulseIcon: true
                };
            case 'warning':
                return {
                    iconName: 'alert-circle-outline' as const,
                    iconColor: isHighContrast ? theme.buttonPrimary : (themes.colors.orange || '#f0ad4e'),
                    closeButtonColor: isHighContrast ? theme.buttonPrimary : (themes.colors.orange || '#f0ad4e'),
                    pulseIcon: false
                };
            case 'error':
            default:
                return {
                    iconName: 'close-circle-outline' as const,
                    iconColor: isHighContrast ? theme.buttonPrimary : '#D9534F',
                    closeButtonColor: isHighContrast ? theme.buttonPrimary : '#D9534F',
                    pulseIcon: false
                };
        }
    };

    const modalConfig = getModalConfig();

    return (
        <SafeAreaView 
            style={[
                styles.screenContainer,
                isHighContrast && { backgroundColor: theme.background }
            ]} 
            edges={['top', 'left', 'right']}
        >
            {/* CABEÇALHO */}
            <View style={[
                styles.header,
                isHighContrast && { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }
            ]}>
                <TouchableOpacity 
                    style={styles.headerBackButton} 
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
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
                    {/* INDICADOR VISUAL DO PERFIL SELECIONADO */}
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
                                    <AnimatedTypeCard
                                        key={item.key}
                                        style={[
                                            styles.typeCardButton,
                                            isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                        ]}
                                        onPress={() => handleSelectType(item.key)}
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
                                    </AnimatedTypeCard>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <Animated.View 
                            style={[
                                styles.formSection,
                                {
                                    opacity: formFadeAnim,
                                    transform: [{ translateY: formSlideAnim }],
                                },
                            ]}
                        >
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
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel="Salvar Anotação"
                                accessibilityState={{ disabled: isSaving, busy: isSaving }}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color={isHighContrast ? theme.buttonText : "#FFFFFF"} size="small" />
                                ) : (
                                    <Text style={[
                                        styles.saveButtonText,
                                        { fontSize: 24 * fontScale },
                                        isHighContrast && { color: theme.buttonText }
                                    ]}>
                                        SALVAR ANOTAÇÃO
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* MODAL DE NOTIFICAÇÃO */}
                    <CustomNotificationModal
                        visible={modalState.visible}
                        title={modalState.title}
                        subtitle={modalState.subtitle}
                        iconName={modalConfig.iconName}
                        iconColor={modalConfig.iconColor}
                        pulseIcon={modalConfig.pulseIcon}
                        closeText="ENTENDIDO"
                        closeButtonColor={modalConfig.closeButtonColor}
                        onClose={handleCloseModal}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// EXPORT DEFAULT PARA EVITAR O RENDER ERROR DO REACT NAVIGATION
export default NewNoteView;

const styles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
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
        minHeight: 64,
        backgroundColor: themes.colors.primary,
        borderRadius: 50,
        paddingVertical: 16,
        paddingHorizontal: 20,
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