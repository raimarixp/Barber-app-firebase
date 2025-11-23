// src/components/ClientPanel/ClientPanel.jsx
// (COMPLETO - Visual Premium + Carrinho Unificado + Cálculo de Slots via Cloud Function)

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
  CreditCard, Store, Search, ArrowLeft, Package, Minus, Plus, Image as ImageIcon
} from 'lucide-react';

function ClientPanel() {
  const { viewingShopId, setViewingShopId } = useShop();

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

  // 5. Busca Slots (AGORA VIA CLOUD FUNCTION - FIX DE SEGURANÇA)
  useEffect(() => {
    if (!selectedProfessional || !selectedDate || !selectedService) return;
    
    const fetchAvailableSlots = async () => {
      setIsLoadingSlots(true);
      setAvailableSlots([]);
      
      try {
        // Chama a Cloud Function
        const getSlotsFn = httpsCallable(functions, 'getAvailableSlots');
        
        // Formata a data para string ISO YYYY-MM-DD para enviar
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
          console.error("Erro ao calcular slots (Cloud Function):", error);
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
        
        toast.success("Agendamento Confirmado!");
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

  // --- Navegação ---
  const resetSelection = () => {
    setSelectedService(null); setAvailableProfessionals([]); setSelectedProfessional(null);
    setSelectedDate(new Date()); setAvailableSlots([]); setSelectedSlot(null); setCart([]);
    setCheckoutStage('slots');
  };
  
  const handleBackToCatalog = () => {
    setViewingShopId(null); resetSelection(); setSearchCity('');
  };

  // --- JSX ---

  // ETAPA 0: Catálogo
  if (!viewingShopId) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8 animate-fade-in">
        {!isLoadingAppointments && myAppointments.length > 0 && (
          <section className="card-premium">
             <div className="flex items-center gap-2 border-b border-grafite-border pb-4 mb-4">
                <CalIcon className="text-gold-main" size={24}/>
                <h2 className="text-xl font-heading font-bold text-text-primary">Meus Agendamentos</h2>
             </div>
             <div className="grid gap-4 sm:grid-cols-2">
              {myAppointments.map(app => (
                <div key={app.id} className="bg-grafite-main border border-grafite-border p-4 rounded-lg flex flex-col gap-2 hover:border-gold-main/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <span className="text-lg font-bold text-text-primary">{app.startTime.toDate().toLocaleDateString('pt-BR')}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold border ${app.status === 'checked_in' ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-blue-900/20 border-blue-500 text-blue-400'}`}>
                       {app.status === 'checked_in' ? 'Check-in' : 'Confirmado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gold-main">
                     <Clock size={16}/>
                     <span className="font-mono text-lg">{app.startTime.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  {app.orderItems && app.orderItems.length > 1 && (
                      <div className="text-xs text-text-secondary mt-1 pt-2 border-t border-grafite-border/50">
                          + {app.orderItems.length - 1} produtos adicionais
                      </div>
                  )}
                </div>
              ))}
             </div>
          </section>
        )}
        
        <section className="card-premium">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold text-gold-main mb-2">Encontre sua Barbearia</h2>
            <p className="text-text-secondary">Busque pelos melhores profissionais da sua cidade.</p>
          </div>
          
          <form onSubmit={handleSearchCity} className="relative max-w-lg mx-auto mb-8"> 
            <input type="text" id="searchCity" name="searchCity" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} placeholder="Digite sua cidade (ex: São Paulo)" className="input-premium pr-12 h-12"/>
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gold-main hover:text-white transition-colors">
              {isLoadingShops ? <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"/> : <Search size={24}/>}
            </button>
          </form>
          
          {searchedCity && (
            <div className="animate-slide-up">
              <h3 className="text-lg font-semibold text-text-secondary mb-4">Resultados para "{searchedCity}"</h3>
              {isLoadingShops ? (
                 <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>
              ) : (
                barbershops.length === 0 ? (
                  <p className="text-center text-text-secondary italic py-8 bg-grafite-main rounded-lg border border-grafite-border border-dashed">Nenhuma barbearia encontrada.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {barbershops.map(shop => (
                      <div key={shop.id} className="bg-grafite-main border border-grafite-border rounded-xl overflow-hidden hover:shadow-glow transition-all duration-300 group">
                        <div className="h-40 overflow-hidden">
                           <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="p-5">
                          <h4 className="text-xl font-bold text-text-primary mb-1">{shop.name}</h4>
                          <p className="text-sm text-text-secondary mb-2 flex items-center gap-1"><MapPin size={14}/> {shop.cidade}</p>
                          <p className="text-sm text-text-secondary/70 line-clamp-2 mb-4 min-h-[40px]">{shop.description}</p>
                          <button onClick={() => setViewingShopId(shop.id)} className="btn-primary w-full py-2 text-sm">Ver Serviços</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ETAPA 1: Serviços (CARROSSEL)
  if (viewingShopId && !selectedService) {
    return (
      <div className="max-w-5xl mx-auto p-4 animate-fade-in">
        <button onClick={handleBackToCatalog} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
          <ArrowLeft size={16}/> Voltar ao Catálogo
        </button>
        
        <section className="card-premium">
          <div className="border-b border-grafite-border pb-4 mb-6">
             <h2 className="text-2xl font-heading font-bold text-gold-main">Menu de Serviços</h2>
             <p className="text-text-secondary text-sm">Escolha seu próximo serviço em: <span className="text-text-primary font-semibold">{currentShopData?.name || 'Carregando...'}</span></p>
          </div>

          <div className="flex items-center gap-4 bg-grafite-main p-3 rounded-lg border border-grafite-border mb-6">
             <Scissors size={24} className="text-gold-main"/>
             <h3 className="text-lg font-heading font-semibold text-white">Serviços Disponíveis</h3>
          </div>

          {services.length > 0 ? (
            <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar whitespace-nowrap -mx-4 px-4 md:mx-0 md:px-0">
              {services.map(service => (
                <div key={service.id} 
                     className="w-[220px] flex-shrink-0 bg-grafite-card border border-grafite-border rounded-xl overflow-hidden hover:border-gold-main/50 transition-all cursor-pointer shadow-lg" 
                     onClick={() => handleSelectService(service)}
                >
                  <div className="h-28 overflow-hidden bg-grafite-main flex items-center justify-center border-b border-grafite-border">
                    {service.imageUrl ? (
                        <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"/>
                    ) : (
                        <ImageIcon size={32} className="text-text-secondary/20"/>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <h4 className="text-sm font-bold text-text-primary truncate">{service.name}</h4>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-gold-main font-bold text-lg">R$ {service.price.toFixed(2)}</span>
                      <span className="text-xs text-text-secondary bg-grafite-surface px-2 py-1 rounded">{service.duration} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-secondary py-8">Nenhum serviço disponível.</p>
          )}

          {products.length > 0 && !isLoadingProducts && (
            <div className="mt-8 p-3 bg-grafite-main rounded-lg border border-grafite-border text-sm text-text-secondary flex items-center gap-2">
               <Package size={16} className="text-gold-main"/> **{products.length} Produtos disponíveis.** Você poderá adicioná-los após escolher o horário.
            </div>
          )}

        </section>
      </div>
    );
  }

  // ETAPA 2: Profissionais
  if (selectedService && !selectedProfessional) { 
    return ( 
        <div className="max-w-5xl mx-auto p-4 animate-fade-in">
        <button onClick={resetSelection} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
          <ArrowLeft size={16}/> Voltar aos Serviços
        </button>
        <section className="card-premium">
          <div className="border-b border-grafite-border pb-4 mb-6">
             <h2 className="text-2xl font-heading font-bold text-gold-main">Escolha o Profissional</h2>
             <p className="text-text-secondary text-sm">Para: <span className="text-text-primary font-semibold">{selectedService?.name}</span></p>
          </div>
          {isLoadingProfessionals ? (
             <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>
          ) : (
            availableProfessionals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {availableProfessionals.map(prof => (
                  <div key={prof.id} className="bg-grafite-main border border-grafite-border p-6 rounded-xl hover:shadow-glow hover:border-gold-main/50 transition-all cursor-pointer flex flex-col items-center gap-4 text-center group" onClick={() => setSelectedProfessional(prof)}>
                    <div className="w-16 h-16 rounded-full bg-grafite-surface border-2 border-grafite-border flex items-center justify-center text-2xl font-bold text-gold-main group-hover:border-gold-main transition-colors">
                      {prof.name.charAt(0).toUpperCase()}
                    </div>
                    <h4 className="text-lg font-bold text-text-primary">{prof.name}</h4>
                    <span className="text-xs text-gold-main border border-gold-main/30 px-3 py-1 rounded-full">Selecionar</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-text-secondary py-8">Nenhum profissional disponível para este serviço.</p>
            )
          )}
        </section>
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

  // ETAPA 4: Upsell de Produtos
  if (selectedService && selectedProfessional && selectedSlot && checkoutStage === 'products') {
    return (
        <div className="max-w-6xl mx-auto p-4 animate-fade-in">
          <button onClick={() => setCheckoutStage('slots')} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
            <ArrowLeft size={16}/> Voltar para Horários
          </button>

          <h2 className="text-2xl font-heading font-bold text-gold-main mb-6">Deseja adicionar algo?</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Produtos para Upsell */}
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
            
            {/* Resumo do Carrinho */}
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

  // ETAPA 5: Revisão e Pagamento
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
                              <span>Pagar R$ {finalTotal.toFixed(2)} na Barbearia</span>
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