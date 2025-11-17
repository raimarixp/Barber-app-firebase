// src/components/AdminPanel/AdminPanel.jsx
// (COMPLETO - Com Perfil Editável, Serviços, Convites e Pagamento)

import { useState, useEffect, useCallback } from 'react';
import styles from './AdminPanel.module.css';
import { db } from '../../firebase/firebase-config';
import { 
  addDoc, collection, getDocs, doc, 
  updateDoc, deleteDoc,
  query, where, onSnapshot, Timestamp,
  getDoc, writeBatch, deleteField,
  setDoc
} from "firebase/firestore"; 
import { useShop } from '../../App.jsx';

// --- Função Helper do Cloudinary ---
const uploadImageToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const apiUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  try {
    const response = await fetch(apiUrl, { method: 'POST', body: formData });
    const data = await response.json();
    if (data.secure_url) return data.secure_url;
    else throw new Error(data.error.message || 'Falha no upload');
  } catch (error) {
    console.error("Erro no upload do Cloudinary:", error);
    throw error;
  }
};

function AdminPanel() {
  const { managedShopId } = useShop();

  // --- Estados do Perfil da Loja ---
  const [shopProfile, setShopProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

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

  // --- Estados de Pagamento ---
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  // --- LÓGICA DE CARREGAMENTO ---

  // 1. Busca os dados da loja
  const fetchShopProfile = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingProfile(true);
    try {
      const shopDocRef = doc(db, "barbershops", managedShopId);
      const docSnap = await getDoc(shopDocRef);
      if (docSnap.exists()) {
        setShopProfile(docSnap.data());
      } else {
        console.error("Erro: Dono logado, mas loja não encontrada!");
      }
    } catch (error) { 
      console.error("Erro ao buscar perfil da loja: ", error); 
    } finally { 
      setIsLoadingProfile(false); 
    }
  }, [managedShopId]);

  // 2. Busca os serviços
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
    } catch (error) { 
      console.error("Erro ao buscar serviços: ", error); 
    } finally { 
      setIsLoadingServices(false); 
    }
  }, [managedShopId]);

  // Efeito que carrega tudo
  useEffect(() => {
    if (!managedShopId) return;
    
    fetchShopProfile();
    fetchServices();
    
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
    
    return () => unsubscribe();
    
  }, [managedShopId, fetchShopProfile, fetchServices]);

  // --- FUNÇÕES DE SALVAR / ATUALIZAR ---

  // 1. Salva o Perfil da Loja
  const handleUpdateShopProfile = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    let newLogoUrl = shopProfile.logoUrl;

    try {
      if (newLogoFile) {
        console.log("Enviando nova logo...");
        newLogoUrl = await uploadImageToCloudinary(newLogoFile);
        setNewLogoFile(null);
      }
      
      const shopDocRef = doc(db, "barbershops", managedShopId);
      await updateDoc(shopDocRef, {
        name: shopProfile.name,
        address: shopProfile.address,
        cidade: shopProfile.cidade,
        description: shopProfile.description,
        logoUrl: newLogoUrl
      });
      
      alert("Perfil da loja atualizado com sucesso!");

    } catch (error) {
      console.error("Erro ao atualizar perfil: ", error);
      alert("Erro ao atualizar: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 2. Adicionar Serviço
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!serviceName || !servicePrice || !serviceDuration) return;
    setIsLoadingServices(true);
    try {
      await addDoc(collection(db, "services"), {
        name: serviceName,
        price: Number(servicePrice),
        duration: Number(serviceDuration),
        barbershopId: managedShopId
      });
      alert("Serviço adicionado com sucesso!");
      setServiceName(''); 
      setServicePrice(''); 
      setServiceDuration('');
      fetchServices();
    } catch (error) { 
      console.error("Erro ao adicionar serviço: ", error); 
      alert("Erro: " + error.message);
    } finally { 
      setIsLoadingServices(false); 
    }
  };
  
  // 3. Convidar Profissional
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
  
  // 4. Remover Profissional
  const handleRemoveProfessional = async (profId, profName, userId) => {
    if (!window.confirm(`Tem certeza que quer remover "${profName}"? Isso também removerá a 'role' dele e o converterá em cliente.`)) return;

    try {
      const batch = writeBatch(db);

      const profDocRef = doc(db, "professionals", profId);
      batch.delete(profDocRef);
      
      const roleDocRef = doc(db, "roles", userId);
      batch.update(roleDocRef, {
        role: "client",
        worksAtShopId: deleteField()
      });

      await batch.commit();
      
      alert(`${profName} foi removido e rebaixado para Cliente.`);
      
    } catch (error) {
      console.error("Erro ao remover: ", error);
      alert("Erro ao remover profissional: " + error.message);
    }
  };

 // 5. Salvar Chaves de Pagamento (ATUALIZADO)
  const handleSavePaymentKeys = async () => {
    if (!mpAccessToken) return alert("Por favor, cole o Access Token.");
    setIsSavingKeys(true);
    try {
      const batch = writeBatch(db);

      // 1. Salva o token no COFRE PRIVADO (Segurança)
      const keysDocRef = doc(db, "barbershops", managedShopId, "private", "keys");
      batch.set(keysDocRef, { accessToken: mpAccessToken }, { merge: true });

      // 2. Atualiza o sinalizador PÚBLICO na loja (Para o ClientPanel saber)
      const shopDocRef = doc(db, "barbershops", managedShopId);
      batch.update(shopDocRef, { onlinePaymentEnabled: true });
      
      await batch.commit();
      
      alert("Pagamento online ATIVADO para sua loja!");
      setMpAccessToken("");
    } catch (error) {
      console.error("Erro ao salvar chaves:", error);
      alert("Erro ao salvar chaves. Verifique se você é o dono da loja.");
    } finally {
      setIsSavingKeys(false);
    }
  };
  
  // --- RENDERIZAÇÃO (JSX) ---
  
  if (isLoadingProfile || !shopProfile) {
    return <div><h2>Carregando seu painel...</h2></div>;
  }
  
  return (
    <div>
      {/* --- Seção 1: Perfil da Loja --- */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Perfil da Loja</h3>
        <form onSubmit={handleUpdateShopProfile} className={styles.form}>
          
          <label className={styles.formField} htmlFor="shopName">
            <span>Nome da Barbearia:</span>
            <input 
              type="text" id="shopName" name="shopName"
              value={shopProfile.name}
              onChange={(e) => setShopProfile({...shopProfile, name: e.target.value})}
              required
            />
          </label>
          
          <label className={styles.formField} htmlFor="shopAddress">
            <span>Endereço:</span>
            <input 
              type="text" id="shopAddress" name="shopAddress"
              value={shopProfile.address}
              onChange={(e) => setShopProfile({...shopProfile, address: e.target.value})}
              required
            />
          </label>
          
          <label className={styles.formField} htmlFor="shopCity">
            <span>Cidade:</span>
            <input 
              type="text" id="shopCity" name="shopCity"
              value={shopProfile.cidade}
              onChange={(e) => setShopProfile({...shopProfile, cidade: e.target.value})}
              required
            />
          </label>
          
          <label className={styles.formField} htmlFor="shopDescription">
            <span>Descrição ("Sobre"):</span>
            <textarea
              id="shopDescription" name="shopDescription"
              value={shopProfile.description}
              onChange={(e) => setShopProfile({...shopProfile, description: e.target.value})}
              rows="4"
            />
          </label>
          
          <label className={styles.formField} htmlFor="newShopLogo">
            <span>Trocar Logo (opcional):</span>
            <img 
              src={shopProfile.logoUrl} 
              alt="Logo atual" 
              className={styles.logoPreview} 
            />
            <input 
              type="file" 
              id="newShopLogo" name="newShopLogo"
              accept="image/png, image/jpeg"
              onChange={(e) => setNewLogoFile(e.target.files[0])}
            />
          </label>
          
          <button type="submit" disabled={isUploading} className={styles.saveButton}>
            {isUploading ? 'Salvando Perfil...' : 'Salvar Perfil da Loja'}
          </button>
        </form>
      </div>

      {/* --- Seção 2: Configuração de Pagamento --- */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Configuração de Pagamento</h3>
        <p>Cole aqui seu <b>Access Token</b> do Mercado Pago para receber pagamentos.</p>
        <div className={styles.form}>
          <label className={styles.formField}>
            <span>Access Token (Produção):</span>
            <input 
              type="password" 
              value={mpAccessToken}
              onChange={(e) => setMpAccessToken(e.target.value)}
              placeholder="APP_USR-..."
            />
          </label>
          <button 
            onClick={handleSavePaymentKeys} 
            disabled={isLoadingPayment}
            className={styles.saveButton}
          >
            {isLoadingPayment ? 'Salvando...' : 'Salvar Credenciais'}
          </button>
        </div>
      </div>

      {/* --- Seção 3: Gerenciar Serviços --- */}
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

      {/* --- Seção 4: Gerenciar Profissionais --- */}
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
                <button 
                  className={styles.deleteButton}
                  onClick={() => handleRemoveProfessional(prof.id, prof.name, prof.userId)}
                  disabled={isLoadingPros}
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