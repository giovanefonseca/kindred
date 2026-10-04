import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, UIManager, LayoutAnimation } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type FontSizeOption = 'normal' | 'large' | 'xlarge';

export interface ThemeColors {
    background: string;
    cardBackground: string;
    textPrimary: string;
    textSecondary: string;
    buttonPrimary: string;
    buttonText: string;
    border: string;
}

const defaultTheme: ThemeColors = {
    background: '#FFFFFF',
    cardBackground: '#F5F7FA',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    buttonPrimary: '#0052cc',
    buttonText: '#FFFFFF',
    border: '#CBD5E1',
};

const highContrastTheme: ThemeColors = {
    background: '#000000',
    cardBackground: '#121212',
    textPrimary: '#FFFFFF',
    textSecondary: '#FFFF00',
    buttonPrimary: '#FFFF00',
    buttonText: '#000000',
    border: '#FFFFFF',
};

interface AccessibilityContextData {
    fontSizeMode: FontSizeOption;
    fontScale: number;
    animatedFontScale: Animated.Value; // Valor animado do fator de escala
    isHighContrast: boolean;
    theme: ThemeColors;
    isLoadingSettings: boolean;
    changeFontSize: (mode: FontSizeOption) => Promise<void>;
    toggleHighContrast: () => Promise<void>;
}

const FONT_STORAGE_KEY = '@kindred_font_size';
const CONTRAST_STORAGE_KEY = '@kindred_high_contrast';

const AccessibilityContext = createContext<AccessibilityContextData>({} as AccessibilityContextData);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [fontSizeMode, setFontSizeMode] = useState<FontSizeOption>('normal');
    const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);

    const targetFontScale = fontSizeMode === 'xlarge' ? 1.3 : fontSizeMode === 'large' ? 1.15 : 1.0;
    
    // Animated Value para interpolar continuamente o fator de fonte
    const animatedFontScale = useRef(new Animated.Value(targetFontScale)).current;

    useEffect(() => {
        const loadSavedSettings = async () => {
            try {
                const savedFont = await AsyncStorage.getItem(FONT_STORAGE_KEY);
                const savedContrast = await AsyncStorage.getItem(CONTRAST_STORAGE_KEY);

                if (savedFont) {
                    const fontMode = savedFont as FontSizeOption;
                    setFontSizeMode(fontMode);
                    const initialScale = fontMode === 'xlarge' ? 1.3 : fontMode === 'large' ? 1.15 : 1.0;
                    animatedFontScale.setValue(initialScale);
                }
                if (savedContrast) setIsHighContrast(JSON.parse(savedContrast));
            } catch (error) {
                console.error("Erro ao carregar preferências de acessibilidade:", error);
            } finally {
                setIsLoadingSettings(false);
            }
        };

        loadSavedSettings();
    }, []);

    const changeFontSize = async (mode: FontSizeOption) => {
        if (mode === fontSizeMode) return;

        const newScale = mode === 'xlarge' ? 1.3 : mode === 'large' ? 1.15 : 1.0;

        // Dispara o LayoutAnimation para reorganizar a estrutura e o Animated.timing para fluidez
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        Animated.timing(animatedFontScale, {
            toValue: newScale,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false, // Necessário false para animar propriedades de layout e textos
        }).start();

        setFontSizeMode(mode);
        await AsyncStorage.setItem(FONT_STORAGE_KEY, mode);
    };

    const toggleHighContrast = async () => {
        const newValue = !isHighContrast;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsHighContrast(newValue);
        await AsyncStorage.setItem(CONTRAST_STORAGE_KEY, JSON.stringify(newValue));
    };

    const theme = isHighContrast ? highContrastTheme : defaultTheme;

    const contextValue = useMemo(() => ({
        fontSizeMode,
        fontScale: targetFontScale,
        animatedFontScale,
        isHighContrast,
        theme,
        isLoadingSettings,
        changeFontSize,
        toggleHighContrast,
    }), [fontSizeMode, targetFontScale, isHighContrast, theme, isLoadingSettings]);

    return (
        <AccessibilityContext.Provider value={contextValue}>
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = () => useContext(AccessibilityContext);