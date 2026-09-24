import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBi0bvUPGRaXp67B8y4YAgJnrrImG9cMO8",
  authDomain: "kindred-bd-690c3.firebaseapp.com",
  projectId: "kindred-bd-690c3",
  storageBucket: "kindred-bd-690c3.firebasestorage.app",
  messagingSenderId: "322996890264",
  appId: "1:322996890264:web:82f4daf7bda4ab5be6beed"
};

// Garante uma única instância do Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inicializa o Auth
export const auth = getAuth(app);

// Inicializa o Firestore com PERSISTÊNCIA OFFLINE HABILITADA
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});