// src/components/ClientPanel/ClientPanel.jsx
// (CORRIGIDO - Com formulário de busca restaurado na aba Explorar)

import { useState, useEffect } from 'react';
import { functions, db, auth } from '../../firebase/firebase-config';
import { httpsCallable } from 'firebase/functions';
import { 
  collection, getDocs, query, where, doc, getDoc, 
  addDoc, Timestamp, onSnapshot 
} from "firebase/firestore"; 
import Calendar from 'react-calendar';
import './Calendar.css'; 
import { useShop } from '../../App.jsx';
import { toast } from 'sonner';
import { 
  MapPin, Calendar as CalIcon, Clock, Scissors, 
  CreditCard, Store, Search, ArrowLeft, Package, Minus, Plus, Image as ImageIcon,
  LayoutGrid, Star, ChevronRight, Info 
} from 'lucide-react';

const daysOfWeek = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

// --- Helper Functions ---
const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const generateTimeSlots = (start, end, duration, bookedSlots, blockedPeriods) => {
  const slots = [];
  const startTime = timeToMinutes(start);
  const endTime = timeToMinutes(end);
  const serviceDuration = duration;
  
  if (serviceDuration <= 0 || startTime >= endTime) return [];

  for (let time = startTime; time < endTime; time += serviceDuration) {
    const slotStart = time;
    const slotEnd = time + serviceDuration;
    if (slotEnd > endTime) break;
    
    const slotStartHour = Math.floor(slotStart / 60).toString().padStart(2, '0');
    const slotStartMin = (slotStart % 60).toString().padStart(2, '0');
    const slotString = `${slotStartHour}:${slotStartMin}`;
    
    if (bookedSlots.includes(slotString)) continue;
    
    let isBlocked = false;
    for (const block of blockedPeriods) {
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);
      if (slotStart < blockEnd && slotEnd > blockStart) {
        isBlocked = true; break;
      }
    }
    if (isBlocked) continue;
    
    slots.push(slotString);
  }
  return slots;
};

function ClientPanel() {
  const { viewingShopId, setViewingShopId } = useShop();

  // --- ESTADOS DE NAVEGAÇÃO ---
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'catalog'
  
  // Verifica se está em ambiente Whitelabel (Subdomínio) para bloquear a saída
  const isBrandedEnvironment = window.location.hostname.split('.').length > 2 && !window.location.hostname.includes('localhost');

  // --- ESTADOS DO SISTEMA ---
  const [searchCity, setSearchCity] = useState('');
  const [searchedCity, setSearchedCity] = useState('');
  const [barbershops, setBarbershops] = useState([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]); 
  const [isLoadingServices, setIsLoadingServices] = useState(false); 
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedService, setSelectedService] = useState(null); 
  const [availableProfessionals, setAvailableProfessionals] = useState([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentShopData, setCurrentShopData] = useState(null);
  const [myAppointments, setMyAppointments] = useState([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);

  // --- ESTADOS DE CHECKOUT ---
  const [cart, setCart] = useState([]); 
  const [checkoutStage, setCheckoutStage] = useState('slots'); 

  // Cálculos de totais
  const totalServicePrice = selectedService ? selectedService.price : 0;
  const totalProductsPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const finalTotal = totalServicePrice + totalProductsPrice;

  // 1. Busca Agendamentos (Tempo Real)
  useEffect(() => {
    if (!auth.currentUser) {
      setIsLoadingAppointments(false);
      return;
    }
    setIsLoadingAppointments(true);
    const today = Timestamp.fromDate(new Date(new Date().setHours(0,0,0,0)));

    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("clientId", "==", auth.currentUser.uid),
      where("startTime", ">=", today),
      where("status", "in", ["confirmed", "checked_in"]) 
    );

    const unsubscribe = onSnapshot(appointmentsQuery, (querySnapshot) => {
      const appointmentsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMyAppointments(appointmentsList);
      setIsLoadingAppointments(false);
    }, (error) => {
      console.error("Erro ao ouvir agendamentos: ", error);
      setIsLoadingAppointments(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Carregar dados da loja (inclui Produtos e Serviços)
  useEffect(() => {
    if (viewingShopId) {
      const fetchShopData = async () => {
         try {
           const shopDoc = await getDoc(doc(db, "barbershops", viewingShopId));
           if (shopDoc.exists()) {
             setCurrentShopData(shopDoc.data());
           }
         } catch (error) { console.error("Erro ao carregar dados da loja", error); }
      };
      fetchShopData();

      // Carregar Serviços
      const fetchServices = async () => {
        try {
          const servicesQuery = query(collection(db, "services"), where("barbershopId", "==", viewingShopId));
          const querySnapshot = await getDocs(servicesQuery);
          setServices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) { console.error("Erro ao buscar serviços", error); }
      };
      fetchServices();
      
      // Carregar Produtos para Venda
      const fetchProducts = async () => {
        setIsLoadingProducts(true);
        try {
          const productsQuery = query(collection(db, "products"), where("barbershopId", "==", viewingShopId));
          const querySnapshot = await getDocs(productsQuery);
          setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), stock: doc.data().stock || 0 })));
        } catch (error) { 
          console.error("Erro ao buscar produtos: ", error);
        } 
        finally { setIsLoadingProducts(false); }
      };
      fetchProducts();
    }
  }, [viewingShopId]);


  // 3. Busca Lojas (Catálogo)
  const handleSearchCity = async (e) => {
    e.preventDefault();
    if (!searchCity) return;
    
    setIsLoadingShops(true);
    setBarbershops([]);
    
    const normalizedSearch = searchCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    try {
      const shopsQuery = query(collection(db, "barbershops"), where("cidadeQuery", "==", normalizedSearch));
      const querySnapshot = await getDocs(shopsQuery);
      const shopsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBarbershops(shopsList);
      setSearchedCity(searchCity);
      if(shopsList.length === 0) toast.info("Nenhuma barbearia encontrada nesta cidade.");
    } catch (error) { 
      toast.error("Erro ao buscar lojas. Verifique sua conexão.");
    } finally {
      setIsLoadingShops(false);
    }
  };

  // 4. Busca Profissionais
  const handleSelectService = async (service) => {
    setSelectedService(service);
    setIsLoadingProfessionals(true);
    setAvailableProfessionals([]);
    try {
      const profQuery = query(
        collection(db, "professionals"),
        where("barbershopId", "==", viewingShopId),
        where("services", "array-contains", service.id) 
      );
      const querySnapshot = await getDocs(profQuery);
      setAvailableProfessionals(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { toast.error("Erro ao carregar profissionais."); } 
    finally { setIsLoadingProfessionals(false); }
  };

  // 5. Busca Slots (Via Cloud Function)
  useEffect(() => {
    if (!selectedProfessional || !selectedDate || !selectedService) return;
    
    const fetchAvailableSlots = async () => {
      setIsLoadingSlots(true);
      setAvailableSlots([]);
      
      try {
        const getSlotsFn = httpsCallable(functions, 'getAvailableSlots');
        const dateString = selectedDate.toISOString().split('T')[0];

        const result = await getSlotsFn({ 
            professionalId: selectedProfessional.id, 
            date: dateString, 
            serviceDuration: selectedService.duration,
            barbershopId: viewingShopId 
        });

        if (result.data && result.data.slots) {
            setAvailableSlots(result.data.slots);
        } else {
            setAvailableSlots([]);
        }
        
      } catch (error) { 
          console.error("Erro ao calcular slots:", error);
          toast.error("Erro ao buscar horários disponíveis.");
      } 
      finally { setIsLoadingSlots(false); }
    };
    
    fetchAvailableSlots();
  }, [selectedDate, selectedProfessional, selectedService, viewingShopId]); 
  

  // --- FUNÇÕES DO CARRINHO ---
  const handleUpdateCart = (product, operation) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      if (operation === 'add') {
        if (existingItem) {
          if (existingItem.qty >= product.stock) {
            toast.error(`Estoque máximo para ${product.name} atingido.`);
            return prevCart;
          }
          return prevCart.map(item => item.productId === product.id ? { ...item, qty: item.qty + 1 } : item);
        }
        return [...prevCart, { productId: product.id, name: product.name, price: product.price, qty: 1, imageUrl: product.imageUrl, stock: product.stock }];
      } 
      if (operation === 'remove' && existingItem) {
        if (existingItem.qty === 1) return prevCart.filter(item => item.productId !== product.id);
        return prevCart.map(item => item.productId === product.id ? { ...item, qty: item.qty - 1 } : item);
      }
      return prevCart;
    });
  };

  // --- LÓGICA DE CHECKOUT ---

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setCheckoutStage('products');
  };

  const processBooking = async (method) => {
    if (!selectedSlot) return;
    
    try {
      const [hour, minute] = selectedSlot.split(':').map(Number);
      const startTimeObj = new Date(selectedDate);
      startTimeObj.setHours(hour, minute, 0, 0);
      const endTimeObj = new Date(startTimeObj.getTime() + selectedService.duration * 60000);

      const orderItems = [
          { type: 'service', id: selectedService.id, name: selectedService.name, price: selectedService.price, qty: 1 },
          ...cart.map(item => ({ type: 'product', id: item.productId, name: item.name, price: item.price, qty: item.qty }))
      ];
      
      // A) PAGAR NA LOJA
      if (method === 'in_store_combined') {
        await addDoc(collection(db, "appointments"), {
          clientId: auth.currentUser.uid, professionalId: selectedProfessional.id, barbershopId: viewingShopId,
          startTime: Timestamp.fromDate(startTimeObj), endTime: Timestamp.fromDate(endTimeObj),
          serviceId: selectedService.id, status: "confirmed", paymentMethod: "in_store_combined",
          orderItems: orderItems, totalPrice: finalTotal, createdAt: Timestamp.now()
        });
        
        toast.success("Agendamento e Pedido Confirmados!");
        resetSelection();
      }
      
      // B) PAGAR ONLINE
      else if (method === 'online_combined') {
        toast.loading("Gerando pagamento...");
        
        const payload = {
          title: `Serviços e Produtos - ${currentShopData?.name}`, price: finalTotal,
          appointmentData: {
            clientId: auth.currentUser.uid, professionalId: selectedProfessional.id, serviceId: selectedService.id,
            barbershopId: viewingShopId, startTime: startTimeObj.toISOString(), endTime: endTimeObj.toISOString(),
            orderItems: orderItems, totalPrice: finalTotal
          }
        };

        const createPaymentFn = httpsCallable(functions, 'createPayment');
        const response = await createPaymentFn(payload);
        const { paymentUrl } = response.data;

        if (paymentUrl) {
          window.location.href = paymentUrl;
        } else {
          toast.dismiss();
          toast.error("Erro ao gerar link de pagamento.");
        }
      }

    } catch (error) {
      console.error("Erro no checkout: ", error);
      toast.error("Erro ao processar: " + error.message);
    }
  };

  // --- Funções de Navegação ---
  const resetSelection = () => {
    setSelectedService(null); setAvailableProfessionals([]); setSelectedProfessional(null);
    setSelectedDate(new Date()); setAvailableSlots([]); setSelectedSlot(null); setCart([]);
    setCheckoutStage('slots');
  };
  
  const backToProfessionals = () => {
    setSelectedProfessional(null);
    setSelectedDate(new Date());
    setAvailableSlots([]);
    setSelectedSlot(null);
  };
  
  const handleBackToCatalog = () => {
    setViewingShopId(null); resetSelection(); setSearchCity('');
  };

  // --- JSX ---

  // ETAPA 0: Catálogo / Meus Agendamentos (VISUAL NOVO)
  if (!viewingShopId) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in">
        
        {/* Navegação Superior (Abas) */}
        <div className="flex p-1 bg-grafite-card border border-grafite-border rounded-xl mb-4 shadow-lg">
            <button onClick={() => setActiveTab('appointments')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'appointments' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}>
                <CalIcon size={18}/> Minha Agenda
            </button>
            <button onClick={() => setActiveTab('catalog')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'catalog' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}>
                 <LayoutGrid size={18}/> Explorar
            </button>
        </div>

        {/* Conteúdo: Agendamentos */}
        {activeTab === 'appointments' && (
            <section className="animate-slide-up space-y-4">
                {!isLoadingAppointments && myAppointments.length > 0 ? (
                    myAppointments.map(app => (
                        <div key={app.id} className="bg-grafite-card border border-grafite-border rounded-xl p-5 hover:border-gold-main/50 transition-all duration-300 shadow-lg group relative overflow-hidden">
                            {/* Barra lateral de status */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${app.status === 'checked_in' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                            
                            <div className="flex justify-between items-start mb-3 pl-2">
                                <div>
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2">{app.serviceName}</h4>
                                    <p className="text-sm text-text-secondary">{app.barbershopName || 'Barbearia'}</p>
                                </div>
                                <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wide border ${app.status === 'checked_in' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-blue-500/10 border-blue-500 text-blue-400'}`}>
                                    {app.status === 'checked_in' ? 'Na Loja' : 'Confirmado'}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-text-primary pl-2">
                                <div className="flex items-center gap-2 bg-grafite-surface px-3 py-1.5 rounded-lg border border-grafite-border">
                                    <CalIcon size={14} className="text-gold-main"/>
                                    {app.startTime.toDate().toLocaleDateString('pt-BR')}
                                </div>
                                <div className="flex items-center gap-2 bg-grafite-surface px-3 py-1.5 rounded-lg border border-grafite-border">
                                    <Clock size={14} className="text-gold-main"/>
                                    {app.startTime.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16 border-2 border-dashed border-grafite-border rounded-xl bg-grafite-surface/20">
                        <Clock size={48} className="mx-auto text-text-secondary opacity-20 mb-4"/>
                        <p className="text-text-secondary text-lg">Nenhum agendamento futuro.</p>
                        <button onClick={() => setActiveTab('catalog')} className="text-gold-main font-bold hover:underline mt-2">Encontrar Barbearia</button>
                    </div>
                )}
            </section>
        )}
        
        {/* Conteúdo: Catálogo */}
        {activeTab === 'catalog' && (
            <section className="animate-slide-up">
                {/* FORMULÁRIO DE BUSCA RESTAURADO */}
                <div className="card-premium mb-6">
                    <h2 className="text-2xl font-heading font-bold text-gold-main mb-4 flex items-center gap-2">
                        <Search size={24} className="text-gold-main"/> Encontre sua Barbearia
                    </h2>
                    <form onSubmit={handleSearchCity} className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <input 
                                type="text" 
                                value={searchCity} 
                                onChange={(e) => setSearchCity(e.target.value)}
                                placeholder="Digite o nome da sua cidade..." 
                                className="input-premium w-full text-lg h-14"
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoadingShops}
                            className="btn-primary h-14 px-8 text-lg font-bold min-w-[140px] flex items-center justify-center gap-2"
                        >
                            {isLoadingShops ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current"></div>
                            ) : (
                                <>
                                    <Search size={20}/> Buscar
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* RESULTADOS DA BUSCA */}
                {searchedCity && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <MapPin size={18} className="text-gold-main"/> 
                            Barbearias em {searchedCity}
                            {barbershops.length > 0 && (
                                <span className="text-sm text-text-secondary font-normal ml-2">
                                    ({barbershops.length} encontrada{barbershops.length !== 1 ? 's' : ''})
                                </span>
                            )}
                        </h3>
                        
                        {isLoadingShops ? (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div>
                            </div>
                        ) : barbershops.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {barbershops.map(shop => (
                                    <div 
                                        key={shop.id} 
                                        onClick={() => setViewingShopId(shop.id)} 
                                        className="bg-grafite-card border border-grafite-border rounded-2xl overflow-hidden hover:border-gold-main hover:shadow-glow transition-all duration-300 group cursor-pointer relative"
                                    >
                                        <div className="h-48 overflow-hidden relative">
                                           <img 
                                               src={shop.logoUrl} 
                                               alt={shop.name} 
                                               className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                           />
                                           <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
                                           <div className="absolute bottom-4 left-4 right-4">
                                               <h4 className="text-xl font-heading font-bold text-white mb-1">{shop.name}</h4>
                                               <p className="text-xs text-gray-300 flex items-center gap-1 truncate">
                                                   <MapPin size={12} className="text-gold-main"/> 
                                                   {shop.address}
                                               </p>
                                           </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-grafite-border rounded-xl bg-grafite-surface/20">
                                <Store size={48} className="mx-auto text-text-secondary opacity-20 mb-4"/>
                                <p className="text-text-secondary text-lg">Nenhuma barbearia encontrada em {searchedCity}.</p>
                                <p className="text-text-secondary text-sm mt-2">Tente buscar por outra cidade.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* MENSAGEM INICIAL QUANDO NÃO HÁ BUSCA */}
                {!searchedCity && (
                    <div className="text-center py-16 border-2 border-dashed border-grafite-border rounded-xl bg-grafite-surface/20">
                        <Store size={64} className="mx-auto text-text-secondary opacity-20 mb-4"/>
                        <h3 className="text-xl font-bold text-text-secondary mb-2">Encontre Barbearias Próximas</h3>
                        <p className="text-text-secondary mb-6">Digite o nome da sua cidade acima para descobrir as melhores barbearias da região.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                                <Scissors size={16} className="text-gold-main"/> Serviços Profissionais
                            </div>
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                                <Star size={16} className="text-gold-main"/> Agendamento Online
                            </div>
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                                <CreditCard size={16} className="text-gold-main"/> Pagamento Seguro
                            </div>
                        </div>
                    </div>
                )}
            </section>
        )}
      </div>
    );
  }

  // ETAPA 1: Seleção de Serviços (CARROSSEL HORIZONTAL PREMIUM)
  if (viewingShopId && !selectedService) {
    return (
      <div className="max-w-5xl mx-auto p-4 animate-fade-in pb-24">
        {!isBrandedEnvironment && (
            <button onClick={handleBackToCatalog} className="mb-6 flex items-center text-text-secondary hover:text-gold-main gap-2 text-sm font-medium transition-colors">
                <ArrowLeft size={18}/> Voltar ao Catálogo
            </button>
        )}
        
        <header className="mb-8">
             <h2 className="text-3xl font-heading font-bold text-white mb-2">Olá! 👋</h2>
             <p className="text-text-secondary">Escolha um serviço para começar seu agendamento na <span className="text-gold-main font-semibold">{currentShopData?.name}</span>.</p>
        </header>

        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Scissors size={20} className="text-gold-main"/>
                <h3 className="text-xl font-bold text-white">Serviços</h3>
            </div>

            {services.length > 0 ? (
                <div className="flex overflow-x-auto gap-5 pb-8 custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth">
                {services.map(service => (
                    <div key={service.id} onClick={() => handleSelectService(service)}
                         className="min-w-[260px] bg-grafite-card border border-grafite-border rounded-2xl overflow-hidden cursor-pointer group hover:shadow-glow hover:border-gold-main transition-all duration-300 relative flex flex-col"
                    >
                        <div className="h-40 overflow-hidden relative bg-grafite-surface">
                            {service.imageUrl ? (
                                <img src={service.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-text-secondary/20"><Scissors size={48}/></div>
                            )}
                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-white/10">
                                <Clock size={12} className="text-gold-main"/> {service.duration} min
                            </div>
                        </div>
                        
                        <div className="p-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-grafite-card to-grafite-main">
                            <h4 className="text-lg font-bold text-white mb-1">{service.name}</h4>
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-xl font-bold text-gold-main">R$ {service.price.toFixed(2)}</span>
                                <div className="w-8 h-8 rounded-full bg-gold-main flex items-center justify-center text-grafite-main shadow-lg group-hover:scale-110 transition-transform">
                                    <Plus size={18}/>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                </div>
            ) : (
                <p className="text-text-secondary italic">Nenhum serviço disponível.</p>
            )}
        </section>
        
        {/* Teaser de Produtos */}
        {products.length > 0 && (
            <div className="mt-8 p-4 bg-grafite-card border border-grafite-border rounded-xl flex items-center gap-4 shadow-lg">
               <div className="w-12 h-12 bg-gold-dim rounded-full flex items-center justify-center text-gold-main">
                   <Package size={24}/>
               </div>
               <div>
                   <h4 className="text-white font-bold">Produtos Exclusivos</h4>
                   <p className="text-xs text-text-secondary">Temos {products.length} produtos para você. Adicione no próximo passo!</p>
               </div>
            </div>
        )}
      </div>
    );
  }

  // [O restante do código permanece igual...]
  // ETAPA 2: Profissionais (Cards Simples e Elegantes)
  if (selectedService && !selectedProfessional) {
    return (
      <div className="max-w-3xl mx-auto p-4 animate-fade-in">
        <button onClick={resetSelection} className="mb-6 flex items-center text-text-secondary hover:text-gold-main gap-2 text-sm font-medium transition-colors">
          <ArrowLeft size={18}/> Voltar
        </button>
        
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Quem vai te atender?</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableProfessionals.length > 0 ? availableProfessionals.map(prof => (
             <div key={prof.id} onClick={() => setSelectedProfessional(prof)} className="bg-grafite-card border border-grafite-border p-6 rounded-2xl hover:border-gold-main hover:shadow-glow transition-all cursor-pointer flex items-center gap-4 group">
                <div className="w-16 h-16 rounded-full bg-grafite-surface border-2 border-grafite-border flex items-center justify-center text-2xl font-bold text-gold-main group-hover:border-gold-main transition-colors shadow-lg">
                   {prof.name.charAt(0).toUpperCase()}
                </div>
                <div>
                   <h4 className="text-lg font-bold text-white group-hover:text-gold-main transition-colors">{prof.name}</h4>
                   <div className="flex items-center gap-1 text-xs text-text-secondary mt-1">
                      <Star size={12} className="text-gold-main fill-gold-main"/> Profissional
                   </div>
                </div>
                <ChevronRight className="ml-auto text-text-secondary group-hover:text-gold-main transition-colors"/>
             </div>
          )) : <p className="col-span-2 text-center text-text-secondary py-10">Nenhum profissional disponível.</p>}
        </div>
      </div>
    );
  }

  // ETAPA 3: Calendário e Slots
  if (selectedService && selectedProfessional && checkoutStage === 'slots') { 
    return ( 
        <div className="max-w-6xl mx-auto p-4 animate-fade-in">
        <button onClick={() => setSelectedProfessional(null)} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
          <ArrowLeft size={16}/> Voltar
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
             <div className="card-premium">
                <h3 className="text-lg font-heading font-bold text-text-primary mb-4 border-b border-grafite-border pb-2">Resumo</h3>
                <div className="space-y-4">
                   <div><p className="text-xs text-text-secondary uppercase">Serviço</p><p className="text-gold-main font-bold text-lg">{selectedService.name}</p><p className="text-sm text-text-primary">R$ {selectedService.price?.toFixed(2)}</p></div>
                   <div><p className="text-xs text-text-secondary uppercase">Profissional</p><p className="text-text-primary font-medium">{selectedProfessional.name}</p></div>
                </div>
             </div>
          </div>
          <div className="lg:col-span-8 space-y-6">
             <div className="card-premium">
                <div className="flex flex-col md:flex-row gap-8">
                   <div className="flex-1 flex justify-center md:justify-start">
                      <div className="calendar-wrapper text-text-primary">
                        <Calendar onChange={setSelectedDate} value={selectedDate} minDate={new Date()} className="react-calendar border-none bg-transparent" tileClassName={({ date, view }) => (view === 'month' && date.getDay() === 0) ? 'text-red-400' : null}/>
                      </div>
                   </div>
                   <div className="flex-1 border-l border-grafite-border pl-0 md:pl-8 pt-6 md:pt-0">
                      <h4 className="text-sm font-bold text-text-secondary uppercase mb-4">Horários</h4>
                      {isLoadingSlots ? (
                        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-main"></div></div>
                      ) : availableSlots.length > 0 ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {availableSlots.map(slot => (
                              <button key={slot} onClick={() => handleSlotClick(slot)} className="py-2 px-1 rounded border border-grafite-border bg-grafite-main text-text-primary hover:bg-gold-main hover:text-grafite-main hover:border-gold-main transition-all text-sm font-medium">
                                {slot}
                              </button>
                            ))}
                          </div>
                        ) : <p className="text-sm text-text-secondary italic">Nenhum horário livre.</p>
                      }
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // ETAPA 4: Upsell de Produtos (CATÁLOGO VERTICAL)
  if (selectedService && selectedProfessional && selectedSlot && checkoutStage === 'products') {
    return (
        <div className="max-w-6xl mx-auto p-4 animate-fade-in">
          <button onClick={() => setCheckoutStage('slots')} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
            <ArrowLeft size={16}/> Voltar para Horários
          </button>

          <h2 className="text-2xl font-heading font-bold text-gold-main mb-6">Deseja adicionar algo?</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Produtos para Upsell (Catálogo Vertical) */}
            <section className="card-premium lg:col-span-2 h-full">
                <h3 className="text-xl font-heading font-bold text-text-primary mb-4 border-b border-grafite-border pb-2">Produtos da Barbearia</h3>
                {isLoadingProducts ? (
                    <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-main"></div></div>
                ) : products.length === 0 ? (
                    <p className="text-text-secondary italic">Nenhum produto cadastrado para venda.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {products.map(product => {
                            const currentCartItem = cart.find(item => item.productId === product.id);
                            const currentQty = currentCartItem?.qty || 0;
                            const canAdd = currentQty < product.stock;
                            
                            return (
                            <div key={product.id} className="bg-grafite-main border border-grafite-border rounded-xl p-4 flex items-center gap-4">
                                <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded-lg border border-grafite-border"/>
                                <div className="flex-1 overflow-hidden">
                                    <h4 className="font-bold text-text-primary truncate">{product.name}</h4>
                                    <span className="text-gold-main text-sm font-medium">R$ {Number(product.price).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleUpdateCart(product, 'remove')} 
                                        className="text-text-secondary hover:text-red-400 p-1 rounded-full border border-grafite-border bg-grafite-surface disabled:opacity-50"
                                        disabled={currentQty === 0}
                                    >
                                        <Minus size={16}/>
                                    </button>
                                    <span className="text-white font-mono w-4 text-center">{currentQty}</span>
                                    <button 
                                        onClick={() => handleUpdateCart(product, 'add')} 
                                        className={`p-1 rounded-full border border-gold-main/50 ${canAdd ? 'text-gold-main hover:text-white bg-gold-dim' : 'text-text-secondary/50 bg-grafite-surface disabled:cursor-not-allowed'}`}
                                        disabled={!canAdd}
                                    >
                                        <Plus size={16}/>
                                    </button>
                                </div>
                            </div>
                        )})}
                    </div>
                )}
            </section>
            
            {/* Resumo do Carrinho e Botão de Avançar */}
            <section className="lg:col-span-1 space-y-4 h-full">
                <div className="card-premium sticky top-24">
                    <h3 className="text-lg font-heading font-bold text-text-primary mb-4 border-b border-grafite-border pb-2">Seu Pedido</h3>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between text-white font-semibold">
                            <span className="flex items-center gap-2"><Scissors size={16} className="text-gold-main"/> {selectedService.name}</span>
                            <span>R$ {totalServicePrice.toFixed(2)}</span>
                        </div>
                        
                        {cart.length > 0 && (
                            <>
                              <h4 className="text-xs text-text-secondary uppercase pt-2 border-t border-grafite-border/50">Produtos:</h4>
                              {cart.map(item => (
                                  <div key={item.productId} className="flex justify-between text-sm text-text-secondary">
                                      <span>{item.name} (x{item.qty})</span>
                                      <span>R$ {(item.price * item.qty).toFixed(2)}</span>
                                  </div>
                              ))}
                            </>
                        )}
                        
                        <div className="pt-4 border-t border-grafite-border/50 flex justify-between font-bold text-xl text-gold-main">
                            <span>TOTAL:</span>
                            <span>R$ {finalTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <button onClick={() => setCheckoutStage('review')} className="btn-primary w-full h-12 flex items-center justify-center gap-2 shadow-glow mt-6">
                        Finalizar Pedido
                    </button>
                </div>
            </section>
          </div>
        </div>
    );
  }

  // ETAPA 5: Revisão e Pagamento Unificado
  if (selectedService && selectedProfessional && selectedSlot && checkoutStage === 'review') {
      const isOnlinePaymentEnabled = currentShopData?.onlinePaymentEnabled;
      const isOnlinePaymentRequired = currentShopData?.requirePayment;
      
      return (
          <div className="max-w-xl mx-auto p-4 animate-fade-in">
              <button onClick={() => setCheckoutStage('products')} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
                  <ArrowLeft size={16}/> Voltar para Produtos
              </button>
              
              <section className="card-premium space-y-6">
                  <h2 className="text-2xl font-heading font-bold text-gold-main border-b border-grafite-border pb-3 text-center">
                      Pagamento
                  </h2>
                  
                  <div className="space-y-3 bg-grafite-main p-5 rounded-lg border border-grafite-border">
                      <div className="flex justify-between items-center text-sm text-text-secondary">
                         <span>Agendamento:</span>
                         <span className="text-white">{selectedDate.toLocaleDateString('pt-BR')} às {selectedSlot}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-text-secondary">
                         <span>Profissional:</span>
                         <span className="text-white">{selectedProfessional.name}</span>
                      </div>
                      <div className="h-px bg-grafite-border my-2"></div>
                      <div className="flex justify-between font-bold text-xl text-gold-main">
                          <span>TOTAL A PAGAR:</span>
                          <span>R$ {finalTotal.toFixed(2)}</span>
                      </div>
                  </div>

                  {/* Opções de Pagamento */}
                  <div className="space-y-3">
                      {isOnlinePaymentEnabled && (
                          <button 
                              onClick={() => processBooking('online_combined')}
                              className={`w-full flex items-center justify-between p-4 rounded-lg border border-gold-main/30 bg-gold-dim/10 hover:bg-gold-main hover:text-grafite-main group transition-all text-text-primary font-semibold ${isOnlinePaymentRequired ? 'ring-2 ring-gold-main' : ''}`}
                          >
                              <div className="flex items-center gap-3">
                                  <CreditCard size={20} className="text-gold-main group-hover:text-grafite-main"/>
                                  <span>Pagar Agora (Online)</span>
                              </div>
                              {isOnlinePaymentRequired && <span className="text-[10px] bg-gold-main text-grafite-main px-2 py-0.5 rounded font-bold uppercase">OBRIGATÓRIO</span>}
                          </button>
                      )}

                      {(!isOnlinePaymentRequired || !isOnlinePaymentEnabled) && (
                          <button 
                              onClick={() => processBooking('in_store_combined')}
                              className="w-full flex items-center justify-start gap-3 p-4 rounded-lg border border-grafite-border bg-grafite-main hover:bg-grafite-surface transition-all text-text-primary font-semibold"
                          >
                              <Store size={20} className="text-text-secondary"/>
                              <span>Pagar na Barbearia</span>
                          </button>
                      )}

                      {!isOnlinePaymentEnabled && (
                         <p className="text-xs text-center text-text-secondary pt-2">Pagamento online indisponível no momento.</p>
                      )}
                  </div>
                  
                  <button onClick={resetSelection} className="w-full text-center text-text-secondary text-sm hover:text-white transition-colors py-2">
                      Voltar ao Início
                  </button>
              </section>
          </div>
      );
  }
  
  return <div className="max-w-4xl mx-auto p-4 text-text-secondary">Carregando Painel...</div>;
}

export default ClientPanel;