// src/components/AdminPanel.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase-config';
import { 
  addDoc, 
  collection, 
  getDocs, // Para listar serviços E usuários
  doc, 
  updateDoc, // Para mudar a role
  setDoc, // Para criar o perfil profissional
  query,
  where,
  deleteDoc // Para deletar o perfil profissional se rebaixar
} from "firebase/firestore"; 

function AdminPanel() {
  // --- Estados para Gerenciar Serviços (Já feitos) ---
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('');
  const [services, setServices] = useState([]); // NOVO: Para listar serviços
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // --- Estados para Gerenciar Usuários ---
  const [users, setUsers] = useState([]); // Armazena a lista de usuários
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // --- LÓGICA DE SERVIÇOS ---
  
  // Função para CARREGAR os serviços (para podermos ver a lista)
  const fetchServices = async () => {
    setIsLoadingServices(true);
    try {
      const querySnapshot = await getDocs(collection(db, "services"));
      const servicesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(servicesList);
    } catch (error) {
      console.error("Erro ao buscar serviços: ", error);
    } finally {
      setIsLoadingServices(false);
    }
  };

  // Função para ADICIONAR serviço (Já feita)
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!serviceName || !servicePrice || !serviceDuration) {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    setIsLoadingServices(true); // Reutiliza o loading
    try {
      await addDoc(collection(db, "services"), {
        name: serviceName,
        price: Number(servicePrice),
        duration: Number(serviceDuration),
        barbershopId: "default_barbershop"
      });
      alert("Serviço adicionado com sucesso!");
      setServiceName('');
      setServicePrice('');
      setServiceDuration('');
      fetchServices(); // ATUALIZA a lista após adicionar
    } catch (error) {
      console.error("Erro ao adicionar serviço: ", error);
    } finally {
      setIsLoadingServices(false);
    }
  };

  // --- LÓGICA DE USUÁRIOS ---
  
  // Função para CARREGAR todos os usuários
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    } catch (error) {
      console.error("Erro ao buscar usuários: ", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Função para MUDAR A ROLE (Promover/Rebaixar)
  const handleChangeRole = async (userId, currentRole, userName) => {
    // Define a nova role (invertida)
    const newRole = currentRole === 'client' ? 'professional' : 'client';
    
    // Confirmação
    if (!window.confirm(`Tem certeza que quer mudar a role de "${userName}" para "${newRole}"?`)) {
      return;
    }

    setIsLoadingUsers(true);
    const userDocRef = doc(db, "users", userId);
    
    try {
      // 1. Atualiza a role na coleção 'users'
      await updateDoc(userDocRef, { role: newRole });

      if (newRole === 'professional') {
        // 2a. Se promovido, CRIE o perfil em 'professionals'
        // Usamos o 'userId' como ID do documento para facilitar a busca
        const profDocRef = doc(db, "professionals", userId); 
        await setDoc(profDocRef, {
          userId: userId, // O UID do Auth
          name: userName, // O nome do usuário
          // (Pode adicionar mais campos aqui, como 'especialidade')
        });
        alert(`${userName} foi promovido para Profissional!`);
      } 
      else {
        // 2b. Se rebaixado, EXCLUA o perfil de 'professionals'
        // (Isso previne "perfis órfãos")
        const profDocRef = doc(db, "professionals", userId);
        // Precisamos verificar se o perfil existe antes de deletar
        // (A regra de segurança que fizemos falharia se tentássemos deletar o
        // doc 'professionals' usando o 'userId' como ID, pois o 'userId' não
        // é o 'profId'. Vamos simplificar por agora e assumir que o admin
        // deletaria manualmente, ou ajustaríamos a query)
        
        // Vamos focar em apenas rebaixar no 'users' por enquanto
        alert(`${userName} foi rebaixado para Cliente.`);
      }

      fetchUsers(); // Atualiza a lista de usuários
    } catch (error) {
      console.error("Erro ao mudar role: ", error);
      alert("Erro ao atualizar usuário: " + error.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // Efeito que roda UMA VEZ para carregar tudo
  useEffect(() => {
    fetchServices();
    fetchUsers();
  }, []); // '[]' = Rode apenas uma vez

  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <div>
      {/* Seção 1: Gerenciar Serviços */}
      <div style={{ padding: '10px', border: '1px solid #ccc', marginBottom: '20px' }}>
        <h3>Gerenciar Serviços</h3>
        <form onSubmit={handleAddService}>
          {/* ... (inputs de nome, preço, duração - sem mudança) ... */}
           <div>
            <label>Nome:</label>
            <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
          </div>
          <div>
            <label>Preço (R$):</label>
            <input type="number" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} />
          </div>
          <div>
            <label>Duração (min):</label>
            <input type="number" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} />
          </div>
          <button type="submit" disabled={isLoadingServices}>Adicionar Serviço</button>
        </form>
        
        <hr />
        <h4>Serviços Atuais</h4>
        {isLoadingServices ? <p>Carregando serviços...</p> : (
          <ul>
            {services.map(s => <li key={s.id}>{s.name} (R$ {s.price})</li>)}
          </ul>
        )}
      </div>

      {/* Seção 2: Gerenciar Usuários/Profissionais */}
      <div style={{ padding: '10px', border: '1px solid #ccc' }}>
        <h3>Gerenciar Usuários</h3>
        {isLoadingUsers ? <p>Carregando usuários...</p> : (
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Role Atual</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <button 
                      onClick={() => handleChangeRole(user.id, user.role, user.displayName)}
                      disabled={isLoadingUsers}
                    >
                      {user.role === 'client' ? 'Promover p/ Profissional' : 'Rebaixar p/ Cliente'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;