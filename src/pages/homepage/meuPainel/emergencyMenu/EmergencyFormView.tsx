import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../../../../contexts/AccessibilityContext';

// Componente Modal Adaptável Padronizado
import { CustomNotificationModal } from '../../../../components/CustomNotificationModal/CustomNotificationModal';

// Firebase
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../../config/firebaseConfig';
import { themes } from '../../../../global/themes';

interface MedicalRecord {
    nomeCompleto: string;
    dataNascimento: string;
    tipoSanguineo: string;
    alergias: string;
    condicoesMedicas: string;
    medicamentosUso: string;
    contatoEmergencia: string;
    convenioMedico: string;
}

const INITIAL_RECORD: MedicalRecord = {
    nomeCompleto: '',
    dataNascimento: '',
    tipoSanguineo: '',
    alergias: '',
    condicoesMedicas: '',
    medicamentosUso: '',
    contatoEmergencia: '',
    convenioMedico: '',
};

// Função para calcular a idade a partir do formato DD/MM/AAAA
const calculateAge = (birthDateStr: string): number | null => {
    if (!birthDateStr || birthDateStr.length !== 10) return null;

    const parts = birthDateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    const today = new Date();
    const birthDate = new Date(year, month, day);

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= 0 && age < 120 ? age : null;
};

// Formatação da máscara DD/MM/AAAA
const maskDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 2 && cleaned.length <= 4) {
        formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
        formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }

    return formatted;
};

export function EmergencyFormView() {
    const navigation = useNavigation();
    const { fontScale, isHighContrast, theme } = useAccessibility();

    const userId = auth.currentUser?.uid;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<MedicalRecord>(INITIAL_RECORD);

    // Feedback Modal
    const [noticeVisible, setNoticeVisible] = useState(false);
    const [noticeTitle, setNoticeTitle] = useState('');
    const [noticeMessage, setNoticeMessage] = useState('');
    const [noticeIcon, setNoticeIcon] = useState('alert-circle-outline');
    const [noticeColor, setNoticeColor] = useState('#D32F2F');

    const showNotice = (title: string, message: string, icon = 'alert-circle-outline', color = '#D32F2F') => {
        setNoticeTitle(title);
        setNoticeMessage(message);
        setNoticeIcon(icon);
        setNoticeColor(color);
        setNoticeVisible(true);
    };

    // Estilo adaptável dos inputs para o modo contraste/edição
    const getInputStyle = () => {
        if (isHighContrast) {
            return {
                backgroundColor: theme.cardBackground || '#000000',
                borderColor: isEditing ? '#FFFF00' : '#FFFFFF',
                borderWidth: 2,
                color: '#FFFFFF',
            };
        }
        return isEditing ? styles.activeInput : styles.disabledInput;
    };

    const getPlaceholderColor = () => {
        if (isHighContrast) {
            return theme.textSecondary || '#CCCCCC';
        }
        return '#64748B';
    };

    // Buscar Ficha Médica
    useEffect(() => {
        const fetchMedicalRecord = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                const recordRef = doc(db, 'users', userId, 'medicalRecord', 'info');
                const snap = await getDoc(recordRef);

                if (snap.exists()) {
                    const data = snap.data() as MedicalRecord;
                    setFormData(data);
                    setIsEditing(false);
                } else {
                    const userSnap = await getDoc(doc(db, 'users', userId));
                    if (userSnap.exists()) {
                        const uData = userSnap.data();
                        setFormData((prev) => ({
                            ...prev,
                            nomeCompleto: uData.nome || uData.apelido || '',
                        }));
                    }
                    setIsEditing(true);
                }
            } catch (error) {
                console.error('Erro ao buscar ficha médica:', error);
                showNotice('Erro', 'Não foi possível carregar seus dados médicos.');
            } finally {
                setLoading(false);
            }
        };

        fetchMedicalRecord();
    }, [userId]);

    // Salvar no Firestore
    const handleSaveRecord = async () => {
        if (!userId) return;

        if (!formData.nomeCompleto.trim() || !formData.tipoSanguineo.trim()) {
            showNotice('Atenção', 'Nome Completo e Tipo Sanguíneo são campos obrigatórios.');
            return;
        }

        setSaving(true);
        try {
            const recordRef = doc(db, 'users', userId, 'medicalRecord', 'info');
            await setDoc(
                recordRef,
                {
                    ...formData,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsEditing(false);
            showNotice('Sucesso', 'Sua ficha médica foi salva com sucesso!', 'check-circle-outline', '#198754');
        } catch (error) {
            console.error('Erro ao salvar ficha médica:', error);
            showNotice('Erro', 'Falha ao salvar informações. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    // Gerar e Compartilhar Ficha em PDF
    const handleGeneratePDF = async () => {
        if (!formData.nomeCompleto) {
            showNotice('Ficha Vazia', 'Preencha a ficha antes de gerar o PDF.');
            return;
        }

        setGeneratingPdf(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const ageCalculated = calculateAge(formData.dataNascimento);
        const ageText = ageCalculated !== null ? `(${ageCalculated} anos)` : '';

        try {
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Helvetica, Arial, sans-serif; padding: 24px; color: #1A1A1A; }
                        .header { text-align: center; border-bottom: 3px solid #D32F2F; padding-bottom: 12px; margin-bottom: 20px; }
                        .title { color: #D32F2F; font-size: 24px; font-weight: bold; margin: 0; }
                        .subtitle { color: #555; font-size: 14px; margin-top: 4px; }
                        .field { margin-bottom: 16px; background-color: #F8FAFC; padding: 12px; border-radius: 8px; border-left: 4px solid #0052cc; }
                        .field-label { font-size: 12px; font-weight: bold; color: #64748B; text-transform: uppercase; margin-bottom: 4px; }
                        .field-value { font-size: 16px; font-weight: bold; color: #0F172A; }
                        .blood-type { display: inline-block; background-color: #D32F2F; color: white; padding: 6px 16px; border-radius: 20px; font-size: 18px; font-weight: bold; margin-top: 4px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #94A3B8; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 class="title">FICHA DE EMERGÊNCIA MÉDICA</h1>
                        <p class="subtitle">Documento gerado pelo aplicativo Kindred</p>
                    </div>

                    <div class="field">
                        <div class="field-label">Nome Completo</div>
                        <div class="field-value">${formData.nomeCompleto || 'Não informado'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Data de Nascimento / Idade</div>
                        <div class="field-value">${formData.dataNascimento || 'Não informada'} ${ageText}</div>
                    </div>

                    <div class="field" style="border-left-color: #D32F2F;">
                        <div class="field-label">Tipo Sanguíneo</div>
                        <div class="blood-type">${formData.tipoSanguineo || 'Não informado'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Alergias</div>
                        <div class="field-value">${formData.alergias || 'Nenhuma alergia cadastrada'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Condições / Doenças Preexistentes</div>
                        <div class="field-value">${formData.condicoesMedicas || 'Nenhuma condição cadastrada'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Medicamentos em Uso Contínuo</div>
                        <div class="field-value">${formData.medicamentosUso || 'Nenhum medicamento informado'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Contato de Emergência</div>
                        <div class="field-value">${formData.contatoEmergencia || 'Não informado'}</div>
                    </div>

                    <div class="field">
                        <div class="field-label">Plano de Saúde / Convênio</div>
                        <div class="field-value">${formData.convenioMedico || 'Não informado'}</div>
                    </div>

                    <div class="footer">
                        Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });

            const formattedName = formData.nomeCompleto
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_');

            const customFileName = `ficha_medica_${formattedName}.pdf`;
            const customUri = `${FileSystem.documentDirectory}${customFileName}`;

            await FileSystem.moveAsync({
                from: uri,
                to: customUri,
            });

            await Sharing.shareAsync(customUri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: 'Ficha Médica de Emergência',
            });
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            showNotice('Erro', 'Não foi possível gerar a ficha em PDF.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    const userAge = calculateAge(formData.dataNascimento);

    return (
        <SafeAreaView
            style={[styles.screen, isHighContrast && { backgroundColor: theme.background }]}
            edges={['top', 'left', 'right']}
        >
            {/* CABEÇALHO */}
            <View style={[styles.header, isHighContrast && { backgroundColor: theme.cardBackground, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Feather name="arrow-left" size={28} color={isHighContrast ? theme.textPrimary : themes.colors.notBlack} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: 20 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>
                    Ficha Médica
                </Text>
                {!isEditing && (
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsEditing(true);
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="pencil" size={26} color={isHighContrast ? '#FFFF00' : themes.colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={isHighContrast ? '#FFFF00' : theme.buttonPrimary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={[styles.bannerInfo, isHighContrast && { backgroundColor: theme.cardBackground, borderColor: '#FFFF00', borderWidth: 2 }]}>
                        <MaterialCommunityIcons name="file-account-outline" size={32} color={isHighContrast ? '#FFFF00' : '#D32F2F'} />
                        <Text style={[styles.bannerInfoText, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>
                            {isEditing
                                ? 'Preencha suas informações vitais. Socorristas e cuidadores poderão acessar em emergências.'
                                : 'Sua ficha médica está atualizada. Clique no lápis para alterar os dados.'}
                        </Text>
                    </View>

                    {/* CAMPOS DO FORMULÁRIO */}
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>NOME COMPLETO *</Text>
                        <TextInput
                            style={[styles.input, getInputStyle()]}
                            editable={isEditing}
                            value={formData.nomeCompleto}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, nomeCompleto: text }))}
                            placeholder="Digite o nome completo"
                            placeholderTextColor={getPlaceholderColor()}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <View style={styles.labelRow}>
                            <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>
                                DATA DE NASCIMENTO
                            </Text>
                            {userAge !== null && (
                                <Text style={[styles.ageBadgeText, { fontSize: 14 * fontScale }, isHighContrast && { color: '#FFFF00' }]}>
                                    ({userAge} {userAge === 1 ? 'ano' : 'anos'})
                                </Text>
                            )}
                        </View>
                        <TextInput
                            style={[styles.input, getInputStyle()]}
                            editable={isEditing}
                            value={formData.dataNascimento}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, dataNascimento: maskDate(text) }))}
                            placeholder="DD/MM/AAAA"
                            placeholderTextColor={getPlaceholderColor()}
                            keyboardType="numeric"
                            maxLength={10}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>TIPO SANGUÍNEO *</Text>
                        <TextInput
                            style={[styles.input, getInputStyle()]}
                            editable={isEditing}
                            value={formData.tipoSanguineo}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, tipoSanguineo: text.toUpperCase() }))}
                            placeholder="Ex: O+, A-, AB+"
                            placeholderTextColor={getPlaceholderColor()}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>ALERGIAS</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, getInputStyle()]}
                            editable={isEditing}
                            multiline
                            numberOfLines={2}
                            value={formData.alergias}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, alergias: text }))}
                            placeholder="Remédios, alimentos, látex..."
                            placeholderTextColor={getPlaceholderColor()}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>CONDIÇÕES / DOENÇAS PREEXISTENTES</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, getInputStyle()]}
                            editable={isEditing}
                            multiline
                            numberOfLines={2}
                            value={formData.condicoesMedicas}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, condicoesMedicas: text }))}
                            placeholder="Diabetes, hipertensão, marca-passo..."
                            placeholderTextColor={getPlaceholderColor()}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>MEDICAMENTOS EM USO CONTÍNUO</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, getInputStyle()]}
                            editable={isEditing}
                            multiline
                            numberOfLines={2}
                            value={formData.medicamentosUso}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, medicamentosUso: text }))}
                            placeholder="Nome dos remédios e horários..."
                            placeholderTextColor={getPlaceholderColor()}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>CONTATO DE EMERGÊNCIA</Text>
                        <TextInput
                            style={[styles.input, getInputStyle()]}
                            editable={isEditing}
                            value={formData.contatoEmergencia}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, contatoEmergencia: text }))}
                            placeholder="Nome e telefone de um parente"
                            placeholderTextColor={getPlaceholderColor()}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { fontSize: 14 * fontScale }, isHighContrast && { color: theme.textPrimary }]}>PLANO DE SAÚDE / CONVÊNIO</Text>
                        <TextInput
                            style={[styles.input, getInputStyle()]}
                            editable={isEditing}
                            value={formData.convenioMedico}
                            onChangeText={(text) => setFormData((prev) => ({ ...prev, convenioMedico: text }))}
                            placeholder="Nome do plano e nº da carteira"
                            placeholderTextColor={getPlaceholderColor()}
                        />
                    </View>

                    {/* BOTÕES DE AÇÃO */}
                    {isEditing ? (
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                isHighContrast && { backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#FFFFFF' },
                            ]}
                            onPress={handleSaveRecord}
                            disabled={saving}
                            activeOpacity={0.8}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={[styles.saveButtonText, { fontSize: 18 * fontScale }, isHighContrast && { color: '#FFFFFF' }]}>
                                    SALVAR FICHA
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.pdfButton,
                                isHighContrast && { backgroundColor: '#FFFF00', borderWidth: 2, borderColor: '#000000' },
                            ]}
                            onPress={handleGeneratePDF}
                            disabled={generatingPdf}
                            activeOpacity={0.8}
                        >
                            {generatingPdf ? (
                                <ActivityIndicator color={isHighContrast ? '#000000' : '#FFFFFF'} />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="file-pdf-box" size={26} color={isHighContrast ? '#000000' : '#FFFFFF'} />
                                    <Text style={[styles.pdfButtonText, { fontSize: 18 * fontScale }, isHighContrast && { color: '#000000' }]}>
                                        EMITIR FICHA EM PDF
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </ScrollView>
            )}

            {/* MODAL FEEDBACK */}
            <CustomNotificationModal
                visible={noticeVisible}
                title={noticeTitle}
                subtitle={noticeMessage}
                iconName={noticeIcon}
                iconColor={noticeColor}
                closeText="ENTENDIDO"
                onClose={() => setNoticeVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
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
    },
    backButton: {
        position: 'absolute',
        left: 20,
        padding: 4,
    },
    editButton: {
        position: 'absolute',
        right: 20,
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: themes.colors.notBlack || '#1A1A1A',
        textTransform: 'uppercase',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
    },
    bannerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1.5,
        borderColor: '#FECDD3',
        borderRadius: 16,
        padding: 14,
        gap: 12,
        marginBottom: 20,
    },
    bannerInfoText: {
        flex: 1,
        color: '#991B1B',
        fontWeight: '700',
        lineHeight: 18,
    },
    formGroup: {
        marginBottom: 16,
        width: '100%',
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '900',
        color: themes.colors.notBlack || '#0F172A',
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    ageBadgeText: {
        color: themes.colors.primary || '#0052cc',
        fontWeight: '900',
        marginBottom: 6,
    },
    input: {
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: 'bold',
        color: themes.colors.notBlack || '#0F172A',
    },
    activeInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: themes.colors.primary || '#0052cc',
        elevation: 2,
        shadowColor: themes.colors.primary || '#0052cc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    disabledInput: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        color: themes.colors.notBlack || '#1E293B',
    },
    textArea: {
        height: 86,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: '#16A34A',
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pdfButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: themes.colors.darkRed || '#D32F2F',
        borderRadius: 18,
        paddingVertical: 16,
        marginTop: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    pdfButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
});