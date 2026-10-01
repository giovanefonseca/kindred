import { useState, useEffect, useRef, useCallback } from 'react';
import { Linking } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const FALL_THRESHOLD = 3.2;
const GYRO_THRESHOLD = 4.0;
const COUNTDOWN_SECONDS = 15;

export function useFallDetector(emergencyContacts: string[] = []) {
    const [modalVisible, setModalVisible] = useState(false);
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

    const soundRef = useRef<Audio.Sound | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isTriggeredRef = useRef(false);
    const emergencyExecutedRef = useRef(false);
    const remainingRef = useRef(COUNTDOWN_SECONDS);

    // Mantém sempre a lista mais recente (evita closure obsoleta dentro do useEffect)
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
        if (soundRef.current) return; // já está tocando
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
        if (emergencyExecutedRef.current) return; // evita execução dupla
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
        Accelerometer.setUpdateInterval(100);
        Gyroscope.setUpdateInterval(100);

        let latestGyroMagnitude = 0;

        const gyroSubscription = Gyroscope.addListener(({ x, y, z }) => {
            latestGyroMagnitude = Math.sqrt(x * x + y * y + z * z);
        });

        const accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
            if (isTriggeredRef.current) return;

            const accelMagnitude = Math.sqrt(x * x + y * y + z * z);

            if (accelMagnitude > FALL_THRESHOLD && latestGyroMagnitude > GYRO_THRESHOLD) {
                isTriggeredRef.current = true;
                handleFallDetected();
            }
        });

        return () => {
            accelSubscription.remove();
            gyroSubscription.remove();
            clearFallTimer();
            stopEmergencySound();
        };
    }, [handleFallDetected, clearFallTimer, stopEmergencySound]);

    const handleFalseAlarm = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        clearFallTimer();
        stopEmergencySound();
        emergencyExecutedRef.current = false;
        setModalVisible(false);
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