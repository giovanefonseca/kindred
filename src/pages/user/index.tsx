import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Modal,
    ActivityIndicator,
    ScrollView,
    Switch,
    TextInput,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { 
    signOut, 
    updateEmail, 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider 
} from 'firebase/auth';
import * as Haptics from 'expo-haptics';

// Contexto Global de Acessibilidade
import { useAccessibility, FontSizeOption } from '../../contexts/AccessibilityContext';

// Componentes Auxiliares
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CustomNotificationModal } from '../../components/CustomNotificationModal/CustomNotificationModal';

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

    const { 
        fontSizeMode, 
        fontScale, 
        isHighContrast, 
        toggleHighContrast, 
        theme, 
        changeFontSize 
    } = useAccessibility();

    // DADOS INICIAIS IMEDIATOS (Pegando do auth.currentUser para renderização instantânea)
    const currentUser = auth.currentUser;
    const initialName = currentUser?.displayName || 'Usuário';
    const initialEmail = currentUser?.email || 'email@exemplo.com';

    const [userData, setUserData] = useState<UserData>({
        nome: initialName,
        apelido: initialName,
        email: initialEmail,
        photoUrl: currentUser?.photoURL || null
    });
    
    const [uploadingImage, setUploadingImage] = useState(false);
    
    // Lista de dependentes vinculados
    const [dependentsList, setDependentsList] = useState<DependentUser[]>([]);

    // Estados dos Modais do Perfil
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);

    // Modal de Inserção Manual do Código
    const [manualCodeModalVisible, setManualCodeModalVisible] = useState(false);
    const [manualCodeInput, setManualCodeInput] = useState('');

    // Modais de Edição de Dados
    const [editNicknameModalVisible, setEditNicknameModalVisible] = useState(false);
    const [editEmailModalVisible, setEditEmailModalVisible] = useState(false);
    const [editPasswordModalVisible, setEditPasswordModalVisible] = useState(false);

    // Inputs dos Formulários de Edição
    const [newNickname, setNewNickname] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [savingField, setSavingField] = useState(false);

    // Estado para o CustomNotificationModal de Feedback (Sucesso / Erro)
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
    const [feedbackModalData, setFeedbackModalData] = useState<{
        title: string;
        message: string;
        type: 'success' | 'error';
    }>({ title: '', message: '', type: 'success' });

    // Estado para o CustomNotificationModal de Confirmação
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState<{
        title: string;
        message: string;
        isDestructive?: boolean;
        onConfirm: () => void;
    }>({ title: '', message: '', isDestructive: false, onConfirm: () => {} });

    // Permissões da Câmera
    const [permission, requestPermission] = useCameraPermissions();

    const userId = auth.currentUser?.uid;

    const showFeedback = (title: string, message: string, type: 'success' | 'error' = 'success') => {
        if (type === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setFeedbackModalData({ title, message, type });
        setFeedbackModalVisible(true);
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void, isDestructive: boolean = false) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setConfirmModalData({ title, message, isDestructive, onConfirm });
        setConfirmModalVisible(true);
    };

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

    // BUSCA EM SEGUNDO PLANO SEM TRAVAR A INTERFACE
    useEffect(() => {
        const fetchUserDataInBg = async () => {
            if (!userId) return;
            try {
                const docRef = doc(db, 'users', userId);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData({
                        nome: data.nome || initialName,
                        apelido: data.apelido || data.nome || initialName,
                        email: data.email || initialEmail,
                        photoUrl: data.photoUrl || null
                    });

                    if (data.dependentes && Array.isArray(data.dependentes)) {
                        fetchDependents(data.dependentes);
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar usuário em segundo plano:", error);
            }
        };

        fetchUserDataInBg();
    }, [userId]);

    const handleSelectFontSize = (mode: FontSizeOption) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        changeFontSize(mode);
    };

    const handleToggleContrast = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        toggleHighContrast();
    };

    // ---------------------------------------------------------------------------
    // FUNÇÕES DE COMPARTILHAMENTO E VÍNCULO POR CÓDIGO
    // ---------------------------------------------------------------------------

    const handleShareCodeWhatsApp = async () => {
        if (!userId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const message = `Olá! Este é meu código de vínculo no aplicativo Kindred:\n\n*${userId}*\n\nCole este código na opção "Colar Código" do seu aplicativo para vincular nossa conta.`;
        const url = `whatsapp://send?text=${encodeURIComponent(message)}`;

        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                showFeedback('WHATSAPP NÃO INSTALADO', 'Copie seu código manualmente ou instale o aplicativo WhatsApp.', 'error');
            }
        } catch (error) {
            console.error('Erro ao abrir WhatsApp:', error);
            showFeedback('ERRO', 'Não foi possível abrir o WhatsApp.', 'error');
        }
    };

    const handlePasteFromClipboard = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const text = await Clipboard.getStringAsync();
        if (text) {
            setManualCodeInput(text.trim());
        } else {
            showFeedback('ÁREA DE TRANSFERÊNCIA VAZIA', 'Nenhum código encontrado na área de transferência.', 'error');
        }
    };

    const handleProcessManualCode = async () => {
        const code = manualCodeInput.trim();
        if (!code) {
            showFeedback('CÓDIGO VAZIO', 'Por favor, insira ou cole o código do usuário.', 'error');
            return;
        }

        if (code === userId) {
            showFeedback('AÇÃO INVÁLIDA', 'Você não pode vincular sua própria conta.', 'error');
            return;
        }

        setSavingField(true);
        try {
            const targetUserRef = doc(db, 'users', code);
            const targetUserSnap = await getDoc(targetUserRef);

            if (!targetUserSnap.exists()) {
                showFeedback('CÓDIGO INVÁLIDO', 'Usuário não encontrado com o código informado.', 'error');
                return;
            }

            const targetData = targetUserSnap.data();
            const targetName = targetData.apelido || targetData.nome || 'este usuário';

            setManualCodeModalVisible(false);
            setManualCodeInput('');

            showConfirm(
                'VINCULAR CONTAS',
                `Deseja confirmar o vínculo com ${targetName}?`,
                () => linkUsers(code),
                false
            );
        } catch (error) {
            console.error('Erro ao verificar código manual:', error);
            showFeedback('ERRO', 'Falha ao verificar o código digitado.', 'error');
        } finally {
            setSavingField(false);
        }
    };

    // ---------------------------------------------------------------------------
    // FUNÇÕES DE ALTERAÇÃO DOS CAMPOS DE USUÁRIO
    // ---------------------------------------------------------------------------

    const handleSaveNickname = async () => {
        if (!userId) return;
        if (!newNickname.trim()) {
            showFeedback('CAMPO VAZIO', 'Informe um apelido válido.', 'error');
            return;
        }

        setSavingField(true);
        try {
            await updateDoc(doc(db, 'users', userId), {
                apelido: newNickname.trim()
            });

            setUserData(prev => ({ ...prev, apelido: newNickname.trim() }));
            setEditNicknameModalVisible(false);
            showFeedback('SUCESSO', 'Seu apelido foi atualizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao atualizar apelido:', error);
            showFeedback('ERRO', 'Não foi possível atualizar o apelido. Tente novamente.', 'error');
        } finally {
            setSavingField(false);
        }
    };

    const handleSaveEmail = async () => {
        const user = auth.currentUser;
        if (!user || !userId) return;

        if (!newEmail.trim() || !newEmail.includes('@')) {
            showFeedback('E-MAIL INVÁLIDO', 'Por favor, digite um e-mail válido.', 'error');
            return;
        }

        setSavingField(true);
        try {
            await updateEmail(user, newEmail.trim());

            await updateDoc(doc(db, 'users', userId), {
                email: newEmail.trim()
            });

            setUserData(prev => ({ ...prev, email: newEmail.trim() }));
            setEditEmailModalVisible(false);
            showFeedback('E-MAIL ATUALIZADO', 'Seu e-mail de acesso foi alterado com sucesso!', 'success');
        } catch (error: any) {
            console.error('Erro ao atualizar e-mail:', error);
            if (error.code === 'auth/requires-recent-login') {
                showFeedback('SEGURANÇA', 'Para alterar seu e-mail, saia da conta e faça login novamente por segurança.', 'error');
            } else if (error.code === 'auth/email-already-in-use') {
                showFeedback('E-MAIL EM USO', 'Este e-mail já está em uso por outra conta.', 'error');
            } else {
                showFeedback('ERRO', 'Não foi possível atualizar o e-mail. Tente novamente.', 'error');
            }
        } finally {
            setSavingField(false);
        }
    };

    const handleSavePassword = async () => {
        const user = auth.currentUser;
        if (!user || !user.email) return;

        if (!currentPassword) {
            showFeedback('SENHA ATUAL', 'Digite sua senha atual para confirmar a alteração.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showFeedback('SENHA CURTA', 'A nova senha deve conter pelo menos 6 caracteres.', 'error');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            showFeedback('SENHAS DIFERENTES', 'A confirmação de senha não confere com a nova senha.', 'error');
            return;
        }

        setSavingField(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            await updatePassword(user, newPassword);

            setEditPasswordModalVisible(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');

            showFeedback('SENHA ALTERADA', 'Sua senha foi atualizada com sucesso!', 'success');
        } catch (error: any) {
            console.error('Erro ao trocar senha:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                showFeedback('SENHA INCORRETA', 'Sua senha atual está incorreta. Verifique e tente novamente.', 'error');
            } else {
                showFeedback('ERRO AO ALTERAR', 'Não foi possível alterar a senha. Tente novamente.', 'error');
            }
        } finally {
            setSavingField(false);
        }
    };

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
            },
            true 
        );
    };

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

            showConfirm(
                'VINCULAR CONTAS',
                `Deseja confirmar o vínculo com ${nomeDependente}?`,
                () => linkUsers(data),
                false
            );
        } catch (error) {
            console.error("Erro ao processar QR Code:", error);
            showFeedback('ERRO', 'Falha ao processar a leitura do QR Code.', 'error');
        }
    };

    const linkUsers = async (dependentId: string) => {
        if (!userId) return;

        setConfirmModalVisible(false);

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

    const handleRemoveDependent = (dependent: DependentUser) => {
        if (!userId) return;

        showConfirm(
            'DESVINCULAR DEPENDENTE',
            `Tem certeza de que deseja remover ${dependent.nome} da sua lista de dependentes?`,
            async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setConfirmModalVisible(false);

                try {
                    await updateDoc(doc(db, 'users', userId), {
                        dependentes: arrayRemove(dependent.uid)
                    });

                    try {
                        await updateDoc(doc(db, 'users', dependent.uid), {
                            responsaveis: arrayRemove(userId)
                        });
                    } catch (err) {
                        console.log("Erro ao remover responsavel no dependente:", err);
                    }

                    setDependentsList(prev => prev.filter(item => item.uid !== dependent.uid));
                    showFeedback('SUCESSO', `${dependent.nome} foi desvinculado com sucesso.`, 'success');
                } catch (error) {
                    console.error("Erro ao desvincular dependente:", error);
                    showFeedback('ERRO', 'Não foi possível remover o dependente. Tente novamente.', 'error');
                }
            },
            true 
        );
    };

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

                {/* BADGE VISUAL DE CONFIRMAÇÃO DE SINCRONIZAÇÃO */}
                <SyncStatusBadge isSyncing={uploadingImage} />

                {/* PAINEL DE ACESSIBILIDADE */}
                <View style={[styles.accessibilityContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    
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
                            <Text 
                                style={[
                                    styles.fontScaleText,
                                    { fontSize: 13, color: fontSizeMode === 'normal' ? theme.buttonText : theme.textPrimary }
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
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
                            <Text 
                                style={[
                                    styles.fontScaleText,
                                    { fontSize: 15, fontWeight: 'bold', color: fontSizeMode === 'large' ? theme.buttonText : theme.textPrimary }
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
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
                            <Text 
                                style={[
                                    styles.fontScaleText,
                                    { fontSize: 17, fontWeight: 'bold', color: fontSizeMode === 'xlarge' ? theme.buttonText : theme.textPrimary }
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                A++ (Extra)
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.accessibilityDivider, { backgroundColor: theme.border }]} />

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
                    {/* EDITAR APELIDO */}
                    <View style={styles.fieldWrapper}>
                        <Text style={[styles.fieldLabel, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>APELIDO</Text>
                        <TouchableOpacity 
                            style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} 
                            onPress={() => {
                                setNewNickname(userData.apelido);
                                setEditNicknameModalVisible(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="card-account-details" size={28} color={theme.buttonPrimary} />
                            <Text style={[styles.inputText, { fontSize: 16 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                                {userData.apelido}
                            </Text>
                            <MaterialCommunityIcons name="pencil" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* EDITAR SENHA */}
                    <View style={styles.fieldWrapper}>
                        <Text style={[styles.fieldLabel, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>SENHA</Text>
                        <TouchableOpacity 
                            style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} 
                            onPress={() => {
                                setCurrentPassword('');
                                setNewPassword('');
                                setConfirmNewPassword('');
                                setEditPasswordModalVisible(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="lock" size={28} color={theme.buttonPrimary} />
                            <Text style={[styles.inputText, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>********</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* EDITAR E-MAIL */}
                    <View style={styles.fieldWrapper}>
                        <Text style={[styles.fieldLabel, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>E-MAIL</Text>
                        <TouchableOpacity 
                            style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]} 
                            onPress={() => {
                                setNewEmail(userData.email);
                                setEditEmailModalVisible(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="email" size={28} color={theme.buttonPrimary} />
                            <Text style={[styles.inputText, { fontSize: 16 * fontScale, color: theme.textPrimary }]} numberOfLines={1}>
                                {userData.email}
                            </Text>
                            <MaterialCommunityIcons name="pencil" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* BOTÕES DE AÇÃO PRINCIPAIS */}
                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: theme.buttonPrimary, borderColor: theme.border }]} 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setQrModalVisible(true);
                        }}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode" size={32} color={theme.buttonText} />
                        <Text style={[styles.actionButtonText, { fontSize: 15 * fontScale, color: theme.buttonText }]}>Meu Código</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: theme.buttonPrimary, borderColor: theme.border }]} 
                        onPress={handleOpenScanner}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode-scan" size={32} color={theme.buttonText} />
                        <Text style={[styles.actionButtonText, { fontSize: 15 * fontScale, color: theme.buttonText }]}>Ler QR Code</Text>
                    </TouchableOpacity>
                </View>

                {/* BOTÃO COMPLEMENTAR: INSERT MANUAL / WHATSAPP */}
                <View style={styles.secondaryActionsRow}>
                    <TouchableOpacity 
                        style={[styles.secondaryActionButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setManualCodeModalVisible(true);
                        }}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="content-paste" size={22} color={theme.buttonPrimary} />
                        <Text style={[styles.secondaryActionText, { fontSize: 14 * fontScale, color: theme.textPrimary }]}>
                            Colar Código
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.secondaryActionButton, { backgroundColor: '#25D366', borderColor: theme.border}]}
                        onPress={handleShareCodeWhatsApp}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="whatsapp" size={22} color="#FFFFFF" />
                        <Text style={[styles.secondaryActionText, { fontSize: 14 * fontScale, color: '#FFFFFF' }]}>
                            Enviar Código
                        </Text>
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

            {/* MODAL DE INSERÇÃO MANUAL DE CÓDIGO */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={manualCodeModalVisible}
                onRequestClose={() => setManualCodeModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.formModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <View style={styles.manualCodeHeader}>
                            <MaterialCommunityIcons name="key-link" size={36} color={theme.buttonPrimary} />
                            <Text style={[styles.formModalTitle, { fontSize: 20 * fontScale, color: theme.textPrimary }]}>
                                VINCULAR POR CÓDIGO
                            </Text>
                        </View>

                        <Text style={[styles.manualCodeSubtitle, { fontSize: 14 * fontScale, color: theme.textSecondary }]}>
                            Cole ou digite o código de usuário enviado pelo seu dependente ou responsável:
                        </Text>

                        <View style={styles.inputWithPasteWrapper}>
                            <TextInput
                                style={[
                                    styles.formInputFlex, 
                                    { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.textPrimary, fontSize: 14 * fontScale }
                                ]}
                                placeholder="Código UID do usuário"
                                placeholderTextColor={theme.textSecondary}
                                value={manualCodeInput}
                                onChangeText={setManualCodeInput}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity 
                                style={[styles.pasteIconButton, { backgroundColor: theme.buttonPrimary }]}
                                onPress={handlePasteFromClipboard}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="content-paste" size={20} color={theme.buttonText} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formButtonRow}>
                            <TouchableOpacity 
                                style={[styles.formCancelButton, { borderColor: theme.border }]} 
                                onPress={() => {
                                    setManualCodeModalVisible(false);
                                    setManualCodeInput('');
                                }}
                            >
                                <Text style={[styles.formCancelText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.formSaveButton, { backgroundColor: theme.buttonPrimary }]} 
                                onPress={handleProcessManualCode} 
                                disabled={savingField}
                            >
                                {savingField ? (
                                    <ActivityIndicator color={theme.buttonText} />
                                ) : (
                                    <Text style={[styles.formSaveText, { fontSize: 15 * fontScale, color: theme.buttonText }]}>VINCULAR</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL EDITAR APELIDO */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={editNicknameModalVisible}
                onRequestClose={() => setEditNicknameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.formModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.formModalTitle, { fontSize: 20 * fontScale, color: theme.textPrimary }]}>ALTERAR APELIDO</Text>
                        <TextInput
                            style={[styles.formInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.textPrimary, fontSize: 16 * fontScale }]}
                            placeholder="Digite seu novo apelido"
                            placeholderTextColor={theme.textSecondary}
                            value={newNickname}
                            onChangeText={setNewNickname}
                        />
                        <View style={styles.formButtonRow}>
                            <TouchableOpacity style={[styles.formCancelButton, { borderColor: theme.border }]} onPress={() => setEditNicknameModalVisible(false)}>
                                <Text style={[styles.formCancelText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.formSaveButton, { backgroundColor: theme.buttonPrimary }]} onPress={handleSaveNickname} disabled={savingField}>
                                {savingField ? <ActivityIndicator color={theme.buttonText} /> : <Text style={[styles.formSaveText, { fontSize: 15 * fontScale, color: theme.buttonText }]}>SALVAR</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL EDITAR E-MAIL */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={editEmailModalVisible}
                onRequestClose={() => setEditEmailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.formModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.formModalTitle, { fontSize: 20 * fontScale, color: theme.textPrimary }]}>ALTERAR E-MAIL</Text>
                        <TextInput
                            style={[styles.formInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.textPrimary, fontSize: 16 * fontScale }]}
                            placeholder="Novo e-mail"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={newEmail}
                            onChangeText={setNewEmail}
                        />
                        <View style={styles.formButtonRow}>
                            <TouchableOpacity style={[styles.formCancelButton, { borderColor: theme.border }]} onPress={() => setEditEmailModalVisible(false)}>
                                <Text style={[styles.formCancelText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.formSaveButton, { backgroundColor: theme.buttonPrimary }]} onPress={handleSaveEmail} disabled={savingField}>
                                {savingField ? <ActivityIndicator color={theme.buttonText} /> : <Text style={[styles.formSaveText, { fontSize: 15 * fontScale, color: theme.buttonText }]}>SALVAR</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL EDITAR SENHA */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={editPasswordModalVisible}
                onRequestClose={() => setEditPasswordModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.formModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.formModalTitle, { fontSize: 20 * fontScale, color: theme.textPrimary }]}>ALTERAR SENHA</Text>
                        
                        <TextInput
                            style={[styles.formInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.textPrimary, fontSize: 15 * fontScale }]}
                            placeholder="Senha atual"
                            placeholderTextColor={theme.textSecondary}
                            secureTextEntry
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                        />
                        <TextInput
                            style={[styles.formInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.textPrimary, fontSize: 15 * fontScale }]}
                            placeholder="Nova senha (min. 6 dígitos)"
                            placeholderTextColor={theme.textSecondary}
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />
                        <TextInput
                            style={[styles.formInput, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.textPrimary, fontSize: 15 * fontScale }]}
                            placeholder="Confirme a nova senha"
                            placeholderTextColor={theme.textSecondary}
                            secureTextEntry
                            value={confirmNewPassword}
                            onChangeText={setConfirmNewPassword}
                        />

                        <View style={styles.formButtonRow}>
                            <TouchableOpacity style={[styles.formCancelButton, { borderColor: theme.border }]} onPress={() => setEditPasswordModalVisible(false)}>
                                <Text style={[styles.formCancelText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.formSaveButton, { backgroundColor: theme.buttonPrimary }]} onPress={handleSavePassword} disabled={savingField}>
                                {savingField ? <ActivityIndicator color={theme.buttonText} /> : <Text style={[styles.formSaveText, { fontSize: 15 * fontScale, color: theme.buttonText }]}>ALTERAR</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL CUSTOMIZADO DE CONFIRMAÇÃO COM CHILDREN */}
            <CustomNotificationModal
                visible={confirmModalVisible}
                title={confirmModalData.title}
                subtitle={confirmModalData.message}
                iconName={confirmModalData.isDestructive ? "alert-circle-outline" : "account-heart"}
                iconColor={confirmModalData.isDestructive ? '#EF4444' : (isHighContrast ? theme.buttonPrimary : '#0052cc')}
                hideDefaultButtons={true}
                onClose={() => setConfirmModalVisible(false)}
            >
                <View style={styles.modalActionButtonsGroup}>
                    <TouchableOpacity
                        style={[styles.modalCancelButton, { borderColor: theme.border }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setConfirmModalVisible(false);
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.modalCancelButtonText, { fontSize: 15 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.modalConfirmButton,
                            { backgroundColor: confirmModalData.isDestructive ? '#EF4444' : theme.buttonPrimary }
                        ]}
                        onPress={confirmModalData.onConfirm}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.modalConfirmButtonText, 
                            { fontSize: 15 * fontScale, color: confirmModalData.isDestructive ? '#FFFFFF' : theme.buttonText }
                        ]}>
                            {confirmModalData.isDestructive ? 'SIM, REMOVER' : 'CONFIRMAR'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </CustomNotificationModal>

            {/* MODAL CUSTOMIZADO DE FEEDBACK (SUCESSO / ERRO) COM CHILDREN */}
            <CustomNotificationModal
                visible={feedbackModalVisible}
                title={feedbackModalData.title}
                subtitle={feedbackModalData.message}
                iconName={feedbackModalData.type === 'success' ? "check-bold" : "alert-circle-outline"}
                iconColor={feedbackModalData.type === 'success' ? '#22C55E' : '#EF4444'}
                closeText="ENTENDIDO"
                closeButtonColor={feedbackModalData.type === 'success' ? theme.buttonPrimary : '#EF4444'}
                onClose={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFeedbackModalVisible(false);
                }}
            />

            {/* MODAL DO MEU QR CODE + COMPARTILHAMENTO */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={qrModalVisible}
                onRequestClose={() => setQrModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { fontSize: 22 * fontScale, color: theme.textPrimary }]}>Seu Código de Acesso</Text>
                        <Text style={[styles.modalSubtitle, { fontSize: 14 * fontScale, color: theme.textSecondary }]}>
                            Mostre este QR Code ou envie o seu código em texto para o seu responsável.
                        </Text>
                        
                        <View style={styles.qrCodeWrapper}>
                            <QRCode
                                value={userId || 'usuario-sem-id'}
                                size={200}
                                color="#000000"
                                backgroundColor="#FFFFFF"
                            />
                        </View>

                        <TouchableOpacity 
                            style={styles.whatsAppShareButton}
                            onPress={handleShareCodeWhatsApp}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="whatsapp" size={24} color="#FFFFFF" />
                            <Text style={[styles.whatsAppShareText, { fontSize: 15 * fontScale }]}>
                                Enviar código por WhatsApp
                            </Text>
                        </TouchableOpacity>

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

            {/* MODAL DE CONFIRMAÇÃO DE LOGOUT COM CHILDREN */}
            <CustomNotificationModal
                visible={logoutModalVisible}
                title="SAIR DA CONTA"
                subtitle="Tem certeza que deseja sair? Você precisará entrar novamente com seu e-mail e senha para usar o aplicativo."
                iconName="logout"
                iconColor="#d9534f"
                hideDefaultButtons={true}
                onClose={() => setLogoutModalVisible(false)}
            >
                <View style={styles.modalActionButtonsGroup}>
                    <TouchableOpacity
                        style={[styles.modalCancelButton, { borderColor: theme.border }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setLogoutModalVisible(false);
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.modalCancelButtonText, { fontSize: 16 * fontScale, color: theme.textPrimary }]}>CANCELAR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.modalLogoutConfirmButton}
                        onPress={handleConfirmLogout}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.modalLogoutConfirmText, { fontSize: 16 * fontScale }]}>SIM, SAIR</Text>
                    </TouchableOpacity>
                </View>
            </CustomNotificationModal>

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
        marginBottom: 8,
        textAlign: 'center',
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
        marginTop: 12,
    },
    accessibilityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    accessibilityTitle: {
        fontWeight: 'bold',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    fontScaleSelector: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'space-between',
    },
    fontScaleButton: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fontScaleText: {
        fontWeight: '500',
        textAlign: 'center',
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
        flex: 1,
        marginRight: 10,
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
        paddingHorizontal: 10,
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
        paddingVertical: 18,
        paddingHorizontal: 8,
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
        marginTop: 6,
        textAlign: 'center',
    },
    secondaryActionsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 14,
    },
    secondaryActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 16,
        borderWidth: 1.5,
        gap: 8,
    },
    secondaryActionText: {
        fontWeight: 'bold',
        textAlign: 'center',
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
        paddingHorizontal: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        borderWidth: 1.5,
        padding: 26,
        alignItems: 'center',
    },
    modalTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
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
        marginBottom: 20,
    },
    whatsAppShareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 20,
        gap: 8,
        width: '100%',
        marginBottom: 12,
    },
    whatsAppShareText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textAlign: 'center',
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
        textAlign: 'center',
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
        textAlign: 'center',
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
    modalActionButtonsGroup: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    modalCancelButtonText: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalConfirmButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalConfirmButtonText: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalLogoutConfirmButton: {
        flex: 1,
        backgroundColor: '#d9534f',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalLogoutConfirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    formModalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        borderWidth: 1.5,
        padding: 24,
        alignItems: 'center',
        elevation: 8,
    },
    formModalTitle: {
        fontWeight: '900',
        marginBottom: 16,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    formInput: {
        width: '100%',
        borderWidth: 1.5,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    formButtonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    formCancelButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    formCancelText: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    formSaveButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    formSaveText: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    manualCodeHeader: {
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    manualCodeSubtitle: {
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 18,
    },
    inputWithPasteWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: 8,
        marginBottom: 18,
    },
    formInputFlex: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    pasteIconButton: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
});