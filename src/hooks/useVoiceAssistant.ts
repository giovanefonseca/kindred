import { useState, useEffect, useCallback } from 'react';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import { processVoiceQueryWithGemini } from '../services/ai/geminiService';
import { Alert } from 'react-native';

export function useVoiceAssistant() {
    const [isListening, setIsListening] = useState<boolean>(false);
    const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<string>('');
    const [aiResponse, setAiResponse] = useState<string>('');

    useEffect(() => {
        Voice.onSpeechStart = () => setIsListening(true);
        Voice.onSpeechEnd = () => setIsListening(false);
        
        Voice.onSpeechResults = async (e: SpeechResultsEvent) => {
            const spokenText = e.value?.[0] || '';
            setTranscript(spokenText);
            
            if (spokenText.trim().length > 0) {
                await sendToGemini(spokenText);
            }
        };

        Voice.onSpeechError = (e: SpeechErrorEvent) => {
            setIsListening(false);
            if (e.error?.message !== '7/No match') { // Ignora erro comum de silêncio
                Alert.alert('Erro no Microfone', 'Não consegui entender. Pode repetir?');
            }
        };

        return () => {
            Voice.destroy().then(Voice.removeAllListeners);
        };
    }, []);

    const sendToGemini = async (text: string) => {
        setIsProcessingAI(true);
        try {
            const response = await processVoiceQueryWithGemini(text);
            setAiResponse(response);
            // Aqui você pode disparar um Text-To-Speech (expo-speech) ou abrir um Modal
            Alert.alert('Assistente', response);
        } catch (error) {
            Alert.alert('Erro', 'O assistente está indisponível no momento.');
        } finally {
            setIsProcessingAI(false);
        }
    };

    const toggleListening = useCallback(async () => {
        try {
            if (isListening) {
                await Voice.stop();
            } else {
                setTranscript('');
                setAiResponse('');
                await Voice.start('pt-BR'); // Configurado para Português do Brasil
            }
        } catch (e) {
            console.error('[useVoiceAssistant] Falha ao alternar microfone', e);
        }
    }, [isListening]);

    return {
        isListening,
        isProcessingAI,
        transcript,
        aiResponse,
        toggleListening,
    };
}