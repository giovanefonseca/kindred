import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { themes } from '../../../../global/themes';

// Importando o contexto de acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Firebase Auth e Firestore para validar o perfil do dependente/responsável
import { auth, db } from '../../../../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

type NotesMenuRouteParams = {
    NotesMenu: {
        targetUserId?: string;
    };
};

export default function NotesMenu() {
    const navigation = useNavigation<NavigationProp<any>>();
    const route = useRoute<RouteProp<NotesMenuRouteParams, 'NotesMenu'>>();

    // Extraindo dados de acessibilidade do Contexto
    const { fontScale, isHighContrast, theme } = useAccessibility();

    // Recupera o ID repassado pela rota ou o UID logado
    const selectedUserId = route.params?.targetUserId || auth.currentUser?.uid || '';
    
    const [targetUserName, setTargetUserName] = useState<string>('');
    const [isResponsavel, setIsResponsavel] = useState<boolean>(false);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const checkUserAndTarget = async () => {
                const currentUid = auth.currentUser?.uid;
                if (!currentUid) return;

                try {
                    // 1. Verifica se o usuário atual é responsável (possui dependentes cadastrados)
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUid));
                    if (currentUserDoc.exists() && isMounted) {
                        const currentUserData = currentUserDoc.data();
                        const hasDependents = Array.isArray(currentUserData.dependentes) && currentUserData.dependentes.length > 0;
                        setIsResponsavel(hasDependents);
                    }

                    // 2. Identifica o nome do perfil que foi selecionado na List
                    if (selectedUserId) {
                        if (selectedUserId === currentUid) {
                            if (isMounted) setTargetUserName('Meu Perfil (Responsável)');
                        } else {
                            const targetUserDoc = await getDoc(doc(db, 'users', selectedUserId));
                            if (targetUserDoc.exists() && isMounted) {
                                const data = targetUserDoc.data();
                                setTargetUserName(data.apelido || data.nome || 'Dependente');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao verificar permissões e nome do perfil no NotesMenu:', error);
                }
            };

            checkUserAndTarget();

            return () => {
                isMounted = false;
            };
        }, [selectedUserId])
    );

    // Função auxiliar para navegar repassando o ID do usuário alvo
    const handleNavigate = (screenName: string) => {
        navigation.navigate(screenName, { targetUserId: selectedUserId });
    };

    return (
        <SafeAreaView style={[
            styles.container,
            isHighContrast && { backgroundColor: theme.background }
        ]}>
            <StatusBar 
                barStyle={isHighContrast ? "light-content" : "dark-content"} 
                backgroundColor={isHighContrast ? theme.background : "#FFFFFF"} 
            />

            {/* Cabeçalho padronizado */}
            <View style={[
                styles.header,
                isHighContrast && { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }
            ]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : "#1A1A1A"} />
                </TouchableOpacity>
                <Text style={[
                    styles.title,
                    { fontSize: 20 * fontScale },
                    isHighContrast && { color: theme.textPrimary }
                ]}>Anotações</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Indicador visual de qual perfil está sendo manipulado (Exibido apenas se for responsável) */}
                {isResponsavel && targetUserName ? (
                    <View style={[
                        styles.profileBadge,
                        isHighContrast && { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: 1 }
                    ]}>
                        <MaterialCommunityIcons 
                            name="account" 
                            size={20} 
                            color={isHighContrast ? theme.textPrimary : themes.colors.primary} 
                        />
                        <Text style={[
                            styles.profileBadgeText,
                            { fontSize: 14 * fontScale },
                            isHighContrast && { color: theme.textPrimary }
                        ]}>
                            Perfil selecionado: <Text style={{ fontWeight: '900' }}>{targetUserName}</Text>
                        </Text>
                    </View>
                ) : null}

                <Text style={[
                    styles.subtitle,
                    { fontSize: 18 * fontScale },
                    isHighContrast && { color: theme.textSecondary }
                ]}>O que você deseja fazer?</Text>

                <View style={styles.menuGrid}>
                    
                    {/* Botão 1: Ver Anotações */}
                    <TouchableOpacity 
                        style={[
                            styles.actionCard, 
                            { backgroundColor: '#0052cc' },
                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                        ]} 
                        onPress={() => handleNavigate('ViewNotes')}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons 
                            name="format-list-bulleted" 
                            size={56} 
                            color={isHighContrast ? theme.buttonText : "#FFF"} 
                        />
                        <Text style={[
                            styles.actionText,
                            { fontSize: 20 * fontScale },
                            isHighContrast && { color: theme.buttonText }
                        ]}>VER ANOTAÇÕES</Text>
                    </TouchableOpacity>

                    {/* Botão 2: Nova Anotação */}
                    <TouchableOpacity 
                        style={[
                            styles.actionCard, 
                            { backgroundColor: '#ff9500' },
                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                        ]} 
                        onPress={() => handleNavigate('NewNoteView')}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons 
                            name="plus-box-outline" 
                            size={56} 
                            color={isHighContrast ? theme.buttonText : "#FFF"} 
                        />
                        <Text style={[
                            styles.actionText,
                            { fontSize: 20 * fontScale },
                            isHighContrast && { color: theme.buttonText }
                        ]}>NOVA ANOTAÇÃO</Text>
                    </TouchableOpacity>

                    {/* Botão 3: Emitir Relatório */}
                    <TouchableOpacity 
                        style={[
                            styles.actionCard, 
                            { backgroundColor: '#5bc0de' },
                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                        ]} 
                        onPress={() => handleNavigate('GenerateNotesReports')}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons 
                            name="file-document-outline" 
                            size={56} 
                            color={isHighContrast ? theme.buttonText : "#FFF"} 
                        />
                        <Text style={[
                            styles.actionText,
                            { fontSize: 20 * fontScale },
                            isHighContrast && { color: theme.buttonText }
                        ]}>EMITIR RELATÓRIO</Text>
                    </TouchableOpacity>

                    {/* Botão 4: Excluir Anotações */}
                    <TouchableOpacity 
                        style={[
                            styles.actionCard, 
                            { backgroundColor: '#d9534f' },
                            isHighContrast && { backgroundColor: theme.buttonPrimary }
                        ]} 
                        onPress={() => handleNavigate('DeleteNotes')}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons 
                            name="trash-can-outline" 
                            size={56} 
                            color={isHighContrast ? theme.buttonText : "#FFF"} 
                        />
                        <Text style={[
                            styles.actionText,
                            { fontSize: 20 * fontScale },
                            isHighContrast && { color: theme.buttonText }
                        ]}>EXCLUIR ANOTAÇÕES</Text>
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2; 

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF3FF',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 10,
        gap: 6,
    },
    profileBadgeText: {
        color: '#333333',
        fontWeight: '500',
    },
    subtitle: {
        fontSize: 18,
        color: '#666',
        marginBottom: 20,
        marginTop: 5,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    actionCard: {
        width: cardWidth,
        height: cardWidth,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    actionText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 20,
        marginTop: 10,
        textAlign: 'center',
        letterSpacing: 0.5,
    }
});