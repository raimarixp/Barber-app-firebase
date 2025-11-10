// src/components/Login.jsx

// 1. Importe 'useState'
import React, { useState } from 'react';

// 2. Importe a função de LOGIN (signIn) e o auth
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase-config'; // Caminho para nossa config

function Login() {
  // 3. Estados para email e senha
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 4. Função para lidar com o submit do formulário
  const handleLogin = async (event) => {
    event.preventDefault(); // Impede o recarregamento da página

    try {
      // 5. A MÁGICA DO LOGIN!
      // Use a função 'signInWithEmailAndPassword'
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Se deu certo:
      const user = userCredential.user;
      console.log("Usuário logado:", user);
      alert("Login efetuado com sucesso! Bem-vindo(a) " + user.email);

      // Limpe os campos
      setEmail('');
      setPassword('');

    } catch (error) {
      // Se deu errado:
      console.error("Erro ao fazer login:", error);
      // O Firebase dá erros úteis, como 'auth/wrong-password' ou 'auth/user-not-found'
      alert("Erro ao fazer login: " + error.message);
    }
  };

  return (
    <div>
      <h2>Entrar na sua Conta</h2>
      {/* 6. Conecte a função ao 'onSubmit' */}
      <form onSubmit={handleLogin}>
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
            placeholder="Sua senha"
            required
          />
        </div>
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}

export default Login;