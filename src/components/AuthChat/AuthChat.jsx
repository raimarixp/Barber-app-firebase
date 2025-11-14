// src/components/AuthChat/AuthChat.jsx
// (Atualizado com Lógica de Convite de Profissional)

import { useState, useEffect, useRef } from 'react';
import './AuthChat.css'; // Importa o CSS da mesma pasta
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { auth, db } from '../../firebase/firebase-config'; // Caminho corrigido
import { 
  doc, writeBatch, 
  collection, query, where, getDocs, // Imports para a checagem de convite
  updateDoc // Para atualizar o convite
} from "firebase/firestore"; 

function AuthChat({ onBack }) {
  const [step, setStep] = useState('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Estados para guardar os dados
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Estado do histórico de mensagens (começa com a 1ª mensagem)
  const [messages, setMessages] = useState([
    { id: 'initial-1', text: 'Olá! 👋 Bem-vindo(a). Você já tem uma conta?', sender: 'bot' }
  ]);
  
  const messageListRef = useRef(null);

  // Helper para adicionar mensagens
  const addMessage = (text, sender) => {
    setMessages(prevMessages => [
      ...prevMessages,
      { id: `${Date.now()}-${Math.random()}`, text, sender }
    ]);
  };

  // Helper para auto-scroll
  useEffect(() => {
    if (messageListRef.current) {
      const { scrollHeight } = messageListRef.current;
      messageListRef.current.scrollTo(0, scrollHeight);
    }
  }, [messages]);

  // Lógica principal (o que acontece quando o usuário envia)
  const handleSend = async (e) => {
    e.preventDefault();
    if (isLoading || !inputValue) return;

    const userInput = inputValue;
    addMessage(userInput, "user"); 
    setInputValue(''); 
    setIsLoading(true);

    try {
      // === FLUXO DE LOGIN ===
      if (step === 'login_email') {
        setEmail(userInput.toLowerCase());
        setStep('login_password'); 
        addMessage("Entendido. Agora, digite sua senha:", "bot");
      } 
      else if (step === 'login_password') {
        await signInWithEmailAndPassword(auth, email, userInput);
      }
      
      // === FLUXO DE CADASTRO (CLIENTE ou PROFISSIONAL) ===
      else if (step === 'signup_name') {
        setFullName(userInput); 
        setStep('signup_email'); 
        addMessage(`Prazer, ${userInput}! Qual seu melhor email?`, "bot");
      }
      else if (step === 'signup_email') {
        setEmail(userInput.toLowerCase());
        setStep('signup_password');
        addMessage("Perfeito. Agora, crie uma senha (mín. 6 caracteres):", "bot");
      }
      
      // --- (A CORREÇÃO ESTÁ AQUI) ---
      else if (step === 'signup_password') {
        const newPassword = userInput;
        const userEmail = email; // Já está em minúsculas
        
        if (newPassword.length < 6) {
          throw new Error("A senha precisa ter pelo menos 6 caracteres.");
        }
        
        // Etapa 1: Criar no Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, newPassword);
        const user = userCredential.user;
        await updateProfile(user, { displayName: fullName });
        
        // Etapa 2: Checar o convite (COM CONSULTA SIMPLES)
        const invitesQuery = query(
          collection(db, "invites"),
          where("email", "==", userEmail) // 1. Busque SÓ pelo email
        );
        
        const inviteSnapshot = await getDocs(invitesQuery);
        
        // 2. Filtre o "status" AQUI, no JavaScript
        const pendingInvite = inviteSnapshot.docs.find(
          doc => doc.data().status === "pending"
        );
        
        const batch = writeBatch(db);
        
        // 3. Use a variável filtrada
        if (!pendingInvite) {
          // --- É UM CLIENTE NORMAL ---
          console.log("Nenhum convite pendente encontrado. Cadastrando como Cliente.");
          
          const userDocRef = doc(db, "users", user.uid);
          batch.set(userDocRef, { uid: user.uid, displayName: fullName, email: userEmail, createdAt: new Date() });
          
          const roleDocRef = doc(db, "roles", user.uid);
          batch.set(roleDocRef, { role: "client" });
          
        } else {
          // --- É UM PROFISSIONAL CONVIDADO ---
          console.log("Convite pendente encontrado! Cadastrando como Profissional.");
          const inviteDoc = pendingInvite;
          const inviteData = inviteDoc.data();
          
          const userDocRef = doc(db, "users", user.uid);
          batch.set(userDocRef, { uid: user.uid, displayName: fullName, email: userEmail, createdAt: new Date() });
          
          const roleDocRef = doc(db, "roles", user.uid);
          batch.set(roleDocRef, {
            role: "professional",
            worksAtShopId: inviteData.barbershopId
          });
          
          const profDocRef = doc(db, "professionals", user.uid); 
          batch.set(profDocRef, {
            userId: user.uid,
            name: fullName,
            email: userEmail,
            barbershopId: inviteData.barbershopId,
            services: []
          });
          
          batch.update(doc(db, "invites", inviteDoc.id), {
            status: "completed",
            userId: user.uid
          });
        }
        
        // Etapa 3: Salvar tudo
        await batch.commit();
        // O vigia no App.jsx vai pegar o login e redirecionar
      }
      // --- FIM DA CORREÇÃO ---

    } catch (error) {
      console.error("Erro na autenticação:", error.code, error.message);
      
      // Lógica "Inteligente" de Erro (sem mudança)
      if (error.code === 'auth/email-already-in-use') {
        addMessage("Este e-mail já está cadastrado! Vamos tentar o login. Por favor, digite sua senha:", "bot");
        setStep('login_password');
      } 
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        addMessage("O e-mail ou a senha estão incorretos. Por favor, tente novamente:", "bot");
        if (step === 'login_password') { /* fica no mesmo passo */ } 
        else {
          setStep('login_email'); 
          addMessage("Qual o seu email?", "bot");
        }
      } 
      else {
        // O 'permission-denied' que você estava vendo caía aqui
        addMessage(`Ops, algo deu errado (${error.code}). Vamos tentar do início.`, "bot");
        addMessage("Você já tem uma conta?", "bot");
        setStep('initial');
      }
    }
    
    setIsLoading(false);
  };

  // Funções para os botões iniciais
  const handleInitialChoice = (choice) => {
    if (choice === 'login') {
      setStep('login_email');
      addMessage("Sim, quero Entrar", "user");
      addMessage("Ok, qual o seu email?", "bot");
    } else { // 'signup'
      setStep('signup_name');
      addMessage("Não, quero me Cadastrar", "user");
      addMessage("Legal! Qual o seu nome completo?", "bot");
    }
  };

  // ---- RENDERIZAÇÃO (JSX) ----
  return (
    <div className="chat-container">
      {/* Botão Voltar */}
      <button 
        onClick={onBack} 
        style={{ 
          margin: '5px', background: 'none', border: 'none', 
          cursor: 'pointer', color: '#007bff', fontSize: '14px',
          alignSelf: 'flex-start'
        }}
      >
        &larr; Voltar
      </button>

      {/* Lista de Mensagens */}
      <div className="message-list" ref={messageListRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        {isLoading && <div className="message bot">...</div>}
      </div>

      {/* Input (se não for o passo inicial) */}
      {step !== 'initial' && (
        <form className="input-form" onSubmit={handleSend}>
          <input 
            type={step.includes('password') ? 'password' : 
                  step.includes('email') ? 'email' : 'text'}
            name={
              step.includes('email') ? 'email' :
              step.includes('password') ? 'password' :
              step.includes('name') ? 'full-name' : 'text'
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              step === 'login_email' ? 'Digite seu email...' :
              step === 'login_password' ? 'Digite sua senha...' :
              step === 'signup_name' ? 'Digite seu nome completo...' :
              step === 'signup_email' ? 'Digite seu email...' :
              'Crie sua senha...'
            }
            disabled={isLoading}
            autoComplete="on"
          />
          <button type="submit" disabled={isLoading}>
            {'>'}
          </button>
        </form>
      )}

      {/* Botões Iniciais */}
      {step === 'initial' && (
        <div className="initial-buttons">
          <button onClick={() => handleInitialChoice('login')}>
            Sim, quero Entrar
          </button>
          <button onClick={() => handleInitialChoice('signup')}>
            Não, quero me Cadastrar
          </button>
        </div>
      )}
    </div>
  );
}

export default AuthChat;