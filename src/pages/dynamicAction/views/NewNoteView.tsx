import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { themes } from '../../../global/themes';
import { NoteTypeKey, SUBFORM_STRATEGY_REGISTRY, createInitialSubformData, validateSubformData } from './noteSubforms';

interface NewNoteViewProps { onSaveSuccess?: () => void; }
interface NoteTypeConfig { key: NoteTypeKey; label: string; icon: keyof typeof Feather.glyphMap; }

const NOTE_TYPES_CONFIG: NoteTypeConfig[] = [
    { key: 'Glicemia', label: 'Glicemia', icon: 'droplet' },
    { key: 'Pressão', label: 'Pressão', icon: 'heart' },
    { key: 'Oxigenação do sangue', label: 'Oxigenação do Sangue', icon: 'wind' },
    { key: 'Medicação', label: 'Medicação', icon: 'plus-square' },
    { key: 'Temperatura corporal', label: 'Temperatura Corporal', icon: 'thermometer' },
];

export function NewNoteView({ onSaveSuccess }: NewNoteViewProps) {
    const [selectedType, setSelectedType] = useState<NoteTypeKey | ''>('');
    const [subformData, setSubformData] = useState<any>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSelectType = (type: NoteTypeKey) => {
        setSelectedType(type);
        setSubformData(createInitialSubformData(type));
        setErrors({});
    };

    const handleSave = () => {
        if (!selectedType) return;
        const { isValid, errors: validationErrors } = validateSubformData(selectedType, subformData);
        if (!isValid) {
            setErrors(validationErrors);
            return Alert.alert('Atenção', 'Preencha todos os campos obrigatórios em destaque.');
        }
        Alert.alert('Sucesso', 'Dados salvos com sucesso!', [{ text: 'OK', onPress: onSaveSuccess }]);
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
                                    <Feather name={item.icon} size={26} color={themes.colors.orange} />
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

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>SALVAR ANOTAÇÃO</Text>
                    </TouchableOpacity>
                </View>
            )}
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
        borderRadius: 22,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    fieldSection: {
        marginBottom: 18,
    },
    fieldLabel: {
        fontSize: 14,
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
        borderColor: '#E5E7EB',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        minHeight: 64,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    typeCardButtonSelected: {
        backgroundColor: '#FFFBEB',
        borderColor: themes.colors.orange,
        borderWidth: 2.5,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    iconContainerSelected: {
        backgroundColor: themes.colors.orange,
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
        fontSize: 16,
        fontWeight: '600',
        color: themes.colors.orange,
        marginLeft: 8,
    },
    // ---------------------------------------------------
    typeCardText: {
        fontSize: 15,
        fontWeight: '600',
        color: themes.colors.notBlack,
        flex: 1,
    },
    typeCardTextSelected: {
        fontWeight: 'bold',
        color: themes.colors.orange,
    },
    dynamicFormArea: {
        width: '100%',
        minHeight: 120,
        marginBottom: 16,
    },
    emptyPromptBox: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: themes.colors.orange,
        borderStyle: 'dashed',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyPromptText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    actionArea: {
        width: '100%',
        marginTop: 10,
    },
    saveButton: {
        width: '100%',
        backgroundColor: themes.colors.orange,
        borderRadius: 25,
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
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});