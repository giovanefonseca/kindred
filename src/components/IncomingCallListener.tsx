import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Image,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

// Contexto Global de Acessibilidade
import { useAccessibility } from '../contexts/AccessibilityContext';

// Firebase
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';

interface IncomingCallData {
    callId: string;
    callerId: string;
    callerName: string;
    callerPhoto?: string | null;
}

export function IncomingCallListener() {
    const { fontScale, isHighContrast, theme } = useAccessibility();
    const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

    const userId = auth.currentUser?.uid;
    const player = useAudioPlayer(require('../../assets/notifySound.mp3'));

    useEffect(() => {
        if (!userId) return;

        // Listener em tempo real escutando chamadas 'active' destinadas ao responsável atual
        const q = query(
            collection(db, 'calls'),
            where('receiverId', '==', userId),
            where('status', '==', 'active')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (!snapshot.empty) {
                const callDoc = snapshot.docs[0];
                const callData = callDoc.data();

                // Busca as informações do dependente que ligou
                const callerSnap = await getDoc(doc(db, 'users', callData.callerId));
                let name = 'Dependente';
                let photo: string | null = null;

                if (callerSnap.exists()) {
                    const cData = callerSnap.data();
                    name = cData.apelido || cData.nome || 'Dependente';
                    photo = cData.photoUrl || null;
                }

                setIncomingCall({
                    callId: callDoc.id,
                    callerId: callData.callerId,
                    callerName: name,
                    callerPhoto: photo,
                });

                // Executa feedback háptico e sonoro
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                try {
                    if (player) {
                        player.seekTo(0);
                        player.play();
                    }
                } catch (e) {
                    console.log('Erro ao tocar som de chamada:', e);
                }
            } else {
                setIncomingCall(null);
            }
        });

        return () => unsubscribe();
    }, [userId]);

    const handleAnswerCall = async () => {
        if (!incomingCall) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await updateDoc(doc(db, 'calls', incomingCall.callId), {
                status: 'answered',
            });
        } catch (error) {
            console.error('Erro ao atender chamada:', error);
        } finally {
            setIncomingCall(null);
        }
    };

    const handleRejectCall = async () => {
        if (!incomingCall) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            await updateDoc(doc(db, 'calls', incomingCall.callId), {
                status: 'rejected',
            });
        } catch (error) {
            console.error('Erro ao recusar chamada:', error);
        } finally {
            setIncomingCall(null);
        }
    };

    if (!incomingCall) return null;

    return (
        <Modal visible={true} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={[
                    styles.card,
                    isHighContrast && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 2 }
                ]}>
                    <View style={styles.alertHeader}>
                        <MaterialCommunityIcons name="phone-incoming" size={32} color="#FFFFFF" />
                        <Text style={[styles.alertHeaderText, { fontSize: 16 * fontScale }]}>
                            EMERGÊNCIA
                        </Text>
                    </View>

                    <View style={styles.avatarWrapper}>
                        {incomingCall.callerPhoto ? (
                            <Image source={{ uri: incomingCall.callerPhoto }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.cardBackground }]}>
                                <MaterialCommunityIcons name="account" size={60} color={theme.buttonPrimary} />
                            </View>
                        )}
                    </View>

                    <Text style={[
                        styles.callerName,
                        { fontSize: 22 * fontScale },
                        isHighContrast && { color: theme.textPrimary }
                    ]} numberOfLines={1}>
                        {incomingCall.callerName}
                    </Text>

                    <Text style={[
                        styles.callSubtitle,
                        { fontSize: 16 * fontScale },
                        isHighContrast && { color: theme.textSecondary }
                    ]}>
                        está solicitando uma chamada de emergência!
                    </Text>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={styles.btnReject}
                            onPress={handleRejectCall}
                            activeOpacity={0.8}
                        >
                            <FontAwesome name="phone" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                            <Text style={[styles.btnText, { fontSize: 16 * fontScale }]}>RECUSAR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.btnAnswer}
                            onPress={handleAnswerCall}
                            activeOpacity={0.8}
                        >
                            <FontAwesome name="phone" size={24} color="#FFFFFF" />
                            <Text style={[styles.btnText, { fontSize: 16 * fontScale }]}>ATENDER</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    alertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D9534F',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 8,
        marginBottom: 20,
    },
    alertHeaderText: {
        color: '#FFFFFF',
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    avatarWrapper: {
        width: 100,
        height: 100,
        borderRadius: 50,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: '#D9534F',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    callerName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 6,
    },
    callSubtitle: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 26,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    btnReject: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#D9534F',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    btnAnswer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#198754',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    btnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
});