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
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { themes } from '../../global/themes';

// Firebase
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig'; 

interface UserData {
    nome: string;
    apelido: string;
    email: string;
    photoUrl: string | null;
}

export default function User() {
    const navigation = useNavigation<any>();

    const [userData, setUserData] = useState<UserData>({
        nome: 'Carregando...',
        apelido: 'Carregando...',
        email: 'carregando...',
        photoUrl: null
    });
    const [loading, setLoading] = useState(true);
    
    // Estados dos Modais
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    
    // Permissões da Câmara
    const [permission, requestPermission] = useCameraPermissions();

    const userId = auth.currentUser?.uid;

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
                }
            } catch (error) {
                console.error("Erro ao buscar usuário:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userId]);

    // 2. Função para escolher/tirar foto de perfil
    const handlePickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
            Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para mudar a foto.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && userId) {
            const newPhotoUri = result.assets[0].uri;
            setUserData(prev => ({ ...prev, photoUrl: newPhotoUri }));

            try {
                await updateDoc(doc(db, 'users', userId), { photoUrl: newPhotoUri });
            } catch (error) {
                console.log("Erro ao salvar foto:", error);
            }
        }
    };

    // 3. Abrir a câmara para escanear
    const handleOpenScanner = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert('Permissão negada', 'Precisamos de acesso à câmara para ler o QR Code.');
                return;
            }
        }
        setScanned(false);
        setScannerVisible(true);
    };

    // 4. Lógica executada ao encontrar um QR Code
    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        setScanned(true);
        setScannerVisible(false); // Fecha o scanner imediatamente
        
        if (!userId) return;

        if (data === userId) {
            Alert.alert('Ação Inválida', 'Não pode vincular a sua própria conta.');
            return;
        }

        try {
            // Verifica se o utilizador escaneado existe na base de dados
            const scannedUserRef = doc(db, 'users', data);
            const scannedUserSnap = await getDoc(scannedUserRef);

            if (!scannedUserSnap.exists()) {
                Alert.alert('Erro', 'Utilizador não encontrado no sistema.');
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
            Alert.alert('Erro', 'Falha ao processar a leitura do QR Code.');
        }
    };

    // 5. Salva a relação de dependente no Firestore
    const linkUsers = async (dependentId: string) => {
        if (!userId) return;

        try {
            // Adiciona o Dependente na lista do Responsável (quem escaneou)
            await updateDoc(doc(db, 'users', userId), {
                dependentes: arrayUnion(dependentId)
            });

            // Tenta adicionar o Responsável na lista do Dependente se houver permissão
            try {
                await updateDoc(doc(db, 'users', dependentId), {
                    responsaveis: arrayUnion(userId)
                });
            } catch (permissionErr) {
                // Se as regras do Firestore bloquearem a escrita no documento do dependente,
                // o vínculo no responsável já garante o acesso.
                console.log("Vínculo registrado no responsável:", permissionErr);
            }

            Alert.alert('Sucesso!', 'As contas foram vinculadas com sucesso.');
        } catch (error) {
            console.error("Erro ao vincular:", error);
            Alert.alert('Erro', 'Não foi possível vincular as contas.');
        }
    };

    const handleEditField = (field: string) => {
        Alert.alert('Editar', `A edição do campo ${field} será implementada em breve.`);
    };

    // 6. Executa o logout de fato
    const handleConfirmLogout = async () => {
        setLogoutModalVisible(false);
        try {
            await signOut(auth);
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } catch (error) {
            console.error('Erro ao sair da conta:', error);
            Alert.alert('Erro', 'Não foi possível sair da conta. Tente novamente.');
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#0052cc" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <View style={styles.profilePicContainer}>
                    <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                        {userData.photoUrl ? (
                            <Image source={{ uri: userData.photoUrl }} style={styles.profileImage} />
                        ) : (
                            <View style={styles.profilePlaceholder}>
                                <MaterialCommunityIcons name="camera-plus" size={40} color="#0052cc" />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <Text style={styles.greetingText}>
                    Olá, <Text style={styles.greetingName}>{userData.apelido}!</Text>
                </Text>

                <View style={styles.fieldsContainer}>
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>APELIDO</Text>
                        <TouchableOpacity style={styles.inputContainer} onPress={() => handleEditField('Apelido')}>
                            <MaterialCommunityIcons name="card-account-details" size={28} color="#0052cc" />
                            <Text style={styles.inputText} numberOfLines={1}>{userData.apelido}</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color="#7BA4DB" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>SENHA</Text>
                        <TouchableOpacity style={styles.inputContainer} onPress={() => handleEditField('Senha')}>
                            <MaterialCommunityIcons name="lock" size={28} color="#0052cc" />
                            <Text style={styles.inputText}>********</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color="#7BA4DB" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>E-MAIL</Text>
                        <TouchableOpacity style={styles.inputContainer} onPress={() => handleEditField('E-mail')}>
                            <MaterialCommunityIcons name="email" size={28} color="#0052cc" />
                            <Text style={styles.inputText} numberOfLines={1}>{userData.email}</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color="#7BA4DB" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* BOTÕES DE AÇÃO (MOSTRAR QR / LER QR) */}
                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity 
                        style={styles.actionButton} 
                        onPress={() => setQrModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode" size={36} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Meu Código</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionButton} 
                        onPress={handleOpenScanner}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode-scan" size={36} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Ler Código</Text>
                    </TouchableOpacity>
                </View>

                {/* SAIR DA CONTA */}
                <TouchableOpacity
                    style={styles.logoutLink}
                    onPress={() => setLogoutModalVisible(true)}
                    activeOpacity={0.6}
                >
                    <MaterialCommunityIcons name="logout" size={16} color="#999" />
                    <Text style={styles.logoutLinkText}>Sair da conta</Text>
                </TouchableOpacity>

            </ScrollView>

            {/* MODAL DO MEU QR CODE */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={qrModalVisible}
                onRequestClose={() => setQrModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>O Seu Código de Acesso</Text>
                        <Text style={styles.modalSubtitle}>Mostre este código ao seu responsável ou cuidador para vincular as contas.</Text>
                        
                        <View style={styles.qrCodeWrapper}>
                            <QRCode
                                value={userId || 'usuario-sem-id'}
                                size={220}
                                color="#0052cc"
                                backgroundColor="#FFFFFF"
                            />
                        </View>

                        <TouchableOpacity 
                            style={styles.closeModalButton} 
                            onPress={() => setQrModalVisible(false)}
                        >
                            <Text style={styles.closeModalText}>FECHAR</Text>
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
                        <Text style={styles.scannerTitle}>Aponte para o QR Code</Text>
                        <TouchableOpacity onPress={() => setScannerVisible(false)}>
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
                        <View style={styles.scannerTarget} />
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
                    <View style={styles.logoutModalContent}>
                        <View style={styles.logoutIconCircle}>
                            <MaterialCommunityIcons name="logout" size={36} color="#FFFFFF" />
                        </View>

                        <Text style={styles.logoutModalTitle}>SAIR DA CONTA</Text>
                        <Text style={styles.logoutModalSubtitle}>
                            Tem certeza que deseja sair? Você precisará entrar novamente com seu e-mail e senha para usar o aplicativo.
                        </Text>

                        <View style={styles.logoutButtonRow}>
                            <TouchableOpacity
                                style={styles.logoutCancelButton}
                                onPress={() => setLogoutModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.logoutCancelText}>CANCELAR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.logoutConfirmButton}
                                onPress={handleConfirmLogout}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.logoutConfirmText}>SIM, SAIR</Text>
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
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
        alignItems: 'center',
    },
    profilePicContainer: {
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 3,
        borderColor: '#0052cc',
        padding: 4,
        marginBottom: 20,
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
        backgroundColor: '#F0F4FA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    greetingText: {
        fontSize: 26,
        color: '#1A1A1A',
        marginBottom: 40,
    },
    greetingName: {
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
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        borderWidth: 1.5,
        borderColor: '#0052cc',
        borderRadius: 30,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    inputText: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        marginLeft: 12,
        marginRight: 12,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 40,
        gap: 16,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#0052cc',
        borderRadius: 20,
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#0052cc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
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
        color: '#999',
        fontSize: 13,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 10,
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#666',
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
        backgroundColor: themes.colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
    },
    closeModalText: {
        color: '#FFFFFF',
        fontSize: 16,
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
        fontSize: 20,
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
        borderColor: '#0052cc',
        backgroundColor: 'transparent',
        borderRadius: 20,
    },
    logoutModalContent: {
        width: '88%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 2,
        borderColor: 'transparent',
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
        fontSize: 20,
        fontWeight: '900',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    logoutModalSubtitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#555',
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
        borderColor: '#DDD',
    },
    logoutCancelText: {
        color: '#555',
        fontSize: 16,
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
        fontSize: 16,
        fontWeight: 'bold',
    },
});