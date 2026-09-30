import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

interface ProfileContextData {
    activeUserId: string;
    setActiveUserId: (uid: string) => void;
}

const ProfileContext = createContext<ProfileContextData | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeUserId, setActiveUserIdState] = useState<string>(
        auth.currentUser?.uid || ''
    );

    // Escuta a inicialização/mudança do Firebase Auth para garantir o UID correto
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user?.uid) {
                setActiveUserIdState(user.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    // Otimiza a função de atualização para manter a mesma referência em memória
    const setActiveUserId = useCallback((uid: string) => {
        setActiveUserIdState(uid);
    }, []);

    // Evita re-renders desnecessários nos consumidores do contexto
    const value = useMemo(
        () => ({ activeUserId, setActiveUserId }),
        [activeUserId, setActiveUserId]
    );

    return (
        <ProfileContext.Provider value={value}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => {
    const context = useContext(ProfileContext);
    if (!context) {
        throw new Error('useProfile deve ser utilizado dentro de um ProfileProvider');
    }
    return context;
};