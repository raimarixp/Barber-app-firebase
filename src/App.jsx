// src/App.jsx
// (COMPLETO - Integração Layout Premium + Navegação + God Mode + Whitelabel)

import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth, db } from './firebase/firebase-config'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from "firebase/firestore"; 
import { Toaster } from 'sonner'; // Gerenciador de notificações global

// Ícones para a tela inicial
import { User, Store, ArrowRight, Scissors } from 'lucide-react';

// Componentes Refatorados
import SuperAdminPanel from './components/SuperAdminPanel/SuperAdminPanel.jsx';
import AuthChat from './components/AuthChat/AuthChat.jsx';
import ShopRegistration from './components/ShopRegistration/ShopRegistration.jsx';
import AdminPanel from './components/AdminPanel/AdminPanel.jsx'; 
import ClientPanel from './components/ClientPanel/ClientPanel.jsx'; 
import ProfessionalPanel from './components/ProfessionalPanel/ProfessionalPanel.jsx';
import Layout from './components/Layout/Layout.jsx'; // Novo Layout wrapper

// Hook de Branding
import useShopBranding from './hooks/useShopBranding';

// --- Contexto Global ---
const ShopContext = createContext();
export const useShop = () => useContext(ShopContext);

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [authFlow, setAuthFlow] = useState('selector'); // 'selector' | 'client' | 'owner'
  const [viewingShopId, setViewingShopId] = useState(null);
  
  // --- HOOK DE BRANDING (WHITELABEL) ---
  // Detecta se estamos em um subdomínio e define a loja/cor
  const branding = useShopBranding(setViewingShopId);

  // --- Vigia de Autenticação e Role ---
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      let firestoreUnsubscribe = null; 
      
      if (user) {
        setCurrentUser(user);
        
        // Escuta a role do usuário em tempo real
        const roleDocRef = doc(db, "roles", user.uid);
        
        firestoreUnsubscribe = onSnapshot(roleDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const roleData = docSnap.data();
            setUserData(roleData);
            console.log("App: Role atualizada:", roleData.role);
          } else {
            // Usuário criado no Auth, mas documento 'roles' ainda não existe (comum na criação)
            setUserData(null);
          }
          setIsLoading(false);
        }, (error) => {
          console.error("App: Erro ao buscar role:", error);
          setUserData(null);
          setIsLoading(false);
        });

      } else {
        // Logout
        setCurrentUser(null);
        setUserData(null);
        setIsLoading(false); 
      }
      return () => { if (firestoreUnsubscribe) firestoreUnsubscribe(); };
    });
    return () => authUnsubscribe();
  }, []);

  // --- Logout ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthFlow('selector'); 
      // Se não estiver em um domínio whitelabel fixo, limpa o ID
      if (!branding.isBranded) {
          setViewingShopId(null);
      }
    } catch (error) { console.error("Erro ao sair:", error); }
  };

  // --- Tela de Carregamento Inicial ---
  if (isLoading || branding.loading) {
    return (
      <div className="min-h-screen bg-grafite-main flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 bg-gold-main rounded-xl flex items-center justify-center text-grafite-main animate-bounce">
          <Scissors size={28} strokeWidth={2.5} />
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div>
        <p className="text-text-secondary text-sm animate-pulse">Carregando sistema...</p>
      </div>
    );
  }
  
  // --- Valor do Contexto ---
  const shopContextValue = {
    managedShopId: userData?.managingShopId || userData?.worksAtShopId, 
    // Se o whitelabel definiu uma loja, ela tem prioridade
    viewingShopId: branding.shopId || viewingShopId, 
    setViewingShopId: setViewingShopId
  };
  
  // --- Renderização Principal ---
  return (
    <ShopContext.Provider value={shopContextValue}>
      {/* Toaster Global (Notificações) */}
      <Toaster richColors theme="dark" position="top-center" closeButton />
      
      {/* Layout Envelopando a Aplicação */}
      <Layout user={currentUser} userData={userData} onLogout={handleLogout}>
        
        {/* 1. USUÁRIO LOGADO */}
        {currentUser && userData ? (
          <div className="animate-slide-up">
            {/* ROTEAMENTO DE ROLES */}
            {userData.role === 'super_admin' && <SuperAdminPanel />}
            {userData.role === 'admin' && <AdminPanel />}
            {userData.role === 'client' && <ClientPanel />}
            {userData.role === 'professional' && <ProfessionalPanel />}
            
            {/* Fallback para role desconhecida */}
            {!['admin', 'client', 'professional', 'super_admin'].includes(userData.role) && (
              <div className="text-center py-10">
                <h2 className="text-xl text-white">Aguardando configuração da conta...</h2>
                <p className="text-text-secondary">Se isso persistir, contate o suporte.</p>
              </div>
            )}
          </div>
        ) : (
          
          // 2. USUÁRIO NÃO LOGADO (Fluxo de Entrada)
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
            
            {/* Se estivermos em uma loja Whitelabel, pula o seletor e vai para o login/cadastro */}
            {branding.isBranded ? (
                 <AuthChat onBack={() => {}} /> 
            ) : (
                /* Fluxo Padrão do SaaS (Domínio Principal) */
                <>
                    {authFlow === 'selector' && (
                      <div className="w-full max-w-5xl animate-fade-in px-4">
                        
                        <div className="text-center mb-12 space-y-2">
                          <h2 className="text-4xl md:text-5xl font-heading font-bold text-white tracking-tight">
                            Bem-vindo ao <span className="text-gold-main">Futuro</span>
                          </h2>
                          <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto font-light">
                            A plataforma definitiva para barbearias de elite. Agendamentos, gestão e pagamentos em um só lugar.
                          </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                            
                            {/* Card Cliente / Profissional */}
                            <button 
                                onClick={() => setAuthFlow('client')}
                                className="group relative overflow-hidden bg-grafite-card border border-grafite-border rounded-2xl p-8 text-left transition-all duration-300 hover:border-gold-main hover:shadow-glow hover:-translate-y-1"
                            >
                                <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                                    <User size={180} />
                                </div>
                                <div className="relative z-10">
                                    <div className="w-14 h-14 bg-grafite-surface rounded-xl flex items-center justify-center mb-6 border border-grafite-border group-hover:bg-gold-main group-hover:text-grafite-main group-hover:border-gold-main transition-colors duration-300">
                                        <User size={28} />
                                    </div>
                                    <h3 className="text-2xl font-heading font-bold text-white mb-2 group-hover:text-gold-main transition-colors">Cliente ou Profissional</h3>
                                    <p className="text-text-secondary mb-8 leading-relaxed">
                                        Agende seu próximo corte com facilidade ou gerencie sua agenda profissional e seus horários.
                                    </p>
                                    <div className="flex items-center text-gold-main font-semibold text-sm tracking-wide">
                                        ACESSAR AGORA <ArrowRight size={16} className="ml-2 group-hover:translate-x-2 transition-transform" />
                                    </div>
                                </div>
                            </button>

                            {/* Card Proprietário */}
                            <button 
                                onClick={() => setAuthFlow('owner')}
                                className="group relative overflow-hidden bg-grafite-card border border-grafite-border rounded-2xl p-8 text-left transition-all duration-300 hover:border-gold-main hover:shadow-glow hover:-translate-y-1"
                            >
                                <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                                    <Store size={180} />
                                </div>
                                <div className="relative z-10">
                                    <div className="w-14 h-14 bg-grafite-surface rounded-xl flex items-center justify-center mb-6 border border-grafite-border group-hover:bg-gold-main group-hover:text-grafite-main group-hover:border-gold-main transition-colors duration-300">
                                        <Store size={28} />
                                    </div>
                                    <h3 className="text-2xl font-heading font-bold text-white mb-2 group-hover:text-gold-main transition-colors">Sou Proprietário</h3>
                                    <p className="text-text-secondary mb-8 leading-relaxed">
                                        Cadastre sua barbearia, configure serviços, equipe e pagamentos. Eleve o nível do seu negócio.
                                    </p>
                                    <div className="flex items-center text-gold-main font-semibold text-sm tracking-wide">
                                        CADASTRAR NEGÓCIO <ArrowRight size={16} className="ml-2 group-hover:translate-x-2 transition-transform" />
                                    </div>
                                </div>
                            </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Componentes de Entrada */}
                    {authFlow === 'client' && (
                      <AuthChat onBack={() => setAuthFlow('selector')} />
                    )}
                    
                    {authFlow === 'owner' && (
                      <ShopRegistration onBack={() => setAuthFlow('selector')} />
                    )}
                </>
            )}
            
          </div>
        )}
        
      </Layout>
    </ShopContext.Provider>
  );
}

export default App;