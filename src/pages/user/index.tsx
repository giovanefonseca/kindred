import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Modal,
    ActivityIndicator,
    Alert,
    ScrollView,
    Switch,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import * as Haptics from 'expo-haptics';
import { themes } from '../../global/themes';

// Contexto Global de Acessibilidade
import { useAccessibility, FontSizeOption } from '../../contexts/AccessibilityContext';

// Firebase
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig'; 

interface UserData {
    nome: string;
    apelido: string;
    email: string;
    photoUrl: string | null;
}

interface DependentUser {
    uid: string;
    nome: string;
    photoUrl?: string | null;
}

export default function User() {
    const navigation = useNavigation<any>();

    // Consome as configurações globais de Acessibilidade e Tema
    const { 
        fontSizeMode, 
        fontScale, 
        isHighContrast, 
        toggleHighContrast, 
        theme, 
        changeFontSize 
    } = useAccessibility();

    const [userData, setUserData] = useState<UserData>({
        nome: 'Carregando...',
        apelido: 'Carregando...',
        email: 'carregando...',
        photoUrl: null
    });
    const [loading, setLoading] = useState(true);
    const [uploadingImage, setUploadingImage] = useState(false);
    
    // Lista de dependentes vinculados
    const [dependentsList, setDependentsList] = useState<DependentUser[]>([]);

    // Estados dos Modais
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);

    // Estado para o Modal Customizado de Feedback (Sucesso / Erro)
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
    const [feedbackModalData, setFeedbackModalData] = useState<{
        title: string;
        message: string;
        type: 'success' | 'error';
    }>({ title: '', message: '', type: 'success' });

    // Estado para o Modal Customizado de Confirmação (Remover Foto / Desvincular)
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ title: '', message: '', onConfirm: () => {} });

    // Permissões da Câmara
    const [permission, requestPermission] = useCameraPermissions();

    const userId = auth.currentUser?.uid;

    // Função centralizada para feedback visual e háptico
    const showFeedback = (title: string, message: string, type: 'success' | 'error' = 'success') => {
        if (type === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setFeedbackModalData({ title, message, type });
        setFeedbackModalVisible(true);
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setConfirmModalData({ title, message, onConfirm });
        setConfirmModalVisible(true);
    };

    // Função para carregar a lista completa de dependentes vinculados
    const fetchDependents = async (dependentIds: string[]) => {
        if (!dependentIds || dependentIds.length === 0) {
            setDependentsList([]);
            return;
        }

        try {
            const list: DependentUser[] = [];
            for (const depId of dependentIds) {
                const depSnap = await getDoc(doc(db, 'users', depId));
                if (depSnap.exists()) {
                    const data = depSnap.data();
                    list.push({
                        uid: depId,
                        nome: data.apelido || data.nome || 'Dependente',
                        photoUrl: data.photoUrl || null
                    });
                }
            }
            setDependentsList(list);
        } catch (error) {
            console.error("Erro ao carregar lista de dependentes:", error);
        }
    };

    // 1. Busca os dados do utilizador no Firestore
    useEffect(() => {
        const fetchUserData = async () => {
            if (!userId) return;
            try {
                const docRef = doc(db, 'users', userId);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData({
                        nome: data.nome || 'Usuário',
                        apelido: data.apelido || data.nome || '',
                        email: data.email || auth.currentUser?.email || '',
                        photoUrl: data.photoUrl || null
                    });

                    // Busca os detalhes dos dependentes vinculados
                    if (data.dependentes && Array.isArray(data.dependentes)) {
                        await fetchDependents(data.dependentes);
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar usuário:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userId]);

    // Troca o tamanho de fonte no Contexto Global + Haptics
    const handleSelectFontSize = (mode: FontSizeOption) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        changeFontSize(mode);
    };

    // Alternar Alto Contraste com Haptics
    const handleToggleContrast = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        toggleHighContrast();
    };

    // 2. Função para escolher foto e salvar no FIRESTORE (Base64)
    const handlePickImage = async () => {
        if (!userId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
            showFeedback('PERMISSÃO NECESSÁRIA', 'Precisamos de acesso à sua galeria para mudar a foto.', 'error');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.3,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            setUploadingImage(true);

            try {
                const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;

                await updateDoc(doc(db, 'users', userId), { photoUrl: base64Data });

                setUserData(prev => ({ ...prev, photoUrl: base64Data }));
                showFeedback('FOTO ATUALIZADA', 'Sua foto de perfil foi alterada com sucesso!', 'success');
            } catch (error) {
                console.error("Erro ao salvar foto no Firestore:", error);
                showFeedback('ERRO AO SALVAR', 'Não foi possível enviar a imagem. Tente novamente.', 'error');
            } finally {
                setUploadingImage(false);
            }
        }
    };

    // 2.1 Função para REMOVER a foto de perfil usando Modal Customizado
    const handleRemoveImage = () => {
        if (!userId || !userData.photoUrl) return;

        showConfirm(
            'REMOVER FOTO',
            'Tem certeza que deseja remover a sua foto de perfil?',
            async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setConfirmModalVisible(false);
                setUploadingImage(true);
                try {
                    await updateDoc(doc(db, 'users', userId), { photoUrl: null });
                    setUserData(prev => ({ ...prev, photoUrl: null }));
                    showFeedback('FOTO REMOVIDA', 'Sua foto de perfil foi removida com sucesso.', 'success');
                } catch (error) {
                    console.error("Erro ao remover foto:", error);
                    showFeedback('ERRO AO REMOVER', 'Não foi possível remover a foto. Tente novamente.', 'error');
                } finally {
                    setUploadingImage(false);
                }
            }
        );
    };

    // 3. Abrir a câmara para escanear
    const handleOpenScanner = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                showFeedback('PERMISSÃO NEGADA', 'Precisamos de acesso à câmara para ler o QR Code.', 'error');
                return;
            }
        }
        setScanned(false);
        setScannerVisible(true);
    };

    // 4. Lógica executada ao encontrar um QR Code
    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setScanned(true);
        setScannerVisible(false);
        
        if (!userId) return;

        if (data === userId) {
            showFeedback('AÇÃO INVÁLIDA', 'Não pode vincular a sua própria conta.', 'error');
            return;
        }

        try {
            const scannedUserRef = doc(db, 'users', data);
            const scannedUserSnap = await getDoc(scannedUserRef);

            if (!scannedUserSnap.exists()) {
                showFeedback('ERRO', 'Utilizador não encontrado no sistema.', 'error');
                return;
            }

            const scannedUserData = scannedUserSnap.data();
            const nomeDependente = scannedUserData.nome || scannedUserData.apelido || 'este utilizador';

            Alert.alert(
                'Vincular Contas',
                `Deseja assumir a responsabilidade por ${nomeDependente}?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Sim, vincular', onPress: () => linkUsers(data) }
                ]
            );
        } catch (error) {
            console.error("Erro ao processar QR Code:", error);
            showFeedback('ERRO', 'Falha ao processar a leitura do QR Code.', 'error');
        }
    };

    // 5. Salva a relação de dependente no Firestore
    const linkUsers = async (dependentId: string) => {
        if (!userId) return;

        try {
            await updateDoc(doc(db, 'users', userId), {
                dependentes: arrayUnion(dependentId)
            });

            try {
                await updateDoc(doc(db, 'users', dependentId), {
                    responsaveis: arrayUnion(userId)
                });
            } catch (permissionErr) {
                console.log("Vínculo registrado no responsável:", permissionErr);
            }

            // Recarrega a lista atualizada de dependentes
            const userDocSnap = await getDoc(doc(db, 'users', userId));
            if (userDocSnap.exists()) {
                const updatedData = userDocSnap.data();
                if (updatedData.dependentes) {
                    await fetchDependents(updatedData.dependentes);
                }
            }

            showFeedback('SUCESSO!', 'As contas foram vinculadas com sucesso.', 'success');
        } catch (error) {
            console.error("Erro ao vincular:", error);
            showFeedback('ERRO', 'Não foi possível vincular as contas.', 'error');
        }
    };

    // 5.1 Função para REMOVER / DESVINCULAR o dependente
    const handleRemoveDependent = (dependent: DependentUser) => {
        if (!userId) return;

        showConfirm(
            'DESVINCULAR DEPENDENTE',
            `Tem certeza de que deseja remover ${dependent.nome} da sua lista de dependentes?`,
            async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setConfirmModalVisible(false);

                try {
                    // Remove da lista de dependentes do responsável
                    await updateDoc(doc(db, 'users', userId), {
                        dependentes: arrayRemove(dependent.uid)
                    });

                    // Remove da lista de responsáveis do dependente
                    try {
                        await updateDoc(doc(db, 'users', dependent.uid), {
                            responsaveis: arrayRemove(userId)
                        });
                    } catch (err) {
                        console.log("Erro ao remover responsavel no dependente:", err);
                    }

                    // Atualiza a lista local
                    setDependentsList(prev => prev.filter(item => item.uid !== dependent.uid));
                    showFeedback('SUCESSO', `${dependent.nome} foi desvinculado com sucesso.`, 'success');
                } catch (error) {
                    console.error("Erro ao desvincular dependente:", error);
                    showFeedback('ERRO', 'Não foi possível remover o dependente. Tente novamente.', 'error');
                }
            }
        );
    };

    const handleEditField = (field: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showFeedback('EDITAR', `A edição do campo ${field} será implementada em breve.`, 'success');
    };

    // 6. Executa o logout de fato
    const handleConfirmLogout = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setLogoutModalVisible(false);
        try {
            await signOut(auth);
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } catch (error) {
            console.error('Erro ao sair da conta:', error);
            showFeedback('ERRO', 'Não foi possível sair da conta. Tente novamente.', 'error');
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.buttonPrimary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <View style={styles.profilePicWrapper}>
                    <View style={[styles.profilePicContainer, { borderColor: theme.buttonPrimary }]}>
                        <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage} activeOpacity={0.8}>
                            {uploadingImage ? (
                                <View style={[styles.profilePlaceholder, { backgroundColor: theme.cardBackground }]}>
                                    <ActivityIndicator size="large" color={theme.buttonPrimary} />
                                </View>
                            ) : userData.photoUrl ? (
                                <Image source={{ uri: userData.photoUrl }} style={styles.profileImage} />
                            ) : (
                                <View style={[styles.profilePlaceholder, { backgroundColor: theme.cardBackground }]}>
                                    <MaterialCommunityIcons name="camera-plus" size={40} color={theme.buttonPrimary} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Botão de Remover Foto */}
                    {userData.photoUrl && !uploadingImage && (
                        <TouchableOpacity 
                            style={styles.removePhotoButton} 
                            onPress={handleRemoveImage}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={[styles.greetingText, { fontSize: 26 * fontScale, color: theme.textPrimary }]}>
                    Olá, <Text style={styles.greetingName}>{userData.apelido}!</Text>
                </Text>

                {/* PAINEL DE ACESSIBILIDADE */}
                <View style={[styles.accessibilityContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    
                    {/* SELETOR GLOBAL DE TAMANHO DA FONTE */}
                    <View style={styles.accessibilityHeader}>
                        <MaterialCommunityIcons name="format-size" size={22} color={theme.buttonPrimary} />
                        <Text style={[styles.accessibilityTitle, { fontSize: 13 * fontScale, color: theme.textSecondary }]}>
                            TAMANHO DO TEXTO DA TELA
                        </Text>
                    </View>
                    <View style={styles.fontScaleSelector}>
                        <TouchableOpacity
                            style={[
                                styles.fontScaleButton,
                                { borderColor: theme.border },
                                fontSizeMode === 'normal' && { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary }
                            ]}
                            onPress={() => handleSelectFontSize('normal')}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.fontScaleText,
                                { fontSize: 13, color: fontSizeMode === 'normal' ? theme.buttonText : theme.textPrimary }
                            ]}>
                                A (Padrão)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.fontScaleButton,
                                { borderColor: theme.border },
                                fontSizeMode === 'large' && { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary }
                            ]}
                            onPress={() => handleSelectFontSize('large')}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.fontScaleText,
                                { fontSize: 16, fontWeight: 'bold', color: fontSizeMode === 'large' ? theme.buttonText : theme.textPrimary }
                            ]}>
                                A+ (Grande)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.fontScaleButton,
                                { borderColor: theme.border },
                                fontSizeMode === 'xlarge' && { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary }
                            ]}
                            onPress={() => handleSelectFontSize('xlarge')}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.fontScaleText,
                                { fontSize: 19, fontWeight: 'bold', color: fontSizeMode === 'xlarge' ? theme.buttonText : theme.textPrimary }
                            ]}>
                                A++ (Extra)
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* DIVISOR INTERNO */}
                    <View style={[styles.accessibilityDivider, { backgroundColor: theme.border }]} />

                    {/* ALTERNADOR DE ALTO CONTRASTE */}
                    <View style={styles.contrastRow}>
                        <View style={styles.contrastInfo}>
                            <MaterialCommunityIcons name="contrast-box" size={24} color={theme.buttonPrimary} />
                            <Text style={[styles.contrastLabel, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>
                                Modo Alto Contraste
                            </Text>
                        </View>
                        <Switch
                            trackColor={{ false: '#CBD5E1', true: theme.buttonPrimary }}
                            thumbColor={isHighContrast ? theme.buttonText : '#F8FAFC'}
                            onValueChange={handleToggleContrast}
                            value={isHighContrast}
                        />
                    </View>

                </View>

                {/* SEÇÃO DE DEPENDENTES VINCULADOS */}
                {dependentsList.length > 0 && (
                    <View style={styles.dependentsSection}>
                        <Text style={[styles.dependentsSectionTitle, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>
                            DEPENDENTES VINCULADOS
                        </Text>
                        {dependentsList.map((dep) => (
                            <View 
                                key={dep.uid} 
                                style={[
                                    styles.dependentCard, 
                                    { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                ]}
                            >
                                <View style={styles.dependentInfo}>
                                    {dep.photoUrl ? (
                                        <Image source={{ uri: dep.photoUrl }} style={styles.dependentAvatar} />
                                    ) : (
                                        <View style={[styles.dependentAvatarPlaceholder, { backgroundColor: theme.border }]}>
                                            <MaterialCommunityIcons name="account-heart" size={24} color={theme.buttonPrimary} />
                                        </View>
                                    )}
                                    <Text style={[styles.dependentName, { fontSize: 16 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                                        {dep.nome}
                                    </Text>
                                </View>

                                <TouchableOpacity 
                                    style={styles.removeDependentButton}
                                    onPress={() => handleRemoveDependent(dep)}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons name="account-remove-outline" size={18} color="#FFFFFF" />
                                    <Text style={[styles.removeDependentText, { fontSize: 12 * fontScale }]}>DESVINCULAR</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.fieldsContainer}>
                    <View style={styles.fieldWrapper}>
                        <Text style={[styles.fieldLabel, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>APELIDO</Text>
                        <TouchableOpacity style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} onPress={() => handleEditField('Apelido')}>
                            <MaterialCommunityIcons name="card-account-details" size={28} color={theme.buttonPrimary} />
                            <Text style={[styles.inputText, { fontSize: 16 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                                {userData.apelido}
                            </Text>
                            <MaterialCommunityIcons name="pencil" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.fieldWrapper}>
                        <Text style={[styles.fieldLabel, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>SENHA</Text>
                        <TouchableOpacity style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} onPress={() => handleEditField('Senha')}>
                            <MaterialCommunityIcons name="lock" size={28} color={theme.buttonPrimary} />
                            <Text style={[styles.inputText, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>********</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.fieldWrapper}>
                        <Text style={[styles.fieldLabel, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>E-MAIL</Text>
                        <TouchableOpacity style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} onPress={() => handleEditField('E-mail')}>
                            <MaterialCommunityIcons name="email" size={28} color={theme.buttonPrimary} />
                            <Text style={[styles.inputText, { fontSize: 16 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                                {userData.email}
                            </Text>
                            <MaterialCommunityIcons name="pencil" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* BOTÕES DE AÇÃO */}
                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: theme.buttonPrimary, borderColor: theme.border }]} 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setQrModalVisible(true);
                        }}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode" size={36} color={theme.buttonText} />
                        <Text style={[styles.actionButtonText, { fontSize: 16 * fontScale, color: theme.buttonText }]}>Meu Código</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: theme.buttonPrimary, borderColor: theme.border }]} 
                        onPress={handleOpenScanner}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode-scan" size={36} color={theme.buttonText} />
                        <Text style={[styles.actionButtonText, { fontSize: 16 * fontScale, color: theme.buttonText }]}>Ler Código</Text>
                    </TouchableOpacity>
                </View>

                {/* SAIR DA CONTA */}
                <TouchableOpacity
                    style={styles.logoutLink}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLogoutModalVisible(true);
                    }}
                    activeOpacity={0.6}
                >
                    <MaterialCommunityIcons name="logout" size={16} color={theme.textSecondary} />
                    <Text style={[styles.logoutLinkText, { fontSize: 13 * fontScale, color: theme.textSecondary }]}>Sair da conta</Text>
                </TouchableOpacity>

            </ScrollView>

            {/* MODAL CUSTOMIZADO DE CONFIRMAÇÃO DE REMOÇÃO / DESVÍNCULO */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={confirmModalVisible}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.confirmModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <View style={styles.confirmIconCircle}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={38} color="#FFFFFF" />
                        </View>

                        <Text style={[styles.confirmModalTitle, { fontSize: 20 * fontScale, color: theme.textPrimary }]}>
                            {confirmModalData.title}
                        </Text>
                        <Text style={[styles.confirmModalSubtitle, { fontSize: 15 * fontScale, color: theme.textSecondary }]}>
                            {confirmModalData.message}
                        </Text>

                        <View style={styles.confirmButtonRow}>
                            <TouchableOpacity
                                style={[styles.confirmCancelButton, { borderColor: theme.border }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setConfirmModalVisible(false);
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.confirmCancelText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.confirmDeleteButton}
                                onPress={confirmModalData.onConfirm}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.confirmDeleteText, { fontSize: 15 * fontScale }]}>CONFIRMAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL CUSTOMIZADO DE FEEDBACK (SUCESSO / ERRO) */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={feedbackModalVisible}
                onRequestClose={() => setFeedbackModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.feedbackModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <View style={[
                            styles.feedbackIconCircle, 
                            { backgroundColor: feedbackModalData.type === 'success' ? '#22C55E' : '#EF4444' }
                        ]}>
                            <MaterialCommunityIcons 
                                name={feedbackModalData.type === 'success' ? "check-bold" : "alert-circle-outline"} 
                                size={40} 
                                color="#FFFFFF" 
                            />
                        </View>

                        <Text style={[styles.feedbackModalTitle, { fontSize: 20 * fontScale, color: theme.textPrimary }]}>
                            {feedbackModalData.title}
                        </Text>
                        <Text style={[styles.feedbackModalSubtitle, { fontSize: 15 * fontScale, color: theme.textSecondary }]}>
                            {feedbackModalData.message}
                        </Text>

                        <TouchableOpacity 
                            style={[
                                styles.feedbackConfirmButton,
                                { backgroundColor: feedbackModalData.type === 'success' ? theme.buttonPrimary : '#EF4444' }
                            ]} 
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setFeedbackModalVisible(false);
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.feedbackConfirmText, { fontSize: 16 * fontScale, color: theme.buttonText }]}>ENTENDIDO</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL DO MEU QR CODE */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={qrModalVisible}
                onRequestClose={() => setQrModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { fontSize: 22 * fontScale, color: theme.textPrimary }]}>O Seu Código de Acesso</Text>
                        <Text style={[styles.modalSubtitle, { fontSize: 15 * fontScale, color: theme.textSecondary }]}>
                            Mostre este código ao seu responsável ou cuidador para vincular as contas.
                        </Text>
                        
                        <View style={styles.qrCodeWrapper}>
                            <QRCode
                                value={userId || 'usuario-sem-id'}
                                size={220}
                                color="#000000"
                                backgroundColor="#FFFFFF"
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.closeModalButton, { backgroundColor: theme.buttonPrimary }]} 
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setQrModalVisible(false);
                            }}
                        >
                            <Text style={[styles.closeModalText, { fontSize: 16 * fontScale, color: theme.buttonText }]}>FECHAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL DO SCANNER DA CÂMARA */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={scannerVisible}
                onRequestClose={() => setScannerVisible(false)}
            >
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerHeader}>
                        <Text style={[styles.scannerTitle, { fontSize: 20 * fontScale }]}>Aponte para o QR Code</Text>
                        <TouchableOpacity onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setScannerVisible(false);
                        }}>
                            <MaterialCommunityIcons name="close" size={32} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.cameraContainer}>
                        <CameraView
                            style={StyleSheet.absoluteFillObject}
                            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                            }}
                        />
                        <View style={[styles.scannerTarget, { borderColor: theme.buttonPrimary }]} />
                    </View>
                </View>
            </Modal>

            {/* MODAL DE CONFIRMAÇÃO DE LOGOUT */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={logoutModalVisible}
                onRequestClose={() => setLogoutModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.logoutModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <View style={styles.logoutIconCircle}>
                            <MaterialCommunityIcons name="logout" size={36} color="#FFFFFF" />
                        </View>

                        <Text style={[styles.logoutModalTitle, { fontSize: 20 * fontScale, color: theme.textPrimary }]}>SAIR DA CONTA</Text>
                        <Text style={[styles.logoutModalSubtitle, { fontSize: 16 * fontScale, color: theme.textSecondary }]}>
                            Tem certeza que deseja sair? Você precisará entrar novamente com seu e-mail e senha para usar o aplicativo.
                        </Text>

                        <View style={styles.logoutButtonRow}>
                            <TouchableOpacity
                                style={[styles.logoutCancelButton, { borderColor: theme.border }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setLogoutModalVisible(false);
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.logoutCancelText, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.logoutConfirmButton}
                                onPress={handleConfirmLogout}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.logoutConfirmText, { fontSize: 16 * fontScale }]}>SIM, SAIR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ==========================================
// ESTILOS 
// ==========================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
        alignItems: 'center',
    },
    profilePicWrapper: {
        position: 'relative',
        marginBottom: 20,
    },
    profilePicContainer: {
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 3,
        padding: 4,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: 90,
    },
    profilePlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 90,
        alignItems: 'center',
        justifyContent: 'center',
    },
    removePhotoButton: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: '#d9534f',
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
    },
    greetingText: {
        marginBottom: 24,
    },
    greetingName: {
        fontWeight: 'bold',
    },
    accessibilityContainer: {
        width: '100%',
        borderRadius: 20,
        borderWidth: 1.5,
        padding: 16,
        marginBottom: 24,
    },
    accessibilityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    accessibilityTitle: {
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    fontScaleSelector: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
    },
    fontScaleButton: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fontScaleText: {
        fontWeight: '500',
    },
    accessibilityDivider: {
        height: 1,
        marginVertical: 16,
        width: '100%',
    },
    contrastRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    contrastInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    contrastLabel: {
        fontWeight: 'bold',
    },
    dependentsSection: {
        width: '100%',
        marginBottom: 24,
    },
    dependentsSectionTitle: {
        fontWeight: 'bold',
        marginBottom: 10,
        marginLeft: 4,
    },
    dependentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 10,
    },
    dependentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    dependentAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    dependentAvatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dependentName: {
        fontWeight: 'bold',
        flex: 1,
    },
    removeDependentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d9534f',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 4,
    },
    removeDependentText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    fieldsContainer: {
        width: '100%',
        gap: 20,
    },
    fieldWrapper: {
        width: '100%',
    },
    fieldLabel: {
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 30,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    inputText: {
        flex: 1,
        marginLeft: 12,
        marginRight: 12,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 32,
        gap: 16,
    },
    actionButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 20,
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    actionButtonText: {
        fontWeight: 'bold',
        marginTop: 8,
    },
    logoutLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 36,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    logoutLinkText: {
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        borderRadius: 24,
        borderWidth: 1.5,
        padding: 30,
        alignItems: 'center',
    },
    modalTitle: {
        fontWeight: 'bold',
        marginBottom: 10,
    },
    modalSubtitle: {
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    qrCodeWrapper: {
        padding: 15,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        marginBottom: 30,
    },
    closeModalButton: {
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
    },
    closeModalText: {
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    scannerOverlay: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 10,
    },
    scannerTitle: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    cameraContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerTarget: {
        width: 250,
        height: 250,
        borderWidth: 4,
        backgroundColor: 'transparent',
        borderRadius: 20,
    },
    logoutModalContent: {
        width: '88%',
        borderRadius: 28,
        borderWidth: 1.5,
        padding: 26,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    logoutIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#d9534f',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    logoutModalTitle: {
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    logoutModalSubtitle: {
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 26,
        lineHeight: 22,
    },
    logoutButtonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    logoutCancelButton: {
        flex: 1,
        backgroundColor: 'transparent',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    logoutCancelText: {
        fontWeight: 'bold',
    },
    logoutConfirmButton: {
        flex: 1,
        backgroundColor: '#d9534f',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    logoutConfirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    confirmModalContent: {
        width: '85%',
        borderRadius: 24,
        borderWidth: 1.5,
        padding: 26,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    confirmIconCircle: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#d9534f',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    confirmModalTitle: {
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    confirmModalSubtitle: {
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    confirmButtonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    confirmCancelButton: {
        flex: 1,
        backgroundColor: 'transparent',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    confirmCancelText: {
        fontWeight: 'bold',
    },
    confirmDeleteButton: {
        flex: 1,
        backgroundColor: '#d9534f',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    confirmDeleteText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    feedbackModalContent: {
        width: '85%',
        borderRadius: 24,
        borderWidth: 1.5,
        padding: 28,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    feedbackIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    feedbackModalTitle: {
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    feedbackModalSubtitle: {
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    feedbackConfirmButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 24,
        width: '100%',
        alignItems: 'center',
    },
    feedbackConfirmText: {
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});