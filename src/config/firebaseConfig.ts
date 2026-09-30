import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore'; 
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { getReactNativePersistence } = require('firebase/auth');

// 1. As suas credenciais do Firebase Console:
const firebaseConfig = {
  apiKey: "AIzaSyBi0bvUPGRaXp67B8y4YAgJnrrImG9cMO8",
  authDomain: "kindred-bd-690c3.firebaseapp.com",
  projectId: "kindred-bd-690c3",
  storageBucket: "kindred-bd-690c3.firebasestorage.app",
  messagingSenderId: "322996890264",
  appId: "1:322996890264:web:82f4daf7bda4ab5be6beed"
};

// 2. Garante uma única instância do Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 3. Inicializa a Autenticação com persistência local (AsyncStorage)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// 4. Inicializa o Firestore com PERSISTÊNCIA OFFLINE (Cache Local)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// 5. Inicializa e exporta o Firebase Storage
export const storage = getStorage(app);