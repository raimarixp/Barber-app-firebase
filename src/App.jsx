// src/App.jsx (Solução Definitiva com onSnapshot)

import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase-config'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
// 1. Importe 'onSnapshot' em vez de 'getDoc'
import { doc, onSnapshot } from "firebase/firestore"; 

// Componentes 
import AuthChat from './components/AuthChat';
import AdminPanel from './components/AdminPanel';
import ClientPanel from './components/ClientPanel';
import ProfessionalPanel from './components/ProfessionalPanel';


function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);

  // Vigia (AGORA COM 'onSnapshot' PARA SER EM TEMPO REAL)
  useEffect(() => {
    // 2. 'onAuthStateChanged' continua sendo o gatilho principal
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      let firestoreUnsubscribe = null; // Crie um 'unsubscribe' para o Firestore

      if (user) {
        // Usuário está logado (Auth)
        setCurrentUser(user);
        
        // 3. AGORA, 'onSnapshot' fica "ouvindo" o documento do usuário
        const userDocRef = doc(db, "users", user.uid);
        
        // 'onSnapshot' dispara imediatamente E sempre que o doc mudar
        firestoreUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            // O documento existe (ou foi CRIADO AGORA)
            const fetchedData = docSnap.data();
            setUserData(fetchedData); 
            console.log("VIGIA (Snapshot): Dados do usuário atualizados. Role:", fetchedData.role);
          } else {
            // O usuário está logado, mas o doc não existe AINDA
            // (Isso acontece por 1 segundo durante o cadastro)
            console.warn("VIGIA (Snapshot): Usuário logado, aguardando dados do Firestore...");
            setUserData(null); // Garante que userData é null
          }
          setIsLoading(false); // Só pare de carregar após o snapshot
        }, (error) => {
          // Em caso de erro (Ad-Blocker, etc.)
          console.error("VIGIA (Snapshot): Erro ao ouvir dados!", error);
          setUserData(null);
          setIsLoading(false);
        });

      } else {
        // Usuário está deslogado
        setCurrentUser(null);
        setUserData(null);
        setIsLoading(false); // Pare de carregar
        console.log("VIGIA (AuthState): Ninguém logado.");
      }
      
      // 4. Retorne a limpeza do 'firestoreUnsubscribe'
      // Isso impede "vazamento de memória"
      return () => {
        if (firestoreUnsubscribe) {
          firestoreUnsubscribe();
        }
      };
    });
    
    // Retorne a limpeza do 'authUnsubscribe'
    return () => authUnsubscribe();
  }, []); // O '[]' vazio ainda é crucial

  // Logout (sem mudanças)
  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert("Você saiu da conta.");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  // Loading (sem mudanças)
  if (isLoading) {
    return <div style={{ padding: '20px' }}><h1>Carregando...</h1></div>;
  }

  // ---- RENDERIZAÇÃO CONDICIONAL (AGORA MAIS ROBUSTA) ----

  // 1. Deslogado
  if (!currentUser) {
    return (
      <div>
        <h1>Projeto Barbearia</h1><hr /><AuthChat />
      </div>
    );
  }

  // 2. Logado, mas dados do Firestore ainda não chegaram (ou falharam)
  if (currentUser && !userData) {
    return (
      <div>
        <h1>Projeto Barbearia</h1><hr />
        <h2>Carregando perfil...</h2>
        <p>Logado como: {currentUser.email}</p>
        <p>(Se esta tela demorar, verifique se seu Ad-Blocker está desativado e tente novamente).</p>
        <button onClick={handleLogout}>Sair (Logout)</button>
      </div>
    );
  }

  // 3. Logado e dados do Firestore OK
  if (currentUser && userData) {
    return (
      <div>
        <h1>Projeto Barbearia</h1>
        <div style={{ padding: '10px', background: '#eee' }}>
          <p>Logado como: {currentUser.email} (Role: {userData.role})</p>
          <button onClick={handleLogout}>Sair (Logout)</button>
        </div>
        <hr />
        {userData.role === 'admin' && <div><h2><AdminPanel /></h2></div>}
        {userData.role === 'client' && <div><h2><ClientPanel /></h2></div>}
        {userData.role === 'professional' && <div><h2><ProfessionalPanel /></h2></div>}
      </div>
    );
  }
}

export default App;