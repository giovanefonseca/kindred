import React, { createContext, useContext, useState } from 'react';
import { auth } from '../config/firebaseConfig';

interface ProfileContextData {
    activeUserId: string;
    setActiveUserId: (uid: string) => void;
}

const ProfileContext = createContext<ProfileContextData>({} as ProfileContextData);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeUserId, setActiveUserId] = useState<string>(auth.currentUser?.uid || '');

    return (
        <ProfileContext.Provider value={{ activeUserId, setActiveUserId }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => useContext(ProfileContext);