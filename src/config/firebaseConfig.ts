import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBi0bvUPGRaXp67B8y4YAgJnrrImG9cMO8",
  authDomain: "kindred-bd-690c3.firebaseapp.com",
  projectId: "kindred-bd-690c3",
  storageBucket: "kindred-bd-690c3.firebasestorage.app",
  messagingSenderId: "322996890264",
  appId: "1:322996890264:web:82f4daf7bda4ab5be6beed"
};

// Inicializa o Firebase no aplicativo
const app = initializeApp(firebaseConfig);

// Inicializa e exporta a instância do banco de dados (Firestore)
export const db = getFirestore(app);

// 2. Inicializa e exporta a instância de Autenticação (Auth)
export const auth = getAuth(app);