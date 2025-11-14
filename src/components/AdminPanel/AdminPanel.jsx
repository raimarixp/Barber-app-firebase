// src/components/AdminPanel/AdminPanel.jsx
// (Refatorado para "Sistema de Convite" - VERSÃO CORRIGIDA)

import React, { useState, useEffect, useCallback } from 'react';
import styles from './AdminPanel.module.css';
import { db } from '../../firebase/firebase-config';
import { 
  addDoc, collection, getDocs, doc, 
  deleteDoc, // Removido 'updateDoc', 'setDoc' que não são mais usados aqui
  query, where, onSnapshot, Timestamp
} from "firebase/firestore"; 
import { useShop } from '../../App.jsx';

function AdminPanel() {
  const { managedShopId } = useShop();

  // --- Estados de Serviços ---
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('');
  const [services, setServices] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // --- Estados de Profissionais ---
  const [professionals, setProfessionals] = useState([]);
  const [isLoadingPros, setIsLoadingPros] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);

  // --- LÓGICA DE SERVIÇOS ---
  const fetchServices = useCallback(async () => {
    if (!managedShopId) return; 
    setIsLoadingServices(true);
    try {
      const servicesQuery = query(
        collection(db, "services"),
        where("barbershopId", "==", managedShopId)
      );
      const querySnapshot = await getDocs(servicesQuery);
      const servicesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(servicesList);
    } catch (error) { console.error("Erro ao buscar serviços: ", error); } 
    finally { setIsLoadingServices(false); }
  }, [managedShopId]);

  const handleAddService = async (e) => {
    e.preventDefault();
    setIsLoadingServices(true);
    try {
      await addDoc(collection(db, "services"), {
        name: serviceName,
        price: Number(servicePrice),
        duration: Number(serviceDuration),
        barbershopId: managedShopId
      });
      alert("Serviço adicionado com sucesso!");
      setServiceName(''); setServicePrice(''); setServiceDuration('');
      fetchServices(); // Recarrega a lista
    } catch (error) { 
      console.error("Erro ao adicionar serviço: ", error); 
      alert("Erro: " + error.message);
    } 
    finally { setIsLoadingServices(false); }
  };

  // --- LÓGICA DE PROFISSIONAIS ---
  
  // Efeito que carrega tudo
  useEffect(() => {
    if (!managedShopId) return;
    
    fetchServices(); // Carrega os serviços
    
    // Inicia o "ouvinte" da lista de profissionais
    setIsLoadingPros(true);
    const professionalsQuery = query(
      collection(db, "professionals"),
      where("barbershopId", "==", managedShopId)
    );
    
    const unsubscribe = onSnapshot(professionalsQuery, (querySnapshot) => {
      const prosList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProfessionals(prosList);
      setIsLoadingPros(false);
    }, (error) => {
      console.error("Erro ao ouvir profissionais: ", error);
      setIsLoadingPros(false);
    });
    
    return () => unsubscribe(); // Limpa o ouvinte
    
  }, [managedShopId, fetchServices]); // 'fetchServices' adicionado

  // Função para CONVIDAR
  const handleInviteProfessional = async (e) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return alert("Preencha nome e email.");
    
    setIsLoadingInvite(true);
    try {
      await addDoc(collection(db, "invites"), {
        name: inviteName,
        email: inviteEmail.toLowerCase(),
        barbershopId: managedShopId,
        status: "pending",
        createdAt: Timestamp.now()
      });
      
      alert(`Convite enviado para ${inviteName}! Avise-o para se cadastrar com este email.`);
      setInviteName('');
      setInviteEmail('');
      
    } catch (error) {
      console.error("Erro ao convidar: ", error);
      alert("Erro ao enviar convite.");
    } finally {
      setIsLoadingInvite(false);
    }
  };

  // Função para REMOVER
  const handleRemoveProfessional = async (profId, profName, userId) => {
    if (!window.confirm(`Tem certeza que quer remover "${profName}"? Isso também removerá a 'role' dele e o converterá em cliente.`)) return;

    try {
      // (Isso é complexo, requer um 'batch' para deletar o 'prof' E atualizar a 'role')
      // Por enquanto, vamos só deletar o perfil profissional
      const profDocRef = doc(db, "professionals", profId);
      await deleteDoc(profDocRef);
      
      // TODO: Usar uma Cloud Function para atualizar a 'role' do 'userId' para 'client'
      // Deletar o 'profDocRef' (que tem o ID do doc) é mais seguro que o 'userId'
      
      alert(`${profName} foi removido.`);
      // O 'onSnapshot' atualizará a lista automaticamente
      
    } catch (error) {
      console.error("Erro ao remover: ", error);
    }
  };
  
  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <div>
      {/* Seção 1: Gerenciar Serviços */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Gerenciar Serviços</h3>
        <form onSubmit={handleAddService} className={styles.form}>
          <label className={styles.formField} htmlFor="serviceName">
            <span>Nome do Serviço:</span>
            <input 
              type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} 
              id="serviceName" name="serviceName" required
            />
          </label>
          <label className={styles.formField} htmlFor="servicePrice">
            <span>Preço (R$):</span>
            <input 
              type="number" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} 
              id="servicePrice" name="servicePrice" required
            />
          </label>
          <label className={styles.formField} htmlFor="serviceDuration">
            <span>Duração (min):</span>
            <input 
              type="number" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)}
              id="serviceDuration" name="serviceDuration" required
            />
          </label>
          <button type="submit" disabled={isLoadingServices} className={styles.saveButton}>
            {isLoadingServices ? 'Salvando...' : 'Adicionar Serviço'}
          </button>
        </form>
        <hr />
        <h4>Serviços Atuais</h4>
        {isLoadingServices ? <p>Carregando serviços...</p> : (
          <ul>
            {services.map(s => <li key={s.id}>{s.name} (R$ {s.price})</li>)}
          </ul>
        )}
      </div>

      {/* Seção 2: Gerenciar Profissionais */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Gerenciar Profissionais</h3>
        
        <form onSubmit={handleInviteProfessional} className={styles.inviteForm}>
          <h4>Convidar Novo Profissional</h4>
          <p>Insira o nome e email do profissional. Ele deverá se cadastrar no app usando este email para ser vinculado à sua loja.</p>
          <label className={styles.formField} htmlFor="inviteName">
            <span>Nome do Profissional:</span>
            <input 
              type="text" id="inviteName" name="inviteName"
              value={inviteName} onChange={(e) => setInviteName(e.target.value)}
              required
            />
          </label>
          <label className={styles.formField} htmlFor="inviteEmail">
            <span>Email do Profissional:</span>
            <input 
              type="email" id="inviteEmail" name="inviteEmail"
              value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={isLoadingInvite} className={styles.saveButton} style={{backgroundColor: '#007bff'}}>
            {isLoadingInvite ? 'Enviando...' : 'Enviar Convite'}
          </button>
        </form>
        
        <hr />
        
        <h4>Profissionais Atuais</h4>
        {isLoadingPros ? <p>Carregando profissionais...</p> : (
          <div className={styles.proList}>
            {professionals.length === 0 && <p>Nenhum profissional cadastrado.</p>}
            {professionals.map(prof => (
              <div key={prof.id} className={styles.proCard}>
                <p><strong>Nome:</strong> {prof.name}</p>
                {/* O ID do documento é prof.id, o ID do usuário é prof.userId */}
                <button 
                  className={styles.deleteButton}
                  onClick={() => handleRemoveProfessional(prof.id, prof.name, prof.userId)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;