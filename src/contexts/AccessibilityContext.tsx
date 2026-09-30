import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    textSecondary: '#FFFF00', // Amarelo puro (alta visibilidade para catarata e baixa visão)
    buttonPrimary: '#FFFF00', // Amarelo
    buttonText: '#000000',    // Texto preto no fundo amarelo
    border: '#FFFFFF',
};

interface AccessibilityContextData {
    fontSizeMode: FontSizeOption;
    fontScale: number;
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

    useEffect(() => {
        const loadSavedSettings = async () => {
            try {
                const savedFont = await AsyncStorage.getItem(FONT_STORAGE_KEY);
                const savedContrast = await AsyncStorage.getItem(CONTRAST_STORAGE_KEY);

                if (savedFont) setFontSizeMode(savedFont as FontSizeOption);
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
        setFontSizeMode(mode);
        await AsyncStorage.setItem(FONT_STORAGE_KEY, mode);
    };

    const toggleHighContrast = async () => {
        const newValue = !isHighContrast;
        setIsHighContrast(newValue);
        await AsyncStorage.setItem(CONTRAST_STORAGE_KEY, JSON.stringify(newValue));
    };

    const fontScale = fontSizeMode === 'xlarge' ? 1.3 : fontSizeMode === 'large' ? 1.15 : 1.0;
    const theme = isHighContrast ? highContrastTheme : defaultTheme;

    // Memoriaza o valor para otimizar re-renders
    const contextValue = useMemo(() => ({
        fontSizeMode,
        fontScale,
        isHighContrast,
        theme,
        isLoadingSettings,
        changeFontSize,
        toggleHighContrast,
    }), [fontSizeMode, fontScale, isHighContrast, theme, isLoadingSettings]);

    return (
        <AccessibilityContext.Provider value={contextValue}>
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = () => useContext(AccessibilityContext);