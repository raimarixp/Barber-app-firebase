// Importa as funções que precisamos do SDK do Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Nossa configuração do Firebase, lendo as variáveis do arquivo .env
// import.meta.env é como o Vite nos dá acesso a essas variáveis
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Adicionando a linha que faltava para seu measurementId
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializa o Firebase com nossas configurações
const app = initializeApp(firebaseConfig);

// Exporta os serviços do Firebase que vamos usar em outras partes do app
export const auth = getAuth(app);
export const db = getFirestore(app);

// (Mais tarde, quando formos fazer upload de imagens, adicionaremos o Storage aqui)
// export const storage = getStorage(app);