import React from 'react';
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
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotesMenu() {
    const navigation = useNavigation<NavigationProp<any>>();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            {/* Cabeçalho simples com botão de voltar */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={28} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.title}>Anotações</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.subtitle}>O que você deseja fazer?</Text>

                <View style={styles.menuGrid}>
                    
                    {/* Botão 1: Ver Anotações */}
                    <TouchableOpacity 
                        style={[styles.actionCard, { backgroundColor: '#0052cc' }]} 
                        onPress={() => navigation.navigate('ViewNotes')}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="format-list-bulleted" size={56} color="#FFF" />
                        <Text style={styles.actionText}>VER ANOTAÇÕES</Text>
                    </TouchableOpacity>

                    {/* Botão 2: Nova Anotação */}
                    <TouchableOpacity 
                        style={[styles.actionCard, { backgroundColor: '#ff9500' }]} 
                        onPress={() => navigation.navigate('DynamicAction', { slug: 'nova-anotacao' })}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="plus-box-outline" size={56} color="#FFF" />
                        <Text style={styles.actionText}>NOVA ANOTAÇÃO</Text>
                    </TouchableOpacity>

                    {/* Botão 3: Emitir Relatório (Substituiu Buscar Anotação) */}
                    <TouchableOpacity 
                        style={[styles.actionCard, { backgroundColor: '#5bc0de' }]} 
                        onPress={() => navigation.navigate('GenerateReport')} // Direciona para a tela de relatórios
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="file-document-outline" size={56} color="#FFF" />
                        <Text style={styles.actionText}>EMITIR RELATÓRIO</Text>
                    </TouchableOpacity>

                    {/* Botão 4: Excluir Anotações */}
                    <TouchableOpacity 
                        style={[styles.actionCard, { backgroundColor: '#d9534f' }]} 
                        onPress={() => navigation.navigate('DeleteNotes')}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="trash-can-outline" size={56} color="#FFF" />
                        <Text style={styles.actionText}>EXCLUIR ANOTAÇÕES</Text>
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
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 40,
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
        borderRadius: 50,
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
        fontSize: 22,
        marginTop: 10,
        textAlign: 'center',
        letterSpacing: 0.5,
    }
});