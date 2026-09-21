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

// Firebase
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig'; // Ajuste o caminho se necessário

interface UserData {
    nome: string;
    apelido: string;
    email: string;
    photoUrl: string | null;
}

export default function User() {
    const [userData, setUserData] = useState<UserData>({
        nome: 'Carregando...',
        apelido: 'Carregando...',
        email: 'carregando...',
        photoUrl: null
    });
    const [loading, setLoading] = useState(true);
    const [qrModalVisible, setQrModalVisible] = useState(false);

    const userId = auth.currentUser?.uid;

    // 1. Busca os dados do usuário no Firestore
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
            
            // Atualiza a interface instantaneamente
            setUserData(prev => ({ ...prev, photoUrl: newPhotoUri }));

            // Nota: Para produção ideal, você deve enviar essa URI para o Firebase Storage
            // e depois salvar a URL pública no Firestore. Aqui estamos salvando a URI local 
            // no documento do usuário como demonstração.
            try {
                await updateDoc(doc(db, 'users', userId), { photoUrl: newPhotoUri });
            } catch (error) {
                console.log("Erro ao salvar foto:", error);
            }
        }
    };

    const handleEditField = (field: string) => {
        Alert.alert('Editar', `A edição do campo ${field} será implementada em breve.`);
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
                
                {/* FOTO DE PERFIL COM BORDA AZUL */}
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

                {/* SAUDAÇÃO COM NOME EM NEGRITO */}
                <Text style={styles.greetingText}>
                    Olá, <Text style={styles.greetingName}>{userData.apelido}!</Text>
                </Text>

                {/* CAMPOS DO USUÁRIO */}
                <View style={styles.fieldsContainer}>
                    
                    {/* Campo: Apelido */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>APELIDO</Text>
                        <TouchableOpacity style={styles.inputContainer} onPress={() => handleEditField('Apelido')}>
                            <MaterialCommunityIcons name="card-account-details" size={28} color="#0052cc" />
                            <Text style={styles.inputText} numberOfLines={1}>{userData.apelido}</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color="#7BA4DB" />
                        </TouchableOpacity>
                    </View>

                    {/* Campo: Senha */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>SENHA</Text>
                        <TouchableOpacity style={styles.inputContainer} onPress={() => handleEditField('Senha')}>
                            <MaterialCommunityIcons name="lock" size={28} color="#0052cc" />
                            <Text style={styles.inputText}>********</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color="#7BA4DB" />
                        </TouchableOpacity>
                    </View>

                    {/* Campo: E-mail */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>E-MAIL</Text>
                        <TouchableOpacity style={styles.inputContainer} onPress={() => handleEditField('E-mail')}>
                            <MaterialCommunityIcons name="email" size={28} color="#0052cc" />
                            <Text style={styles.inputText} numberOfLines={1}>{userData.email}</Text>
                            <MaterialCommunityIcons name="pencil" size={24} color="#7BA4DB" />
                        </TouchableOpacity>
                    </View>

                </View>

                {/* BOTÃO QR CODE */}
                <View style={styles.qrButtonContainer}>
                    <TouchableOpacity 
                        style={styles.qrButton} 
                        onPress={() => setQrModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="qrcode" size={50} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* MODAL DO QR CODE (Para o Cuidador escanear) */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={qrModalVisible}
                onRequestClose={() => setQrModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Seu Código de Acesso</Text>
                        <Text style={styles.modalSubtitle}>Mostre este código para o seu responsável ou cuidador para vincular as contas.</Text>
                        
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
        borderColor: '#0052cc', // Borda azul do Figma
        padding: 4, // Espaço entre a imagem e a borda
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
        backgroundColor: '#F5F7FA', // Fundo cinza claro
        borderWidth: 1.5,
        borderColor: '#0052cc', // Borda azul
        borderRadius: 30, // Formato de pílula
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
    qrButtonContainer: {
        marginTop: 50,
        alignItems: 'center',
    },
    qrButton: {
        width: 90,
        height: 90,
        backgroundColor: '#0052cc',
        borderRadius: 45,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#0052cc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    // Estilos do Modal
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
        backgroundColor: '#0052cc',
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
    }
});