// src/components/AuthChat/AuthChat.jsx
// (COMPLETO - Visual Premium + Tailwind + Lógica de Convite)

import { useState, useEffect, useRef } from 'react';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { auth, db } from '../../firebase/firebase-config';
import { 
  doc, writeBatch, 
  collection, query, where, getDocs
} from "firebase/firestore"; 
import { toast } from 'sonner';
import { ArrowLeft, Send, MessageSquare } from 'lucide-react';

function AuthChat({ onBack }) {
  const [step, setStep] = useState('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Estados para guardar os dados
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Estado do histórico de mensagens
  const [messages, setMessages] = useState([
    { id: 'initial-1', text: 'Olá! 👋 Bem-vindo(a) ao Barber App. Como posso ajudar você hoje?', sender: 'bot' }
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
      const { scrollHeight, clientHeight } = messageListRef.current;
      messageListRef.current.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Lógica principal (envio)
  const handleSend = async (e) => {
    e.preventDefault();
    if (isLoading || !inputValue.trim()) return;

    const userInput = inputValue.trim();
    addMessage(userInput, "user"); 
    setInputValue(''); 
    setIsLoading(true);

    try {
      // === FLUXO DE LOGIN ===
      if (step === 'login_email') {
        setEmail(userInput.toLowerCase());
        setStep('login_password'); 
        addMessage("Entendido. Agora, digite sua senha de acesso:", "bot");
      } 
      else if (step === 'login_password') {
        await signInWithEmailAndPassword(auth, email, userInput);
        // O App.jsx detectará o login
      }
      
      // === FLUXO DE CADASTRO ===
      else if (step === 'signup_name') {
        setFullName(userInput); 
        setStep('signup_email'); 
        addMessage(`Prazer, ${userInput}! Qual é o seu melhor e-mail?`, "bot");
      }
      else if (step === 'signup_email') {
        setEmail(userInput.toLowerCase());
        setStep('signup_password');
        addMessage("Perfeito. Agora, crie uma senha segura (mínimo 6 caracteres):", "bot");
      }
      
      // === FINALIZAÇÃO DO CADASTRO (COM CHECAGEM DE CONVITE) ===
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
        
        // Etapa 2: Checar o convite
        const invitesQuery = query(
          collection(db, "invites"),
          where("email", "==", userEmail)
        );
        
        const inviteSnapshot = await getDocs(invitesQuery);
        
        // Filtra status no JS
        const pendingInvite = inviteSnapshot.docs.find(
          doc => doc.data().status === "pending"
        );
        
        const batch = writeBatch(db);
        
        if (!pendingInvite) {
          // --- CLIENTE NORMAL ---
          console.log("Cadastrando como Cliente.");
          const userDocRef = doc(db, "users", user.uid);
          batch.set(userDocRef, { uid: user.uid, displayName: fullName, email: userEmail, createdAt: new Date() });
          
          const roleDocRef = doc(db, "roles", user.uid);
          batch.set(roleDocRef, { role: "client" });
          
        } else {
          // --- PROFISSIONAL CONVIDADO ---
          console.log("Convite encontrado! Cadastrando como Profissional.");
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
        toast.success("Conta criada com sucesso!");
      }

    } catch (error) {
      console.error("Erro na autenticação:", error.code, error.message);
      
      if (error.code === 'auth/email-already-in-use') {
        addMessage("Este e-mail já possui cadastro. Vamos tentar o login? Digite sua senha:", "bot");
        setStep('login_password');
      } 
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        addMessage("Credenciais incorretas. Por favor, tente novamente:", "bot");
        // Mantém no mesmo passo para tentar de novo
      } 
      else if (error.message.includes("6 caracteres")) {
         addMessage("Senha muito curta. Tente uma com 6 ou mais caracteres:", "bot");
      }
      else {
        toast.error(`Erro: ${error.code}`);
        addMessage("Ocorreu um erro inesperado. Vamos recomeçar?", "bot");
        setStep('initial');
      }
    }
    
    setIsLoading(false);
  };

  // Funções para os botões iniciais
  const handleInitialChoice = (choice) => {
    if (choice === 'login') {
      setStep('login_email');
      addMessage("Já tenho conta", "user");
      setTimeout(() => addMessage("Ok, qual é o seu e-mail?", "bot"), 400);
    } else { 
      setStep('signup_name');
      addMessage("Quero me cadastrar", "user");
      setTimeout(() => addMessage("Excelente! Para começar, qual seu nome completo?", "bot"), 400);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[500px] p-4 animate-fade-in">
      
      <div className="w-full max-w-md bg-grafite-card border border-grafite-border rounded-2xl shadow-premium overflow-hidden flex flex-col h-[600px]">
        
        {/* Header */}
        <div className="bg-grafite-main border-b border-grafite-border p-4 flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="text-text-secondary hover:text-gold-main transition-colors p-1 rounded-full hover:bg-grafite-surface"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gold-main flex items-center justify-center text-grafite-main">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm text-white">Assistente Virtual</h3>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Online
              </span>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-grafite-surface/50" ref={messageListRef}>
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`
                  max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm animate-slide-up
                  ${msg.sender === 'user' 
                    ? 'bg-gold-main text-grafite-main font-medium rounded-tr-none' 
                    : 'bg-grafite-main border border-grafite-border text-text-secondary rounded-tl-none'
                  }
                `}
              >
                {msg.text}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-grafite-main border border-grafite-border px-4 py-3 rounded-2xl rounded-tl-none flex gap-1 items-center">
                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce"></span>
              </div>
            </div>
          )}

          {/* Botões de Escolha Inicial (Inline no Chat) */}
          {step === 'initial' && !isLoading && (
            <div className="flex flex-col gap-2 mt-4 animate-fade-in">
              <button 
                onClick={() => handleInitialChoice('login')}
                className="w-full py-3 px-4 bg-grafite-main border border-gold-main/30 text-text-primary rounded-xl hover:bg-gold-dim/10 hover:border-gold-main transition-all text-sm font-medium text-left flex justify-between items-center group"
              >
                Sim, já tenho uma conta
                <span className="text-gold-main opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </button>
              <button 
                onClick={() => handleInitialChoice('signup')}
                className="w-full py-3 px-4 bg-gold-main text-grafite-main rounded-xl hover:bg-gold-hover hover:shadow-glow transition-all text-sm font-bold text-left flex justify-between items-center"
              >
                Não, quero me cadastrar
                <span>→</span>
              </button>
            </div>
          )}
        </div>

        {/* Input Area */}
        {step !== 'initial' && (
          <form onSubmit={handleSend} className="p-4 bg-grafite-main border-t border-grafite-border flex gap-3 items-center">
            <input 
              type={step.includes('password') ? 'password' : step.includes('email') ? 'email' : 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                step.includes('password') ? 'Digite sua senha...' : 
                step.includes('email') ? 'Digite seu e-mail...' : 
                'Digite sua resposta...'
              }
              className="flex-1 bg-grafite-surface border border-grafite-border rounded-full px-5 py-3 text-sm text-text-primary placeholder-text-secondary/50 outline-none focus:border-gold-main focus:ring-1 focus:ring-gold-main/50 transition-all"
              disabled={isLoading}
              autoComplete="off"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={isLoading || !inputValue.trim()}
              className="bg-gold-main text-grafite-main rounded-full w-12 h-12 flex items-center justify-center hover:bg-gold-hover hover:shadow-glow transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} className="ml-1" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthChat;