import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { style } from './styles';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotesMenu() {
    const navigation = useNavigation<NavigationProp<any>>();

    return (
        <SafeAreaView style={style.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            {/* Cabeçalho simples com botão de voltar */}
            <View style={style.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={style.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={style.title}>Anotações</Text>
            </View>

            <ScrollView contentContainerStyle={style.scrollContent} showsVerticalScrollIndicator={false}>
                
                <Text style={style.subtitle}>O que você deseja fazer?</Text>

                <View style={style.menuGrid}>
                    
                    {/* Botão 1: Ver Anotações (Atualizado) */}
                    <TouchableOpacity 
                        style={[style.actionCard, { backgroundColor: '#0052cc' }]} 
                        onPress={() => navigation.navigate('ViewNotes')} // <-- Direciona para a nova tela
                    >
                        <MaterialCommunityIcons name="format-list-bulleted" size={60} color="#FFF" />
                        <Text style={style.actionText}>VER ANOTAÇÕES</Text>
                    </TouchableOpacity>

                    {/* Botão 2: Nova Anotação (Mantido) */}
                    <TouchableOpacity 
                        style={[style.actionCard, { backgroundColor: '#f0ad4e' }]} 
                        onPress={() => navigation.navigate('DynamicAction', { slug: 'nova-anotacao' })}
                    >
                        <MaterialCommunityIcons name="plus-box-outline" size={60} color="#FFF" />
                        <Text style={style.actionText}>NOVA ANOTAÇÃO</Text>
                    </TouchableOpacity>

                    {/* Botão 3: Buscar Anotação (Direciona para a mesma tela, pois já tem filtros) */}
                    <TouchableOpacity 
                        style={[style.actionCard, { backgroundColor: '#5bc0de' }]} 
                        onPress={() => navigation.navigate('ViewNotes')}
                    >
                        <MaterialCommunityIcons name="magnify" size={60} color="#FFF" />
                        <Text style={style.actionText}>BUSCAR ANOTAÇÃO</Text>
                    </TouchableOpacity>

                    {/* Botão 4: Excluir Anotações */}
                    <TouchableOpacity 
                        style={[style.actionCard, { backgroundColor: '#d9534f' }]} 
                        onPress={() => navigation.navigate('DeleteNotes')} // <-- Conectado aqui!
                    >
                        <MaterialCommunityIcons name="trash-can-outline" size={60} color="#FFF" />
                        <Text style={style.actionText}>EXCLUIR ANOTAÇÕES</Text>
                    </TouchableOpacity>

                </View>

            </ScrollView>
        </SafeAreaView>
    );
}