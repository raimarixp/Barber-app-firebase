// src/components/AdminPanel/AdminPanel.jsx
// (COMPLETO - Com Tabs de Navegação, Dashboard e Estilo Premium Dark)

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/firebase-config';
import { 
  addDoc, collection, getDocs, doc, 
  updateDoc, deleteDoc,
  query, where, onSnapshot, Timestamp,
  getDoc, writeBatch, deleteField,
  setDoc
} from "firebase/firestore"; 
import { useShop } from '../../App.jsx';
import { toast } from 'sonner';
import { 
    Store, User, Clock, Scissors, UserPlus, FileText, Upload, 
    LayoutDashboard, DollarSign, Zap, TrendingDown, Users, CheckCircle
} from 'lucide-react';

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

  // --- Estados de Navegação e Carregamento ---
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'config', 'services', 'team'
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingPros, setIsLoadingPros] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  // --- Estados de Dados ---
  const [shopProfile, setShopProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [dashboardData, setDashboardData] = useState({
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      totalRevenue: 0,
      cancellationRate: 0
  });

  // --- Estados de Formulários e Uploads ---
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [isSavingKeys, setIsSavingKeys] = useState(false);


  // --- FUNÇÃO: DASHBOARD (Nova Lógica) ---
  const fetchDashboardData = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingDashboard(true);
    
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const appointmentsQuery = query(
            collection(db, "appointments"),
            where("barbershopId", "==", managedShopId),
            where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("startTime", "<=", Timestamp.fromDate(endOfMonth))
        );

        const snapshot = await getDocs(appointmentsQuery);
        
        let totalAppointments = 0;
        let completedAppointments = 0;
        let cancelledAppointments = 0;
        let totalRevenue = 0;

        // Requisição em lote para buscar preços dos serviços
        const batchServiceFetches = snapshot.docs.map(async (docSnap) => {
            const appData = docSnap.data();
            totalAppointments++;

            let servicePrice = 0;
            // Busca o preço do serviço
            const serviceDoc = await getDoc(doc(db, "services", appData.serviceId));
            if (serviceDoc.exists()) {
                servicePrice = serviceDoc.data().price || 0;
            }

            if (appData.status === 'completed') {
                completedAppointments++;
                totalRevenue += servicePrice;
            } else if (appData.status && appData.status.includes('cancelled')) {
                cancelledAppointments++;
            }
        });

        // Espera todos os cálculos de preço/receita terminarem
        await Promise.all(batchServiceFetches);
        
        const cancellationRate = totalAppointments > 0 
            ? ((cancelledAppointments / totalAppointments) * 100).toFixed(1) 
            : 0;

        setDashboardData({
            totalAppointments,
            completedAppointments,
            cancelledAppointments,
            totalRevenue,
            cancellationRate
        });

    } catch (error) {
        console.error("Erro ao buscar dados do Dashboard:", error);
        toast.error("Erro ao carregar dados do Dashboard.");
    } finally {
        setIsLoadingDashboard(false);
    }
  }, [managedShopId]);


  // --- LÓGICA DE CARREGAMENTO DE DADOS GERAIS (EXISTENTE) ---

  // 1. Busca os dados da loja
  const fetchShopProfile = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingProfile(true);
    try {
      const shopDocRef = doc(db, "barbershops", managedShopId);
      const docSnap = await getDoc(shopDocRef);
      if (docSnap.exists()) {
        setShopProfile(docSnap.data());
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

  // Efeito Principal que carrega tudo
  useEffect(() => {
    if (!managedShopId) return;
    
    fetchShopProfile();
    fetchServices();
    fetchDashboardData();
    
    // Inicia o "ouvinte" da lista de profissionais (em tempo real)
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
    
  }, [managedShopId, fetchShopProfile, fetchServices, fetchDashboardData]);

  // --- FUNÇÕES DE SALVAR / ATUALIZAR (EXISTENTE) ---

  // 1. Salva o Perfil da Loja
  const handleUpdateShopProfile = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    let newLogoUrl = shopProfile.logoUrl;

    try {
      if (newLogoFile) {
        const uploadPromise = uploadImageToCloudinary(newLogoFile);
        toast.promise(uploadPromise, {
          loading: 'Enviando nova logo...',
          success: 'Logo enviada com sucesso!',
          error: 'Erro ao enviar logo.',
        });
        newLogoUrl = await uploadPromise;
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
      
      toast.success("Perfil da loja atualizado com sucesso!");

    } catch (error) {
      console.error("Erro ao atualizar perfil: ", error);
      toast.error("Erro ao atualizar: " + error.message);
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
      toast.success("Serviço adicionado com sucesso!");
      setServiceName(''); 
      setServicePrice(''); 
      setServiceDuration('');
      fetchServices();
    } catch (error) { 
      console.error("Erro ao adicionar serviço: ", error); 
      toast.error("Erro: " + error.message);
    } finally { 
      setIsLoadingServices(false); 
    }
  };
  
  // 3. Convidar Profissional
  const handleInviteProfessional = async (e) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return toast.warning("Preencha nome e email.");
    setIsLoadingInvite(true);
    try {
      await addDoc(collection(db, "invites"), {
        name: inviteName,
        email: inviteEmail.toLowerCase(),
        barbershopId: managedShopId,
        status: "pending",
        createdAt: Timestamp.now()
      });
      toast.success(`Convite enviado para ${inviteName}!`);
      setInviteName('');
      setInviteEmail('');
    } catch (error) {
      console.error("Erro ao convidar: ", error);
      toast.error("Erro ao enviar convite.");
    } finally {
      setIsLoadingInvite(false);
    }
  };
  
  // 4. Remover Profissional
  const handleRemoveProfessional = async (profId, profName, userId) => {
    if (!window.confirm(`Tem certeza que quer remover "${profName}"?`)) return;

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
      
      toast.success(`${profName} foi removido.`);
      
    } catch (error) {
      console.error("Erro ao remover: ", error);
      toast.error("Erro ao remover profissional: " + error.message);
    }
  };

 // 5. Salvar Chaves de Pagamento
  const handleSavePaymentKeys = async () => {
    if (!mpAccessToken) return toast.warning("Por favor, cole o Access Token.");
    setIsSavingKeys(true);
    try {
      const batch = writeBatch(db);

      const keysDocRef = doc(db, "barbershops", managedShopId, "private", "keys");
      batch.set(keysDocRef, { accessToken: mpAccessToken }, { merge: true });

      const shopDocRef = doc(db, "barbershops", managedShopId);
      batch.update(shopDocRef, { onlinePaymentEnabled: true });
      
      await batch.commit();
      
      toast.success("Pagamento online ATIVADO!");
      setMpAccessToken("");
    } catch (error) {
      console.error("Erro ao salvar chaves:", error);
      toast.error("Erro ao salvar chaves.");
    } finally {
      setIsSavingKeys(false);
    }
  };
  
  // --- RENDERIZAÇÃO DE SEÇÕES ---

  // Componente de carregamento
  const LoadingSpinner = () => (
    <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div>
    </div>
  );

  // 1. Dashboard Section
  const renderDashboard = () => (
      <div className="space-y-6">
          <h3 className="text-xl font-heading font-semibold text-text-primary">Métricas do Mês Atual</h3>
          
          {isLoadingDashboard ? <LoadingSpinner /> : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Card Faturamento */}
                <div className="card-premium flex flex-col justify-between border-l-4 border-gold-main/70">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-medium text-text-secondary uppercase">Faturamento Bruto</p>
                        <DollarSign size={20} className="text-gold-main" />
                    </div>
                    <p className="text-3xl font-heading font-bold text-white">
                        R$ {dashboardData.totalRevenue.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-xs text-text-secondary mt-2">Agendamentos concluídos</p>
                </div>

                {/* Card Agendamentos */}
                <div className="card-premium flex flex-col justify-between border-l-4 border-blue-500/70">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-medium text-text-secondary uppercase">Agendamentos Totais</p>
                        <Zap size={20} className="text-blue-500" />
                    </div>
                    <p className="text-3xl font-heading font-bold text-white">
                        {dashboardData.totalAppointments}
                    </p>
                    <p className="text-xs text-text-secondary mt-2">Inclui pendentes e cancelados</p>
                </div>

                {/* Card Concluídos */}
                <div className="card-premium flex flex-col justify-between border-l-4 border-green-500/70">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-medium text-text-secondary uppercase">Serviços Concluídos</p>
                        <CheckCircle size={20} className="text-green-500" />
                    </div>
                    <p className="text-3xl font-heading font-bold text-white">
                        {dashboardData.completedAppointments}
                    </p>
                    <p className="text-xs text-text-secondary mt-2">Fazem parte do faturamento</p>
                </div>

                {/* Card Cancelados */}
                <div className="card-premium flex flex-col justify-between border-l-4 border-red-500/70">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-medium text-text-secondary uppercase">Taxa de Cancelamento</p>
                        <TrendingDown size={20} className="text-red-500" />
                    </div>
                    <p className="text-3xl font-heading font-bold text-white">
                        {dashboardData.cancellationRate}%
                    </p>
                    <p className="text-xs text-text-secondary mt-2">Agendamentos perdidos</p>
                </div>

            </div>
          )}
          
          <h3 className="text-xl font-heading font-semibold text-text-primary mt-8">Próximos Passos (Relatórios)</h3>
          <div className="card-premium bg-grafite-surface/50 border-dashed border flex items-center justify-center p-8 text-center text-text-secondary italic">
              Relatórios avançados (comissão, faturamento por barbeiro) serão implementados em breve.
          </div>
      </div>
  );

  // 2. Configuração Section (Perfil da Loja + Pagamento)
  const renderConfigSection = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Perfil da Loja --- */}
        <section className="card-premium lg:col-span-1">
          <div className="border-b border-grafite-border pb-4 mb-6">
            <h3 className="text-xl font-heading font-semibold text-text-primary flex items-center gap-2">
                <Store className="text-gold-main" size={20}/>
                Informações Públicas
            </h3>
            <p className="text-text-secondary text-sm mt-1">Gerencie a identidade e endereço da sua barbearia.</p>
          </div>
          
          <form onSubmit={handleUpdateShopProfile} className="space-y-4">
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopName">Nome da Barbearia:</label>
              <input type="text" id="shopName" value={shopProfile.name} onChange={(e) => setShopProfile({...shopProfile, name: e.target.value})} className="input-premium" required/>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopCity">Cidade:</label>
              <input type="text" id="shopCity" value={shopProfile.cidade} onChange={(e) => setShopProfile({...shopProfile, cidade: e.target.value})} className="input-premium" required/>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopAddress">Endereço:</label>
              <input type="text" id="shopAddress" value={shopProfile.address} onChange={(e) => setShopProfile({...shopProfile, address: e.target.value})} className="input-premium" required/>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopDescription">Descrição ("Sobre"):</label>
                <textarea id="shopDescription" value={shopProfile.description} onChange={(e) => setShopProfile({...shopProfile, description: e.target.value})} rows="3" className="input-premium resize-none"/>
            </div>

            <div className="space-y-1">
                <span className="text-xs font-medium text-text-secondary ml-1">Trocar Logo (opcional):</span>
                <div className="flex items-center gap-4 bg-grafite-main p-3 rounded-lg border border-grafite-border border-dashed">
                    <img src={shopProfile.logoUrl} alt="Logo atual" className="w-16 h-16 object-cover rounded-full border-2 border-gold-main"/>
                    <input type="file" id="newShopLogo" accept="image/png, image/jpeg" onChange={(e) => setNewLogoFile(e.target.files[0])}
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gold-dim file:text-gold-main hover:file:bg-gold-dim/80 cursor-pointer"
                    />
                </div>
            </div>
            
            <button type="submit" disabled={isUploading} className="btn-primary w-full h-10 mt-6">
              {isUploading ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </form>
        </section>

        {/* --- Configuração de Pagamento --- */}
        <section className="card-premium lg:col-span-1">
          <div className="border-b border-grafite-border pb-4 mb-6">
            <h3 className="text-xl font-heading font-semibold text-text-primary flex items-center gap-2">
                <DollarSign className="text-green-500" size={20}/>
                Configuração de Pagamento
            </h3>
            <p className="text-text-secondary text-sm mt-1">Configure o Mercado Pago para pagamentos online.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1">Access Token (Produção):</label>
              <input type="password" value={mpAccessToken} onChange={(e) => setMpAccessToken(e.target.value)} placeholder="APP_USR-..." className="input-premium font-mono text-sm"/>
            </div>
            
            <div className="flex items-center gap-3 bg-grafite-main p-3 rounded-lg border border-grafite-border">
                <input 
                    type="checkbox" 
                    id="requirePayment"
                    checked={shopProfile.requirePayment || false}
                    onChange={(e) => setShopProfile({...shopProfile, requirePayment: e.target.checked})}
                    className="w-4 h-4 rounded border-grafite-border bg-grafite-surface text-gold-main focus:ring-gold-main/50 accent-gold-main"
                />
                <label htmlFor="requirePayment" className="text-sm text-text-primary cursor-pointer">
                    Exigir pagamento online no agendamento (Desativa a opção "Pagar na Loja" para clientes online).
                </label>
            </div>

            <button onClick={handleSavePaymentKeys} disabled={isSavingKeys} className="btn-primary w-full h-10">
              {isSavingKeys ? 'Salvando Credenciais...' : 'Salvar Credenciais'}
            </button>

            {shopProfile.onlinePaymentEnabled && (
                <div className="p-3 bg-green-950/20 border border-green-500/50 rounded-lg text-green-400 text-sm flex items-center gap-2">
                    <CheckCircle size={16} /> Pagamento Online Habilitado.
                </div>
            )}
          </div>
        </section>
    </div>
  );
  
  // 3. Serviços Section
  const renderServicesSection = () => (
    <section className="card-premium">
        <div className="border-b border-grafite-border pb-4 mb-6">
          <h3 className="text-xl font-heading font-semibold text-text-primary flex items-center gap-2">
              <Scissors className="text-gold-main" size={20}/>
              Menu de Serviços
          </h3>
          <p className="text-text-secondary text-sm mt-1">Adicione ou remova os serviços que sua barbearia oferece.</p>
        </div>

        <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 bg-grafite-surface p-4 rounded-lg border border-grafite-border">
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-medium text-text-secondary ml-1">Nome do Serviço</label>
            <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Ex: Corte Degradê" className="input-premium text-sm py-2" required/>
          </div>
          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-medium text-text-secondary ml-1">Preço (R$)</label>
            <input type="number" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="0.00" className="input-premium text-sm py-2" required/>
          </div>
          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-medium text-text-secondary ml-1">Duração (min)</label>
            <input type="number" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} placeholder="30" className="input-premium text-sm py-2" required/>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button type="submit" disabled={isLoadingServices} className="btn-primary w-full h-[38px] flex items-center justify-center">
              Adicionar
            </button>
          </div>
        </form>
        
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Serviços Ativos</h4>
          {isLoadingServices ? <LoadingSpinner /> : (
            services.length === 0 ? (
              <p className="text-text-secondary italic text-center py-4 bg-grafite-main rounded-lg border border-grafite-border border-dashed">Nenhum serviço cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(s => (
                  <div key={s.id} className="bg-grafite-main border border-grafite-border p-4 rounded-lg flex justify-between items-center hover:border-gold-main/50 transition-colors">
                    <div>
                      <strong className="block text-text-primary">{s.name}</strong>
                      <span className="text-gold-main text-sm font-medium">R$ {s.price.toFixed(2)}</span>
                      <span className="text-text-secondary text-xs ml-2">• {s.duration} min</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </section>
  );

  // 4. Equipe Section
  const renderTeamSection = () => (
    <section className="card-premium">
        <div className="border-b border-grafite-border pb-4 mb-6">
          <h3 className="text-xl font-heading font-semibold text-text-primary flex items-center gap-2">
              <Users className="text-gold-main" size={20}/>
              Gerenciar Equipe
          </h3>
          <p className="text-text-secondary text-sm mt-1">Convide e gerencie os profissionais vinculados à sua loja.</p>
        </div>

        <div className="bg-grafite-surface border border-grafite-border rounded-lg p-6 mb-8">
          <h4 className="text-lg font-heading font-semibold text-text-primary mb-4 flex items-center gap-2">
            <UserPlus size={20} className="text-gold-main"/>
            Convidar Novo Profissional
          </h4>
          <form onSubmit={handleInviteProfessional} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:flex-1 space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1">Nome</label>
              <input type="text" id="inviteName" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome do profissional" className="input-premium" required/>
            </div>
            <div className="w-full md:flex-1 space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1">E-mail</label>
              <input type="email" id="inviteEmail" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" className="input-premium" required/>
            </div>
            <button type="submit" disabled={isLoadingInvite} className="btn-primary w-full md:w-auto min-w-[150px] h-[46px] text-sm">
              {isLoadingInvite ? 'Enviando...' : 'Enviar Convite'}
            </button>
          </form>
        </div>
        
        <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Profissionais Ativos</h4>
        {isLoadingPros ? <LoadingSpinner /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {professionals.length === 0 && (
               <p className="col-span-full text-center text-text-secondary py-8 bg-grafite-main rounded-lg border border-grafite-border border-dashed">
                 Nenhum profissional ativo.
               </p>
            )}
            {professionals.map(prof => (
              <div key={prof.id} className="bg-grafite-main border border-grafite-border p-5 rounded-lg flex flex-col justify-between gap-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-grafite-surface flex items-center justify-center text-gold-main font-bold border border-grafite-border">
                      {prof.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <p className="font-bold text-text-primary">{prof.name}</p>
                     <p className="text-xs text-text-secondary">Barbeiro</p>
                   </div>
                </div>
                <button 
                  className="w-full py-2 px-4 rounded border border-red-900/50 text-red-400 text-sm hover:bg-red-900/20 transition-colors"
                  onClick={() => handleRemoveProfessional(prof.id, prof.name, prof.userId)}
                  disabled={isLoadingPros}
                >
                  Remover da Equipe
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
  );

  // Se o perfil da loja não foi carregado
  if (isLoadingProfile || !shopProfile) {
    return <LoadingSpinner />;
  }
  
  // --- RENDERIZAÇÃO PRINCIPAL DO PAINEL ADMIN ---
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 animate-fade-in">
      
      <h2 className="text-3xl font-heading font-bold text-gold-main mb-6">Administração da Barbearia</h2>
      
      {/* --- Navegação por Abas --- */}
      <div className="flex p-1 bg-grafite-card border border-grafite-border rounded-xl mb-8 overflow-x-auto">
        {[{id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard}, {id: 'config', label: 'Configurações', Icon: FileText}, {id: 'services', label: 'Serviços', Icon: Scissors}, {id: 'team', label: 'Equipe', Icon: Users}].map(({id, label, Icon}) => (
            <button 
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-300
                    ${activeTab === id ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-text-primary'}`
                }
            >
                <Icon size={18} />
                {label}
            </button>
        ))}
      </div>

      {/* --- Conteúdo das Abas --- */}
      <div className="min-h-[500px]">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'config' && renderConfigSection()}
          {activeTab === 'services' && renderServicesSection()}
          {activeTab === 'team' && renderTeamSection()}
      </div>
    </div>
  );
}

export default AdminPanel;