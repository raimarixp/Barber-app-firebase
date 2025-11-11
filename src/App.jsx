// src/App.jsx (Com a correção do H2)

import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase-config'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from "firebase/firestore"; 

// Nossos componentes de painel
import AuthChat from './components/AuthChat';
import AdminPanel from './components/AdminPanel'; 
import ClientPanel from './components/ClientPanel'; 
import ProfessionalPanel from './components/ProfessionalPanel';

// CSS do Chat
import './components/AuthChat.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);

  // Vigia (onSnapshot)
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      let firestoreUnsubscribe = null; 

      if (user) {
        setCurrentUser(user);
        const userDocRef = doc(db, "users", user.uid);
        
        firestoreUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const fetchedData = docSnap.data();
            setUserData(fetchedData); 
            console.log("VIGIA (Snapshot): Dados do usuário atualizados. Role:", fetchedData.role);
          } else {
            console.warn("VIGIA (Snapshot): Usuário logado, aguardando dados do Firestore...");
            setUserData(null);
          }
          setIsLoading(false);
        }, (error) => {
          console.error("VIGIA (Snapshot): Erro ao ouvir dados!", error);
          setUserData(null);
          setIsLoading(false);
        });

      } else {
        setCurrentUser(null);
        setUserData(null);
        setIsLoading(false); 
        console.log("VIGIA (AuthState): Ninguém logado.");
      }
      
      return () => {
        if (firestoreUnsubscribe) {
          firestoreUnsubscribe();
        }
      };
    });
    
    return () => authUnsubscribe();
  }, []); 

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert("Você saiu da conta.");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  // Loading
  if (isLoading) {
    return <div style={{ padding: '20px' }}><h1>Carregando...</h1></div>;
  }

  // ---- RENDERIZAÇÃO ----

  // 1. Deslogado
  if (!currentUser) {
    return (
      <div>
        <h1>Projeto Barbearia</h1><hr /><AuthChat />
      </div>
    );
  }

  // 2. Logado, mas dados do Firestore ainda não chegaram
  if (currentUser && !userData) {
    return (
      <div>
        <h1>Projeto Barbearia</h1><hr />
        <h2>Carregando perfil...</h2>
        <p>Logado como: {currentUser.email}</p>
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

        {/* --- A CORREÇÃO ESTÁ AQUI --- */}
        {/* Removemos o <h2> e o <div> desnecessários */}
        
        {userData.role === 'admin' && <AdminPanel />}
        
        {userData.role === 'client' && <ClientPanel />}
        
        {userData.role === 'professional' && <ProfessionalPanel />}
      </div>
    );
  }
}

export default App;