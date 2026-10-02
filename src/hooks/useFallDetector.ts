import { useState, useEffect, useRef, useCallback } from 'react';
import { Linking } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

// Limiares calibrados para aparelhos avançados e de entrada
const FALL_THRESHOLD = 2.8;
const DELTA_THRESHOLD = 2.0;
const GYRO_THRESHOLD = 3.5;
const COUNTDOWN_SECONDS = 15;
const COOLDOWN_MS = 5000; // 5 segundos de trégua após falso alarme

export function useFallDetector(emergencyContacts: string[] = []) {
    const [modalVisible, setModalVisible] = useState(false);
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

    const soundRef = useRef<Audio.Sound | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isTriggeredRef = useRef(false);
    const emergencyExecutedRef = useRef(false);
    const remainingRef = useRef(COUNTDOWN_SECONDS);
    const lastDismissedTime = useRef<number>(0); // Registra o horário do último "falso alarme"

    // Mantém sempre a lista mais recente
    const contactsRef = useRef<string[]>(emergencyContacts);
    useEffect(() => {
        contactsRef.current = emergencyContacts;
    }, [emergencyContacts]);

    const clearFallTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const playEmergencySound = useCallback(async () => {
        if (soundRef.current) return;
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                shouldDuckAndroid: false,
                staysActiveInBackground: true,
            });

            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/alarm.mp3'),
                { shouldPlay: true, isLooping: true, volume: 1.0 }
            );
            soundRef.current = sound;
        } catch (error) {
            console.error('Erro ao reproduzir áudio de emergência:', error);
        }
    }, []);

    const stopEmergencySound = useCallback(async () => {
        try {
            if (soundRef.current) {
                const sound = soundRef.current;
                soundRef.current = null;
                await sound.stopAsync();
                await sound.unloadAsync();
            }
        } catch (error) {
            console.error('Erro ao parar som de emergência:', error);
        }
    }, []);

    const executeEmergencyProcedure = useCallback(async () => {
        if (emergencyExecutedRef.current) return;
        emergencyExecutedRef.current = true;

        await playEmergencySound();

        const contacts = contactsRef.current;
        if (contacts.length > 0) {
            const phoneNumber = `tel:${contacts[0]}`;
            try {
                await Linking.openURL(phoneNumber);
            } catch (error) {
                console.error('Erro ao iniciar ligação de emergência:', error);
            }
        }
    }, [playEmergencySound]);

    const handleFallDetected = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        emergencyExecutedRef.current = false;
        remainingRef.current = COUNTDOWN_SECONDS;
        setCountdown(COUNTDOWN_SECONDS);
        setModalVisible(true);

        clearFallTimer();
        timerRef.current = setInterval(() => {
            remainingRef.current -= 1;
            setCountdown(Math.max(remainingRef.current, 0));

            if (remainingRef.current <= 0) {
                clearFallTimer();
                executeEmergencyProcedure();
            }
        }, 1000);
    }, [clearFallTimer, executeEmergencyProcedure]);

    useEffect(() => {
        // Intervalo de 200ms
        Accelerometer.setUpdateInterval(200);
        Gyroscope.setUpdateInterval(200);

        let latestGyroMagnitude = 0;
        let hasGyroHardware = false;
        let previousAccelMagnitude = 1.0;

        let gyroSubscription: any = null;
        try {
            gyroSubscription = Gyroscope.addListener(({ x, y, z }) => {
                hasGyroHardware = true;
                latestGyroMagnitude = Math.sqrt(x * x + y * y + z * z);
            });
        } catch (e) {
            hasGyroHardware = false;
        }

        const accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
            // Ignora se o alarme já foi disparado OU se ainda estiver no tempo de Cooldown (trégua)
            const now = Date.now();
            if (isTriggeredRef.current || (now - lastDismissedTime.current < COOLDOWN_MS)) {
                previousAccelMagnitude = Math.sqrt(x * x + y * y + z * z);
                return;
            }

            const accelMagnitude = Math.sqrt(x * x + y * y + z * z);
            const delta = Math.abs(accelMagnitude - previousAccelMagnitude);

            const isGyroFall = hasGyroHardware && (accelMagnitude > FALL_THRESHOLD) && (latestGyroMagnitude > GYRO_THRESHOLD);
            const isAccelOnlyFall = !hasGyroHardware && (accelMagnitude > FALL_THRESHOLD || delta > DELTA_THRESHOLD);

            if (isGyroFall || isAccelOnlyFall) {
                isTriggeredRef.current = true;
                handleFallDetected();
            }

            previousAccelMagnitude = accelMagnitude;
        });

        return () => {
            accelSubscription && accelSubscription.remove();
            gyroSubscription && gyroSubscription.remove();
            clearFallTimer();
            stopEmergencySound();
        };
    }, [handleFallDetected, clearFallTimer, stopEmergencySound]);

    const handleFalseAlarm = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Registrar timestamp do encerramento para ativar o cooldown de 5s
        lastDismissedTime.current = Date.now();

        clearFallTimer();
        stopEmergencySound();

        emergencyExecutedRef.current = false;
        setModalVisible(false);

        // Libera o gatilho novamente
        isTriggeredRef.current = false;
    }, [clearFallTimer, stopEmergencySound]);

    const handleConfirmEmergency = useCallback(() => {
        clearFallTimer();
        executeEmergencyProcedure();
    }, [clearFallTimer, executeEmergencyProcedure]);

    return {
        modalVisible,
        countdown,
        handleFalseAlarm,
        handleConfirmEmergency,
    };
}