// src/components/AdminPanel/AdminPanel.jsx
// (VERSÃO FINAL COMPLETA - Com todas as funcionalidades incluindo Pacotes e otimização de carregamento)

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/firebase-config';
import { 
  addDoc, collection, getDocs, doc, 
  updateDoc, deleteDoc,
  query, where, onSnapshot, Timestamp,
  getDoc, writeBatch, deleteField, orderBy
} from "firebase/firestore"; 
import { useShop } from '../../App.jsx';
import { toast } from 'sonner';
import { 
    Store, User, Clock, Scissors, UserPlus, FileText, Upload, 
    LayoutDashboard, DollarSign, Zap, TrendingDown, Users,
    CheckCircle, Package, ShoppingBag, Trash2, Plus, Palette, 
    Link as LinkIcon, ListChecks, ArrowLeft, Image as ImageIcon, Megaphone
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

function AdminPanel({ forcedShopId, onBack }) {
  const { managedShopId: contextShopId } = useShop();
  const managedShopId = forcedShopId || contextShopId;

  // --- Estados de Navegação ---
  const [activeTab, setActiveTab] = useState('dashboard'); 
  
  // --- Loadings ---
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingPros, setIsLoadingPros] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  // --- Dados ---
  const [shopProfile, setShopProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]); 
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [dashboardData, setDashboardData] = useState({
      totalAppointments: 0, completedAppointments: 0, 
      cancelledAppointments: 0, totalRevenue: 0, cancellationRate: 0
  });

  // --- Formulários ---
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form Serviços
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('');
  const [serviceImageFile, setServiceImageFile] = useState(null);
  
  // Form Equipe
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  
  // Form Pagamento
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  // Form Produtos
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');
  const [productImageFile, setProductImageFile] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  
  // Form Pacotes
  const [packageName, setPackageName] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [packageDurationDays, setPackageDurationDays] = useState('');
  const [packageCutsCount, setPackageCutsCount] = useState('');
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // --- FUNÇÕES DE BUSCA (Callbacks) ---
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

        snapshot.forEach(docSnap => {
            const appData = docSnap.data();
            totalAppointments++;
            
            if (appData.status === 'completed') {
                completedAppointments++;
                totalRevenue += appData.totalPrice || 0; 
            } else if (appData.status && appData.status.includes('cancelled')) {
                cancelledAppointments++;
            }
        });
        
        const cancellationRate = totalAppointments > 0 
            ? ((cancelledAppointments / totalAppointments) * 100).toFixed(1) 
            : 0;

        setDashboardData({ totalAppointments, completedAppointments, cancelledAppointments, totalRevenue, cancellationRate });

    } catch (error) { 
        console.error("Erro Dashboard:", error);
        toast.error("Erro ao carregar dados do dashboard");
    } finally { 
        setIsLoadingDashboard(false); 
    }
  }, [managedShopId]);

  const fetchSalesHistory = useCallback(async () => {
      if (!managedShopId) return;
      setIsLoadingSales(true);
      try {
          let q;
          try {
             q = query(
                collection(db, "appointments"), 
                where("barbershopId", "==", managedShopId),
                orderBy("createdAt", "desc")
             );
          } catch (e) {
             q = query(collection(db, "appointments"), where("barbershopId", "==", managedShopId));
          }
          
          const querySnapshot = await getDocs(q);
          const sales = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(app => (app.orderItems && app.orderItems.length > 0) || app.totalPrice > 0);
            
          setSalesHistory(sales);
      } catch (error) {
          console.error("Erro ao buscar vendas:", error);
          toast.error("Erro ao carregar histórico de vendas");
      } finally {
          setIsLoadingSales(false);
      }
  }, [managedShopId]);

  const fetchClientsCRM = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingClients(true);
    try {
        const q = query(collection(db, "appointments"), where("barbershopId", "==", managedShopId));
        const snapshot = await getDocs(q);
        
        const clientsMap = {};

        snapshot.forEach(doc => {
            const app = doc.data();
            const clientId = app.clientId || `manual_${app.clientNameManual}`; 
            const clientName = app.clientName || app.clientNameManual || 'Cliente';
            
            if (!clientsMap[clientId]) {
                clientsMap[clientId] = {
                    id: clientId,
                    name: clientName,
                    phone: app.clientPhone || '',
                    totalSpent: 0,
                    visitCount: 0,
                    lastVisit: null
                };
            }
            
            const client = clientsMap[clientId];
            
            if (app.status === 'completed') {
                client.totalSpent += (app.totalPrice || 0);
                client.visitCount += 1;
            }
            
            const appDate = app.startTime.toDate();
            if (!client.lastVisit || appDate > client.lastVisit) {
                client.lastVisit = appDate;
            }
        });

        const clientsArray = Object.values(clientsMap).sort((a, b) => b.lastVisit - a.lastVisit);
        setClients(clientsArray);

    } catch (error) {
        console.error("Erro CRM:", error);
        toast.error("Erro ao carregar clientes.");
    } finally {
        setIsLoadingClients(false);
    }
  }, [managedShopId]);

  const fetchPackages = useCallback(async () => {
      if (!managedShopId) return;
      setIsLoadingPackages(true);
      try {
          const q = query(collection(db, "packages"), where("barbershopId", "==", managedShopId));
          const snapshot = await getDocs(q);
          setPackages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { 
          console.error("Erro pacotes:", error);
          toast.error("Erro ao carregar pacotes");
      } finally { 
          setIsLoadingPackages(false); 
      }
  }, [managedShopId]);

  const fetchShopProfile = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingProfile(true);
    try {
      const docSnap = await getDoc(doc(db, "barbershops", managedShopId));
      if (docSnap.exists()) setShopProfile(docSnap.data());
    } catch (error) { 
        console.error("Erro perfil:", error);
        toast.error("Erro ao carregar perfil da barbearia");
    } finally { 
        setIsLoadingProfile(false); 
    }
  }, [managedShopId]);

  const fetchServices = useCallback(async () => {
    if (!managedShopId) return; 
    setIsLoadingServices(true);
    try {
      const q = query(collection(db, "services"), where("barbershopId", "==", managedShopId));
      const snapshot = await getDocs(q);
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { 
        console.error("Erro serviços:", error);
        toast.error("Erro ao carregar serviços");
    } finally { 
        setIsLoadingServices(false); 
    }
  }, [managedShopId]);

  const fetchProducts = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingProducts(true);
    try {
        const q = query(collection(db, "products"), where("barbershopId", "==", managedShopId));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { 
        console.error("Erro produtos:", error);
        toast.error("Erro ao carregar produtos");
    } finally { 
        setIsLoadingProducts(false); 
    }
  }, [managedShopId]);

  // --- EFEITO 1: CARREGAMENTO GLOBAL (Só roda ao abrir a loja) ---
  useEffect(() => {
    if (!managedShopId) return;
    
    // Carrega dados base que não mudam entre abas
    fetchShopProfile();
    fetchServices();
    fetchDashboardData();
    fetchProducts();
    fetchPackages();

    // Listener em tempo real de profissionais
    setIsLoadingPros(true);
    const unsubscribe = onSnapshot(
        query(collection(db, "professionals"), where("barbershopId", "==", managedShopId)), 
        (snap) => {
            setProfessionals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoadingPros(false);
        },
        (error) => {
            console.error("Erro profissionais:", error);
            setIsLoadingPros(false);
        }
    );
    return () => unsubscribe();
  }, [managedShopId]); // Dependência ÚNICA do ID da loja

  // --- EFEITO 2: CARREGAMENTO POR ABA (Só roda ao trocar de aba) ---
  useEffect(() => {
    if (!managedShopId) return;
    
    // Carrega dados pesados apenas se a aba for selecionada
    if (activeTab === 'sales') fetchSalesHistory();
    if (activeTab === 'clients') fetchClientsCRM();
    
  }, [managedShopId, activeTab]); 

  // --- AÇÕES (Handlers) ---
  const handleResgateZap = (client) => {
      if(!client.phone) return toast.error("Cliente sem telefone cadastrado.");
      const message = `Olá ${client.name.split(' ')[0]}! 💈%0A%0ASentimos sua falta aqui na ${shopProfile?.name || 'Barbearia'}.%0A%0AQue tal dar um trato no visual essa semana? Acesse nosso app para agendar! ✂️`;
      window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const handleUpdateShopProfile = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    let newLogoUrl = shopProfile.logoUrl;
    try {
      if (newLogoFile) {
        const uploadPromise = uploadImageToCloudinary(newLogoFile);
        toast.promise(uploadPromise, { 
            loading: 'Enviando logo...', 
            success: 'Logo atualizada com sucesso!', 
            error: 'Erro ao fazer upload da logo' 
        });
        newLogoUrl = await uploadPromise;
        setNewLogoFile(null);
      }
      await updateDoc(doc(db, "barbershops", managedShopId), {
        name: shopProfile.name,
        phone: shopProfile.phone,
        address: shopProfile.address,
        cidade: shopProfile.cidade,
        description: shopProfile.description,
        logoUrl: newLogoUrl,
        brandPrimaryColor: shopProfile.brandPrimaryColor || '#D4AF37',
        subdomain: shopProfile.subdomain || '',
        requirePayment: shopProfile.requirePayment || false
      });
      toast.success("Perfil da barbearia atualizado com sucesso!");
    } catch (error) { 
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao salvar alterações"); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!serviceName || !servicePrice || !serviceDuration) return toast.warning("Preencha todos os campos do serviço");
    setIsLoadingServices(true);
    try {
      let imgUrl = '';
      if(serviceImageFile) {
          imgUrl = await uploadImageToCloudinary(serviceImageFile);
      }

      await addDoc(collection(db, "services"), {
        name: serviceName,
        price: Number(servicePrice),
        duration: Number(serviceDuration),
        barbershopId: managedShopId,
        imageUrl: imgUrl || ''
      });
      toast.success("Serviço criado com sucesso!");
      setServiceName(''); 
      setServicePrice(''); 
      setServiceDuration(''); 
      setServiceImageFile(null);
      fetchServices();
    } catch (error) { 
        console.error("Erro ao criar serviço:", error);
        toast.error("Erro ao criar serviço"); 
    } finally { 
        setIsLoadingServices(false); 
    }
  };
  
  const handleInviteProfessional = async (e) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return toast.warning("Preencha nome e email do profissional");
    setIsLoadingInvite(true);
    try {
      await addDoc(collection(db, "invites"), {
        name: inviteName, 
        email: inviteEmail.toLowerCase(), 
        barbershopId: managedShopId, 
        status: "pending", 
        createdAt: Timestamp.now()
      });
      toast.success("Convite enviado com sucesso!");
      setInviteName(''); 
      setInviteEmail('');
    } catch (error) { 
        console.error("Erro ao enviar convite:", error);
        toast.error("Erro ao enviar convite"); 
    } finally { 
        setIsLoadingInvite(false); 
    }
  };
  
  const handleRemoveProfessional = async (id, name, uid) => {
    if (!window.confirm(`Tem certeza que deseja remover ${name} da equipe?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "professionals", id));
      batch.update(doc(db, "roles", uid), { role: "client", worksAtShopId: deleteField() });
      await batch.commit();
      toast.success("Profissional removido com sucesso");
    } catch (e) { 
        console.error("Erro ao remover profissional:", e);
        toast.error("Erro ao remover profissional"); 
    }
  };

  const handleSavePaymentKeys = async () => {
    if (!mpAccessToken) return toast.warning("Informe o Access Token do Mercado Pago");
    setIsSavingKeys(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "barbershops", managedShopId, "private", "keys"), { accessToken: mpAccessToken }, { merge: true });
      batch.update(doc(db, "barbershops", managedShopId), { onlinePaymentEnabled: true });
      await batch.commit();
      toast.success("Configurações de pagamento salvas com sucesso!");
      setMpAccessToken("");
    } catch (e) { 
        console.error("Erro ao salvar chaves:", e);
        toast.error("Erro ao salvar configurações"); 
    } finally { 
        setIsSavingKeys(false); 
    }
  };

  const handleAddProduct = async (e) => {
      e.preventDefault();
      if (!productName || !productPrice || !productStock) return toast.warning("Preencha todos os campos do produto");
      setIsSavingProduct(true);
      try {
          let img = '';
          if (productImageFile) img = await uploadImageToCloudinary(productImageFile);
          
          await addDoc(collection(db, "products"), {
              name: productName, 
              price: Number(productPrice), 
              stock: Number(productStock),
              imageUrl: img || 'https://placehold.co/150?text=Produto', 
              barbershopId: managedShopId, 
              createdAt: Timestamp.now()
          });
          
          toast.success("Produto cadastrado com sucesso!");
          setProductName(''); 
          setProductPrice(''); 
          setProductStock(''); 
          setProductImageFile(null);
          fetchProducts();
      } catch (e) { 
          console.error("Erro ao cadastrar produto:", e);
          toast.error("Erro ao cadastrar produto"); 
      } finally { 
          setIsSavingProduct(false); 
      }
  };

  const handleDeleteProduct = async (id) => {
      if(!window.confirm("Tem certeza que deseja excluir este produto?")) return;
      try { 
          await deleteDoc(doc(db, "products", id)); 
          toast.success("Produto excluído com sucesso"); 
          fetchProducts(); 
      } catch(e){ 
          console.error("Erro ao excluir produto:", e);
          toast.error("Erro ao excluir produto"); 
      }
  };
  
  const handleAddPackage = async (e) => {
      e.preventDefault();
      if (!packageName || !packagePrice || !packageCutsCount || !packageDurationDays) return toast.warning("Preencha todos os campos do pacote");
      setIsSavingPackage(true);
      try {
          await addDoc(collection(db, "packages"), {
              name: packageName, 
              price: Number(packagePrice), 
              cuts: Number(packageCutsCount), 
              durationDays: Number(packageDurationDays), 
              barbershopId: managedShopId, 
              createdAt: Timestamp.now()
          });
          toast.success("Pacote criado com sucesso!");
          setPackageName(''); 
          setPackagePrice(''); 
          setPackageCutsCount(''); 
          setPackageDurationDays(''); 
          fetchPackages();
      } catch (e) { 
          console.error("Erro ao criar pacote:", e);
          toast.error("Erro ao salvar pacote"); 
      } finally { 
          setIsSavingPackage(false); 
      }
  };

  const handleDeletePackage = async (id) => {
      if(!window.confirm("Tem certeza que deseja excluir este pacote?")) return;
      try { 
          await deleteDoc(doc(db, "packages", id)); 
          toast.success("Pacote excluído com sucesso!"); 
          fetchPackages(); 
      } catch(e){ 
          console.error("Erro ao excluir pacote:", e);
          toast.error("Erro ao excluir pacote"); 
      }
  };

  // --- RENDERIZAÇÃO ---

  const Loading = () => (
    <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div>
    </div>
  );

  // 1. Dashboard
  const renderDashboard = () => (
      <div className="space-y-6">
          <h3 className="text-xl font-heading font-semibold text-text-primary">Visão Geral do Mês</h3>
          {isLoadingDashboard ? <Loading /> : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card-premium border-l-4 border-gold-main/70 p-4">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs uppercase text-text-secondary">Receita Total</span>
                        <DollarSign size={18} className="text-gold-main"/>
                    </div>
                    <p className="text-2xl font-bold text-white">R$ {dashboardData.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="card-premium border-l-4 border-blue-500/70 p-4">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs uppercase text-text-secondary">Agendamentos</span>
                        <Zap size={18} className="text-blue-500"/>
                    </div>
                    <p className="text-2xl font-bold text-white">{dashboardData.totalAppointments}</p>
                </div>
                <div className="card-premium border-l-4 border-green-500/70 p-4">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs uppercase text-text-secondary">Concluídos</span>
                        <CheckCircle size={18} className="text-green-500"/>
                    </div>
                    <p className="text-2xl font-bold text-white">{dashboardData.completedAppointments}</p>
                </div>
                <div className="card-premium border-l-4 border-red-500/70 p-4">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs uppercase text-text-secondary">Cancelamento</span>
                        <TrendingDown size={18} className="text-red-500"/>
                    </div>
                    <p className="text-2xl font-bold text-white">{dashboardData.cancellationRate}%</p>
                </div>
            </div>
          )}
      </div>
  );

  // 2. Vendas
  const renderSalesTab = () => (
      <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-grafite-border pb-4">
              <h3 className="text-xl font-heading font-semibold text-text-primary flex items-center gap-2">
                  <ListChecks className="text-gold-main" size={20}/> Histórico de Pedidos
              </h3>
              <button onClick={fetchSalesHistory} className="text-xs text-gold-main hover:underline">Atualizar</button>
          </div>
          
          {isLoadingSales ? <Loading /> : salesHistory.length === 0 ? (
              <p className="text-center text-text-secondary italic py-10 card-premium">Nenhuma venda registrada este mês.</p>
          ) : (
              <div className="space-y-4">
                  {salesHistory.map(sale => (
                      <div key={sale.id} className="card-premium p-4 flex flex-col md:flex-row justify-between gap-4 hover:border-gold-main/30 transition-colors">
                          <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                  <span className="text-gold-main font-bold font-mono text-sm">#{sale.id.slice(0,6)}</span>
                                  <span className="text-xs text-text-secondary">
                                      {sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleString('pt-BR') : 'Data desconhecida'}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                                      sale.status === 'completed' ? 'border-green-500 text-green-400' : 'border-blue-500 text-blue-400'
                                  }`}>
                                      {sale.status === 'completed' ? 'Concluído' : sale.status}
                                  </span>
                              </div>
                              
                              <div className="space-y-1 pl-2 border-l-2 border-grafite-border">
                                  {sale.orderItems && sale.orderItems.map((item, idx) => (
                                      <div key={idx} className="text-sm flex items-center justify-between text-text-primary pr-4">
                                          <div className="flex items-center gap-2">
                                              <span className="text-text-secondary">
                                                  {item.type === 'service' ? <Scissors size={12}/> : <Package size={12}/>}
                                              </span>
                                              <span>{item.qty}x {item.name}</span>
                                          </div>
                                          <span className="text-xs text-text-secondary font-mono">R$ {item.price.toFixed(2)}</span>
                                      </div>
                                  ))}
                                  {!sale.orderItems && <p className="text-xs text-text-secondary italic">Agendamento simples</p>}
                              </div>
                          </div>
                          
                          <div className="flex flex-col items-end justify-center border-t md:border-t-0 md:border-l border-grafite-border pt-4 md:pt-0 md:pl-6 min-w-[140px]">
                              <span className="text-xs text-text-secondary uppercase tracking-wider">Total</span>
                              <span className="text-xl font-bold text-white">R$ {(sale.totalPrice || 0).toFixed(2)}</span>
                              <span className="text-[10px] text-text-secondary mt-1 px-2 py-1 bg-grafite-main rounded border border-grafite-border">
                                  {sale.paymentMethod?.includes('online') ? 'Pago Online' : 'Na Loja'}
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
  );

  // 3. Clientes CRM
  const renderClientsCRM = () => (
    <section className="card-premium">
        <div className="flex justify-between items-center mb-6 border-b border-grafite-border pb-4">
            <h3 className="text-xl font-heading font-semibold text-text-primary flex items-center gap-2">
                <Megaphone className="text-gold-main" size={20}/> Gestão de Clientes (CRM)
            </h3>
            <button onClick={fetchClientsCRM} className="text-xs text-gold-main hover:underline">Atualizar</button>
        </div>

        {isLoadingClients ? <Loading /> : clients.length === 0 ? (
            <p className="text-center text-text-secondary italic py-10">Nenhum histórico de clientes ainda.</p>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-xs text-text-secondary border-b border-grafite-border">
                            <th className="pb-2 pl-2">Cliente</th>
                            <th className="pb-2">Última Visita</th>
                            <th className="pb-2">Frequência</th>
                            <th className="pb-2">Total Gasto</th>
                            <th className="pb-2 text-right pr-2">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {clients.map(client => {
                            const daysSince = Math.floor((new Date() - client.lastVisit) / (1000 * 60 * 60 * 24));
                            const isInactive = daysSince > 30;

                            return (
                                <tr key={client.id} className="border-b border-grafite-border/30 hover:bg-grafite-surface transition-colors group">
                                    <td className="py-3 pl-2">
                                        <p className="font-bold text-white">{client.name}</p>
                                        <p className="text-xs text-text-secondary">{client.phone || 'Sem telefone cadastrado'}</p>
                                    </td>
                                    <td className="py-3">
                                        <span className={`text-xs px-2 py-1 rounded border ${
                                            isInactive ? 'bg-red-950/30 text-red-400 border-red-900/50' : 'bg-green-950/30 text-green-400 border-green-900/50'
                                        }`}>
                                            {daysSince} dias atrás
                                        </span>
                                    </td>
                                    <td className="py-3 text-text-primary">{client.visitCount} visitas</td>
                                    <td className="py-3 text-gold-main font-bold">R$ {client.totalSpent.toFixed(2)}</td>
                                    <td className="py-3 text-right pr-2">
                                        {client.phone && (
                                            <button 
                                                onClick={() => handleResgateZap(client)}
                                                className="text-xs bg-gold-dim text-gold-main px-3 py-1.5 rounded hover:bg-gold-main hover:text-grafite-main transition-colors flex items-center gap-1 ml-auto"
                                            >
                                                <Megaphone size={12}/> Resgatar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
    </section>
  );

  // 4. Configurações
  const renderConfigSection = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-premium">
          <div className="border-b border-grafite-border pb-4 mb-6">
             <h3 className="text-xl font-heading font-semibold text-text-primary mb-1 flex items-center gap-2">
                 <Store className="text-gold-main" size={20}/> Identidade da Loja
             </h3>
             <p className="text-xs text-text-secondary">Personalize a aparência e informações da sua barbearia</p>
          </div>
          
          <form onSubmit={handleUpdateShopProfile} className="space-y-4">
            <div className="space-y-1">
                <label htmlFor="s_name" className="text-xs text-text-secondary">Nome da Barbearia *</label>
                <input 
                    id="s_name" 
                    type="text" 
                    value={shopProfile.name} 
                    onChange={(e) => setShopProfile({...shopProfile, name: e.target.value})} 
                    className="input-premium text-sm" 
                    required
                />
            </div>
            <div className="space-y-1">
                <label htmlFor="s_phone" className="text-xs text-text-secondary">WhatsApp da Loja</label>
                <input 
                    id="s_phone" 
                    type="tel" 
                    value={shopProfile.phone || ''} 
                    onChange={(e) => setShopProfile({...shopProfile, phone: e.target.value})} 
                    className="input-premium text-sm"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label htmlFor="s_city" className="text-xs text-text-secondary">Cidade</label>
                    <input 
                        id="s_city" 
                        type="text" 
                        value={shopProfile.cidade} 
                        onChange={(e) => setShopProfile({...shopProfile, cidade: e.target.value})} 
                        className="input-premium text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor="s_addr" className="text-xs text-text-secondary">Endereço</label>
                    <input 
                        id="s_addr" 
                        type="text" 
                        value={shopProfile.address} 
                        onChange={(e) => setShopProfile({...shopProfile, address: e.target.value})} 
                        className="input-premium text-sm"
                    />
                </div>
            </div>
            <div className="space-y-1">
                <label htmlFor="s_desc" className="text-xs text-text-secondary">Descrição</label>
                <textarea 
                    id="s_desc" 
                    value={shopProfile.description} 
                    onChange={(e) => setShopProfile({...shopProfile, description: e.target.value})} 
                    className="input-premium resize-none text-sm" 
                    rows="2"
                />
            </div>
            
            {/* Campos Whitelabel */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-grafite-border mt-4">
                <div className="space-y-1">
                    <label htmlFor="s_color" className="text-xs text-text-secondary flex items-center gap-1">
                        <Palette size={12}/> Cor da Marca
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="color" 
                            value={shopProfile.brandPrimaryColor || '#D4AF37'} 
                            onChange={(e) => setShopProfile({...shopProfile, brandPrimaryColor: e.target.value})} 
                            className="h-9 w-9 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <input 
                            id="s_color"
                            type="text" 
                            value={shopProfile.brandPrimaryColor || '#D4AF37'} 
                            onChange={(e) => setShopProfile({...shopProfile, brandPrimaryColor: e.target.value})} 
                            className="input-premium text-xs h-9"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label htmlFor="s_domain" className="text-xs text-text-secondary flex items-center gap-1">
                        <LinkIcon size={12}/> Subdomínio
                    </label>
                    <div className="flex items-center">
                        <span className="text-xs text-text-secondary mr-1">app.</span>
                        <input 
                            id="s_domain"
                            type="text" 
                            value={shopProfile.subdomain || ''} 
                            onChange={(e) => setShopProfile({...shopProfile, subdomain: e.target.value.toLowerCase()})} 
                            className="input-premium text-xs h-9" 
                            placeholder="viking"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-1 mt-2">
                <label className="text-xs text-text-secondary">Logo da Loja</label>
                <div className="flex items-center gap-4 bg-grafite-main p-2 rounded-lg border border-grafite-border border-dashed">
                    <img src={shopProfile.logoUrl} alt="Logo atual" className="w-10 h-10 rounded-full object-cover border border-gold-main"/>
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => setNewLogoFile(e.target.files[0])} 
                        className="text-xs text-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-gold-dim file:text-gold-main cursor-pointer"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isUploading} 
                className="btn-primary w-full h-10 mt-4 text-sm font-bold tracking-wide uppercase"
            >
                {isUploading ? 'Salvando...' : 'Salvar Identidade'}
            </button>
          </form>
        </section>

        {/* Pagamento */}
        <section className="card-premium h-fit">
          <div className="border-b border-grafite-border pb-4 mb-6">
             <h3 className="text-xl font-heading font-semibold text-text-primary mb-1 flex items-center gap-2">
                 <DollarSign className="text-green-500" size={20}/> Configurações Financeiras
             </h3>
             <p className="text-xs text-text-secondary">Integração com Mercado Pago para pagamentos online</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs text-text-secondary">Access Token (Produção)</label>
                <input 
                    type="password" 
                    value={mpAccessToken} 
                    onChange={(e) => setMpAccessToken(e.target.value)} 
                    placeholder="APP_USR-..." 
                    className="input-premium font-mono text-xs h-9"
                />
            </div>
            <div className="flex items-start gap-3 bg-grafite-main p-3 rounded-lg border border-grafite-border">
                <input 
                    type="checkbox" 
                    id="requirePayment" 
                    checked={shopProfile.requirePayment || false} 
                    onChange={(e) => setShopProfile({...shopProfile, requirePayment: e.target.checked})} 
                    className="mt-1 accent-gold-main"
                />
                <label htmlFor="requirePayment" className="text-xs text-text-primary cursor-pointer">
                    Exigir pagamento online no agendamento
                </label>
            </div>
            <button 
                onClick={handleSavePaymentKeys} 
                disabled={isSavingKeys} 
                className="btn-primary w-full h-9 text-xs font-bold uppercase"
            >
                {isSavingKeys ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </section>
    </div>
  );

  // 5. Serviços
  const renderServices = () => (
    <section className="card-premium">
        <div className="flex justify-between items-center mb-6 border-b border-grafite-border pb-4">
            <h3 className="text-xl font-bold text-text-primary flex gap-2">
                <Scissors className="text-gold-main"/> Serviços
            </h3>
        </div>
        <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 bg-grafite-surface p-4 rounded-lg border border-grafite-border">
             <div className="md:col-span-4">
                 <label htmlFor="svc_name" className="text-xs font-medium text-text-secondary ml-1">Nome do Serviço *</label>
                 <input 
                     id="svc_name" 
                     type="text" 
                     value={serviceName} 
                     onChange={(e)=>setServiceName(e.target.value)} 
                     placeholder="Ex: Corte Social" 
                     className="input-premium text-sm" 
                     required
                 />
             </div>
             <div className="md:col-span-3">
                 <label htmlFor="svc_price" className="text-xs font-medium text-text-secondary ml-1">Preço (R$) *</label>
                 <input 
                     id="svc_price" 
                     type="number" 
                     value={servicePrice} 
                     onChange={(e)=>setServicePrice(e.target.value)} 
                     placeholder="R$" 
                     className="input-premium text-sm" 
                     required
                 />
             </div>
             <div className="md:col-span-3">
                 <label htmlFor="svc_dur" className="text-xs font-medium text-text-secondary ml-1">Duração (min) *</label>
                 <input 
                     id="svc_dur" 
                     type="number" 
                     value={serviceDuration} 
                     onChange={(e)=>setServiceDuration(e.target.value)} 
                     placeholder="Minutos" 
                     className="input-premium text-sm" 
                     required
                 />
             </div>
             <div className="md:col-span-2">
                 <label htmlFor="svc_img" className="text-xs font-medium text-text-secondary ml-1">Imagem</label>
                 <input 
                     id="svc_img" 
                     type="file" 
                     accept="image/*" 
                     onChange={(e) => setServiceImageFile(e.target.files[0])} 
                     className="text-xs text-text-secondary pt-2 block"
                 />
             </div>
             <div className="md:col-span-12 flex justify-end">
                 <button 
                     type="submit" 
                     disabled={isLoadingServices} 
                     className="btn-primary w-full md:w-auto h-[42px] flex justify-center items-center px-8"
                 >
                     <Plus size={16}/> Adicionar Serviço
                 </button>
             </div>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map(service => (
                <div key={service.id} className="bg-grafite-main border border-grafite-border p-3 rounded-lg flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         {service.imageUrl ? (
                             <img src={service.imageUrl} alt={service.name} className="w-10 h-10 rounded object-cover"/>
                         ) : (
                             <div className="w-10 h-10 rounded bg-grafite-surface flex items-center justify-center">
                                 <Scissors size={16}/>
                             </div>
                         )}
                         <div>
                            <strong className="block text-sm text-text-primary">{service.name}</strong>
                            <span className="text-xs text-text-secondary">{service.duration} min</span>
                         </div>
                    </div>
                    <span className="text-gold-main font-bold text-sm">R$ {service.price}</span>
                </div>
            ))}
        </div>
    </section>
  );

  // 6. Equipe
  const renderTeam = () => (
    <section className="card-premium">
        <div className="flex justify-between items-center mb-6 border-b border-grafite-border pb-4">
            <h3 className="text-xl font-bold text-text-primary flex gap-2">
                <Users className="text-gold-main"/> Equipe de Profissionais
            </h3>
        </div>
        <div className="bg-grafite-surface p-4 rounded-lg mb-6 flex flex-col md:flex-row gap-3 items-end border border-grafite-border">
            <div className="w-full">
                <label htmlFor="inv_name" className="text-xs text-text-secondary ml-1">Nome do Profissional *</label>
                <input 
                    id="inv_name" 
                    type="text" 
                    value={inviteName} 
                    onChange={(e)=>setInviteName(e.target.value)} 
                    className="input-premium text-sm h-10"
                />
            </div>
            <div className="w-full">
                <label htmlFor="inv_email" className="text-xs text-text-secondary ml-1">Email *</label>
                <input 
                    id="inv_email" 
                    type="email" 
                    value={inviteEmail} 
                    onChange={(e)=>setInviteEmail(e.target.value)} 
                    className="input-premium text-sm h-10"
                />
            </div>
            <button 
                onClick={handleInviteProfessional} 
                disabled={isLoadingInvite} 
                className="btn-primary w-full md:w-auto h-10 text-sm px-6"
            >
                {isLoadingInvite ? 'Enviando...' : 'Convidar'}
            </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {professionals.map(professional => (
                <div key={professional.id} className="bg-grafite-main border border-grafite-border p-4 rounded-lg flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-grafite-surface border border-grafite-border flex items-center justify-center text-xs font-bold text-gold-main">
                            {professional.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{professional.name}</span>
                    </div>
                    <button 
                        onClick={() => handleRemoveProfessional(professional.id, professional.name, professional.userId)} 
                        className="text-text-secondary hover:text-red-400 transition-colors"
                        title="Remover profissional"
                    >
                        <Trash2 size={16}/>
                    </button>
                </div>
            ))}
        </div>
    </section>
  );

  // 7. Produtos
  const renderProducts = () => (
      <section className="card-premium">
          <div className="flex justify-between items-center mb-6 border-b border-grafite-border pb-4">
              <h3 className="text-xl font-bold text-text-primary flex gap-2">
                  <Package className="text-gold-main"/> Produtos em Estoque
              </h3>
          </div>
          
          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 bg-grafite-surface p-4 rounded-lg border border-grafite-border">
              <div className="md:col-span-4">
                  <label htmlFor="prod_name" className="text-xs text-text-secondary ml-1">Nome do Produto *</label>
                  <input 
                      id="prod_name" 
                      type="text" 
                      value={productName} 
                      onChange={(e)=>setProductName(e.target.value)} 
                      placeholder="Ex: Pomada Modeladora" 
                      className="input-premium text-sm" 
                      required
                  />
              </div>
              <div className="md:col-span-2">
                  <label htmlFor="prod_price" className="text-xs text-text-secondary ml-1">Preço (R$) *</label>
                  <input 
                      id="prod_price" 
                      type="number" 
                      value={productPrice} 
                      onChange={(e)=>setProductPrice(e.target.value)} 
                      placeholder="R$" 
                      className="input-premium text-sm" 
                      required
                  />
              </div>
              <div className="md:col-span-2">
                  <label htmlFor="prod_stock" className="text-xs text-text-secondary ml-1">Estoque *</label>
                  <input 
                      id="prod_stock" 
                      type="number" 
                      value={productStock} 
                      onChange={(e)=>setProductStock(e.target.value)} 
                      placeholder="Quantidade" 
                      className="input-premium text-sm" 
                      required
                  />
              </div>
              <div className="md:col-span-3">
                  <label htmlFor="prod_image" className="text-xs text-text-secondary ml-1">Foto do Produto</label>
                  <input 
                      id="prod_image" 
                      type="file" 
                      accept="image/*" 
                      onChange={(e)=>setProductImageFile(e.target.files[0])} 
                      className="text-xs text-text-secondary pt-2 block"
                  />
              </div>
              <div className="md:col-span-1 flex items-end">
                  <button 
                      type="submit" 
                      disabled={isSavingProduct} 
                      className="btn-primary w-full h-[42px] flex justify-center items-center"
                      title="Adicionar produto"
                  >
                      <Plus size={16}/>
                  </button>
              </div>
          </form>
          
          {isLoadingProducts ? <Loading /> : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.length === 0 && (
                      <p className="col-span-full text-center text-text-secondary italic py-8">
                          Nenhum produto cadastrado no estoque.
                      </p>
                  )}
                  {products.map(product => (
                      <div key={product.id} className="bg-grafite-main border border-grafite-border rounded-lg overflow-hidden group relative hover:border-gold-main/50 transition-all">
                          <div className="h-32 bg-grafite-card flex items-center justify-center overflow-hidden">
                              {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover"/>
                              ) : (
                                  <ShoppingBag className="text-text-secondary/30" size={32}/>
                              )}
                          </div>
                          <div className="p-3">
                              <h4 className="font-bold text-sm truncate">{product.name}</h4>
                              <div className="flex justify-between items-center mt-1">
                                  <span className="text-gold-main text-sm font-bold">R$ {product.price}</span>
                                  <span className="text-[10px] bg-grafite-surface px-1.5 py-0.5 rounded border border-grafite-border">
                                      {product.stock} un
                                  </span>
                              </div>
                          </div>
                          <button 
                              onClick={() => handleDeleteProduct(product.id)} 
                              className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir produto"
                          >
                              <Trash2 size={14}/>
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </section>
  );

  // 8. Pacotes (Aba Nova)
  const renderPackages = () => (
      <section className="card-premium">
          <div className="flex justify-between items-center mb-6 border-b border-grafite-border pb-4">
              <h3 className="text-xl font-bold text-text-primary flex gap-2">
                  <Package className="text-gold-main"/> Pacotes & Assinaturas
              </h3>
          </div>
          
          <form onSubmit={handleAddPackage} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 bg-grafite-surface p-4 rounded-lg border border-grafite-border">
              <div className="md:col-span-4">
                  <label className="text-xs text-text-secondary ml-1">Nome do Pacote *</label>
                  <input 
                      type="text" 
                      value={packageName} 
                      onChange={(e)=>setPackageName(e.target.value)} 
                      placeholder="Ex: 4 Cortes Mensais" 
                      className="input-premium text-sm" 
                      required
                  />
              </div>
              <div className="md:col-span-3">
                  <label className="text-xs text-text-secondary ml-1">Preço (R$) *</label>
                  <input 
                      type="number" 
                      value={packagePrice} 
                      onChange={(e)=>setPackagePrice(e.target.value)} 
                      className="input-premium text-sm" 
                      required
                  />
              </div>
              <div className="md:col-span-2">
                  <label className="text-xs text-text-secondary ml-1">Qtd. Cortes *</label>
                  <input 
                      type="number" 
                      value={packageCutsCount} 
                      onChange={(e)=>setPackageCutsCount(e.target.value)} 
                      className="input-premium text-sm" 
                      required
                  />
              </div>
              <div className="md:col-span-2">
                  <label className="text-xs text-text-secondary ml-1">Validade (Dias) *</label>
                  <input 
                      type="number" 
                      value={packageDurationDays} 
                      onChange={(e)=>setPackageDurationDays(e.target.value)} 
                      className="input-premium text-sm" 
                      required
                  />
              </div>
              <div className="md:col-span-1 flex items-end">
                  <button 
                      type="submit" 
                      disabled={isSavingPackage} 
                      className="btn-primary w-full h-[42px] flex justify-center items-center"
                      title="Adicionar pacote"
                  >
                      <Plus size={16}/>
                  </button>
              </div>
          </form>

          {isLoadingPackages ? <Loading /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.length === 0 && (
                      <p className="col-span-full text-center text-text-secondary italic py-8">
                          Nenhum pacote cadastrado.
                      </p>
                  )}
                  {packages.map(pkg => (
                      <div key={pkg.id} className="bg-grafite-main border border-gold-main/30 p-4 rounded-xl relative group hover:shadow-glow transition-all">
                          <h4 className="text-lg font-bold text-white mb-1">{pkg.name}</h4>
                          <p className="text-gold-main font-bold text-xl mb-3">R$ {pkg.price}</p>
                          <div className="text-xs text-text-secondary space-y-1">
                              <p className="flex items-center gap-1">
                                  <Scissors size={12}/> {pkg.cuts} serviços incluídos
                              </p>
                              <p className="flex items-center gap-1">
                                  <Clock size={12}/> Validade: {pkg.durationDays} dias
                              </p>
                          </div>
                          <button 
                              onClick={() => handleDeletePackage(pkg.id)} 
                              className="absolute top-3 right-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir pacote"
                          >
                              <Trash2 size={16}/>
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </section>
  );

  if (isLoadingProfile || !shopProfile) return <Loading />;
  
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 animate-fade-in">
      {forcedShopId && (
          <button onClick={onBack} className="flex items-center gap-2 text-gold-main hover:underline mb-4 transition-colors">
              <ArrowLeft size={18}/> Voltar para Visão Global
          </button>
      )}

      <div className="flex justify-between items-end mb-6">
          <h2 className="text-3xl font-heading font-bold text-gold-main">
              {forcedShopId ? `Gerenciando: ${shopProfile.name}` : 'Painel Administrativo'}
          </h2>
          {forcedShopId && (
              <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-1 rounded font-bold uppercase">
                  Modo Administrador
              </span>
          )}
      </div>
      
      <div className="flex p-1 bg-grafite-card border border-grafite-border rounded-xl mb-8 overflow-x-auto gap-1 scrollbar-hide">
        {[
            {id: 'dashboard', label: 'Visão Geral', Icon: LayoutDashboard}, 
            {id: 'sales', label: 'Vendas', Icon: ListChecks}, 
            {id: 'clients', label: 'Clientes', Icon: Megaphone}, 
            {id: 'packages', label: 'Pacotes', Icon: Package},
            {id: 'config', label: 'Configurações', Icon: FileText}, 
            {id: 'services', label: 'Serviços', Icon: Scissors}, 
            {id: 'team', label: 'Equipe', Icon: Users},
            {id: 'products', label: 'Produtos', Icon: ShoppingBag}
        ].map(({id, label, Icon}) => (
            <button 
                key={id} 
                onClick={() => setActiveTab(id)} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                    activeTab === id 
                    ? 'bg-gold-main text-grafite-main shadow-glow transform scale-105' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-grafite-surface'
                }`}
            >
                <Icon size={18} /> {label}
            </button>
        ))}
      </div>

      <div className="min-h-[500px]">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'sales' && renderSalesTab()}
          {activeTab === 'clients' && renderClientsCRM()} 
          {activeTab === 'packages' && renderPackages()}
          {activeTab === 'config' && renderConfigSection()}
          {activeTab === 'services' && renderServices()}
          {activeTab === 'team' && renderTeam()}
          {activeTab === 'products' && renderProducts()}
      </div>
    </div>
  );
}

export default AdminPanel;