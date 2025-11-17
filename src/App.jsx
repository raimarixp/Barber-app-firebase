
// src/App.jsx

import React, { useState, useEffect, createContext, useContext } from 'react';
// 1. O App.jsx está em 'src/', então este caminho está correto:
import { auth, db } from './firebase/firebase-config'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from "firebase/firestore"; 

// --- 2. CAMINHOS ATUALIZADOS ---
// Agora eles apontam para o arquivo .jsx dentro da pasta
import AuthChat from './components/AuthChat/AuthChat.jsx';
import ShopRegistration from './components/ShopRegistration/ShopRegistration.jsx';
import AdminPanel from './components/AdminPanel/AdminPanel.jsx'; 
import ClientPanel from './components/ClientPanel/ClientPanel.jsx'; 
import ProfessionalPanel from './components/ProfessionalPanel/ProfessionalPanel.jsx';
// ----------------------------

// O resto do App.jsx (Context, function App(), etc.) não muda.
// ----------------------------

// --- 1. O "React Context" (Nossa Mochila Global) ---
const ShopContext = createContext();
export const useShop = () => useContext(ShopContext);
// --- Fim do Context ---


function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [authFlow, setAuthFlow] = useState('selector');
  const [viewingShopId, setViewingShopId] = useState(null);
  
  // Vigia (onSnapshot - Sem mudanças)
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      let firestoreUnsubscribe = null; 
      if (user) {
        setCurrentUser(user);
        
        // (MUDANÇA AQUI) O Vigia agora escuta a coleção 'roles'
        const roleDocRef = doc(db, "roles", user.uid);
        
        firestoreUnsubscribe = onSnapshot(roleDocRef, (docSnap) => {
          if (docSnap.exists()) {
            // Encontrou a role
            const roleData = docSnap.data();
            setUserData(roleData); // Salva { role: "admin", ... }
            console.log("VIGIA (Snapshot): Role do usuário atualizada:", roleData.role);
          } else {
            // Acontece durante o cadastro (Auth criou, Firestore ainda não)
            console.warn("VIGIA (Snapshot): Usuário logado, aguardando dados de ROLE...");
            setUserData(null);
          }
          setIsLoading(false);
        }, (error) => {
          console.error("VIGIA (Snapshot): Erro ao ouvir dados de ROLE!", error);
          setUserData(null);
          setIsLoading(false);
        });

      } else {
        // Deslogado (sem mudança)
        setCurrentUser(null);
        setUserData(null);
        setIsLoading(false); 
        console.log("VIGIA (AuthState): Ninguém logado.");
      }
      return () => { if (firestoreUnsubscribe) firestoreUnsubscribe(); };
    });
    return () => authUnsubscribe();
  }, []);

  // Logout (sem mudanças)
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthFlow('selector'); 
      alert("Você saiu da conta.");
    } catch (error) { console.error("Erro ao sair:", error); }
  };

  // Loading (sem mudanças)
  if (isLoading) {
    return <div style={{ padding: '20px' }}><h1>Carregando...</h1></div>;
  }
  
  // --- 2. O "Valor" da nossa Mochila Global ---
  const shopContextValue = {
    managedShopId: userData?.managingShopId || userData?.worksAtShopId, 
    viewingShopId: viewingShopId,
    setViewingShopId: setViewingShopId
  };
  
  // --- 3. RENDERIZAÇÃO PRINCIPAL (Refatorada) ---
  return (
    <ShopContext.Provider value={shopContextValue}> 
      <div>
        <h1>Projeto Barbearia</h1>
        
        {/* Header (só mostra se estiver logado) */}
        {currentUser && userData && (
          <div style={{ padding: '10px', background: '#eee' }}>
            <p>Logado como: {currentUser.email} (Role: {userData.role})</p>
            <button onClick={handleLogout}>Sair (Logout)</button>
          </div>
        )}
        <hr />

        {/* --- LÓGICA DE CONTEÚDO --- */}

        {/* 5. Se ESTIVER LOGADO... */}
        {currentUser && userData && (
          <div>
            {userData.role === 'admin' && <AdminPanel />}
            {userData.role === 'client' && <ClientPanel />}
            {userData.role === 'professional' && <ProfessionalPanel />}
          </div>
        )}

        {/* 6. Se NÃO ESTIVER LOGADO... */}
        {!currentUser && (
          <div>
            {authFlow === 'selector' && (
              <div style={{ padding: '10px' }}>
                <button onClick={() => setAuthFlow('client')} style={{width: '100%', padding: '15px', marginBottom: '10px'}}>
                  Sou Cliente / Profissional (Entrar ou Cadastrar)
                </button>
                <button onClick={() => setAuthFlow('owner')} style={{width: '100%', padding: '15px'}}>
                  Sou Dono (Cadastrar minha Barbearia)
                </button>
              </div>
            )}
            
            {authFlow === 'client' && (
              <AuthChat onBack={() => setAuthFlow('selector')} />
            )}
            
            {authFlow === 'owner' && (
              <ShopRegistration onBack={() => setAuthFlow('selector')} />
            )}
          </div>
        )}
        
      </div>
    </ShopContext.Provider>
  );
}

export default App;