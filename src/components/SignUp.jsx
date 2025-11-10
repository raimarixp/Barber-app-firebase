// src/components/SignUp.jsx

import React, { useState } from 'react';
// 1. Importe 'updateProfile' para salvar o nome no Auth
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
// 2. Importe o 'db' e as funções do Firestore
import { auth, db } from '../firebase-config'; 
import { setDoc, doc } from "firebase/firestore"; 

function SignUp() {
  // 3. Adicione um estado para o Nome Completo
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async (event) => {
    event.preventDefault(); 
    
    // 4. Validação simples
    if (!fullName) {
      alert("Por favor, preencha seu nome completo.");
      return;
    }
    if (password.length < 6) {
      alert("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    try {
      // ETAPA 1: Criar o usuário no Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Usuário criado no Auth:", user);

      // ETAPA 2: ATUALIZAR o perfil do Auth com o Nome
      // Isso faz o 'currentUser.displayName' funcionar
      await updateProfile(user, {
        displayName: fullName
      });
      console.log("Perfil do Auth atualizado com o nome.");

      // ETAPA 3: Salvar os dados no Firestore (incluindo o nome e a role)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: fullName, // <-- Salvando o nome
        email: user.email,
        role: "client",
        createdAt: new Date()
      });
      
      console.log("Usuário salvo no Firestore");
      alert("Conta criada com sucesso! Bem-vindo(a), " + fullName);
      
      // Limpa os campos
      setFullName('');
      setEmail('');
      setPassword('');

    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      alert("Erro ao criar conta: " + error.message);
    }
  };

  return (
    <div>
      <h2>Criar Nova Conta</h2>
      <form onSubmit={handleSignUp}>
        {/* 5. Adicione o Input para Nome Completo */}
        <div>
          <label>Nome Completo:</label>
          <input 
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu nome e sobrenome"
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seuemail@exemplo.com"
            required
          />
        </div>
        <div>
          <label>Senha:</label>
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
        </div>
        <button type="submit">Cadastrar</button>
      </form>
    </div>
  );
}

export default SignUp;