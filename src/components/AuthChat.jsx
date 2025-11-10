// src/components/AuthChat.jsx (Com correções de Key, Duplicatas e Autofill)

import React, { useState, useEffect, useRef } from 'react';
import './AuthChat.css';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { auth, db } from '../firebase-config';
import { setDoc, doc } from "firebase/firestore";

function AuthChat() {
  const [step, setStep] = useState('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // --- MUDANÇA 1: Bug da Mensagem Duplicada ---
  // Inicialize o estado já com a primeira mensagem do bot.
  const [messages, setMessages] = useState([
    { id: 'initial-1', text: 'Olá! 👋 Bem-vindo(a) à Barbearia. Você já tem uma conta?', sender: 'bot' }
  ]);
  // --- Fim da MUDANÇA 1 ---

  const messageListRef = useRef(null);

  const addMessage = (text, sender) => {
    setMessages(prevMessages => [
      ...prevMessages,
      // Correção da Key duplicada (que já fizemos)
      { id: `${Date.now()}-${Math.random()}`, text, sender }
    ]);
  };

  // Efeito para rolar para o final
  useEffect(() => {
    if (messageListRef.current) {
      const { scrollHeight } = messageListRef.current;
      messageListRef.current.scrollTo(0, scrollHeight);
    }
  }, [messages]);

  // --- MUDANÇA 2: Bug da Mensagem Duplicada ---
  // O useEffect que adicionava a mensagem inicial foi REMOVIDO.
  // --- Fim da MUDANÇA 2 ---

  // Lógica principal (handleSend)
  const handleSend = async (e) => {
    e.preventDefault();
    if (isLoading || !inputValue) return;

    const userInput = inputValue;
    addMessage(userInput, "user"); 
    setInputValue(''); 
    setIsLoading(true);

    try {
      // (Toda a lógica de 'if (step === ...)' continua EXATAMENTE a mesma)
      
      // === FLUXO DE LOGIN ===
      if (step === 'login_email') {
        setEmail(userInput);
        setStep('login_password'); 
        addMessage("Entendido. Agora, digite sua senha:", "bot");
      } 
      else if (step === 'login_password') {
        await signInWithEmailAndPassword(auth, email, userInput);
      }
      // === FLUXO DE CADASTRO ===
      else if (step === 'signup_name') {
        setFullName(userInput); 
        setStep('signup_email'); 
        addMessage(`Prazer, ${userInput}! Qual seu melhor email?`, "bot");
      }
      else if (step === 'signup_email') {
        setEmail(userInput); 
        setStep('signup_password');
        addMessage("Perfeito. Agora, crie uma senha (mín. 6 caracteres):", "bot");
      }
      else if (step === 'signup_password') {
        const newPassword = userInput;
        if (newPassword.length < 6) {
          throw new Error("A senha precisa ter pelo menos 6 caracteres.");
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, newPassword);
        const user = userCredential.user;
        await updateProfile(user, { displayName: fullName });
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: fullName,
          email: email,
          role: "client",
          createdAt: new Date()
        });
      }

    } catch (error) {
      console.error("Erro na autenticação:", error.code, error.message);
      // (Toda a lógica 'catch' inteligente continua EXATAMENTE a mesma)
      if (error.code === 'auth/email-already-in-use') {
        addMessage("Este e-mail já está cadastrado! Vamos tentar o login. Por favor, digite sua senha:", "bot");
        setStep('login_password');
      } else if (error.code === 'auth/wrong-password') {
        addMessage("Senha incorreta. Tente novamente:", "bot");
      } else {
        addMessage("Ops, algo deu errado. Vamos tentar do início.", "bot");
        addMessage("Você já tem uma conta?", "bot");
        setStep('initial');
      }
    }
    
    setIsLoading(false);
  };

  // Funções para os botões iniciais (sem mudanças)
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

  // ---- RENDERIZAÇÃO ----
  return (
    <div className="chat-container">
      {/* Lista de Mensagens (sem mudanças) */}
      <div className="message-list" ref={messageListRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        {isLoading && <div className="message bot">...</div>}
      </div>

      {/* Input (com a MUDANÇA 3) */}
      {step !== 'initial' && (
        <form className="input-form" onSubmit={handleSend}>
          <input 
            type={step.includes('password') ? 'password' : 
                  step.includes('email') ? 'email' : 'text'}
            
            // --- MUDANÇA 3: Aviso do Navegador (Autofill) ---
            // Adiciona o atributo 'name' para ajudar gerenciadores de senha
            name={
              step.includes('email') ? 'email' :
              step.includes('password') ? 'password' :
              step.includes('name') ? 'full-name' : 'text'
            }
            // --- Fim da MUDANÇA 3 ---

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
            autoComplete="on" // Habilita o autofill
          />
          <button type="submit" disabled={isLoading}>
            {'>'}
          </button>
        </form>
      )}

      {/* Botões Iniciais (sem mudanças) */}
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