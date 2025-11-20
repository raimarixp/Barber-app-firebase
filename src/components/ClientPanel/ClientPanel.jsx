// src/components/ClientPanel/ClientPanel.jsx
// (COMPLETO - Visual Premium + Lógica de Pagamento Híbrida)

import { useState, useEffect, useCallback } from 'react';
import { functions, db, auth } from '../../firebase/firebase-config';
import { httpsCallable } from 'firebase/functions';
import { 
  collection, getDocs, query, where, doc, getDoc, 
  addDoc, Timestamp, onSnapshot 
} from "firebase/firestore"; 
import Calendar from 'react-calendar';
import './Calendar.css'; // Mantemos para a estrutura base, mas estilizaremos via container
import { useShop } from '../../App.jsx';
import { toast } from 'sonner';
import { 
  MapPin, Calendar as CalIcon, Clock, Scissors, 
  User, CheckCircle, CreditCard, Store, Search, ArrowLeft 
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
        isBlocked = true;
        break;
      }
    }
    if (isBlocked) continue;
    
    slots.push(slotString);
  }
  return slots;
};

function ClientPanel() {
  const { viewingShopId, setViewingShopId } = useShop();

  // --- Estados do Catálogo ---
  const [searchCity, setSearchCity] = useState('');
  const [searchedCity, setSearchedCity] = useState('');
  const [barbershops, setBarbershops] = useState([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);

  // --- Estados do Fluxo de Agendamento ---
  const [services, setServices] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false); // Inicializa false até selecionar loja
  const [selectedService, setSelectedService] = useState(null); 
  const [availableProfessionals, setAvailableProfessionals] = useState([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // --- Estados de Modal e Pagamento ---
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentShopData, setCurrentShopData] = useState(null);

  // --- Estado para "Meus Agendamentos" ---
  const [myAppointments, setMyAppointments] = useState([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  
  // --- LÓGICA DE BUSCA E CARREGAMENTO ---

  // 1. Busca os MEUS agendamentos (em tempo real)
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

  // 2. Busca Lojas por Cidade
  const handleSearchCity = async (e) => {
    e.preventDefault();
    if (!searchCity) return;
    
    setIsLoadingShops(true);
    setBarbershops([]);
    
    const normalizedSearch = searchCity
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    try {
      const shopsQuery = query(
        collection(db, "barbershops"),
        where("cidadeQuery", "==", normalizedSearch)
      );
      const querySnapshot = await getDocs(shopsQuery);
      const shopsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBarbershops(shopsList);
      setSearchedCity(searchCity);
      if(shopsList.length === 0) toast.info("Nenhuma barbearia encontrada nesta cidade.");
    } catch (error) { 
      console.error("Erro ao buscar barbearias: ", error); 
      toast.error("Erro ao buscar lojas. Verifique sua conexão.");
    } finally {
      setIsLoadingShops(false);
    }
  };

  // 3. Carregar dados da loja selecionada (para verificar configs de pagamento)
  useEffect(() => {
    if (viewingShopId) {
      const fetchShopData = async () => {
         try {
           const shopDoc = await getDoc(doc(db, "barbershops", viewingShopId));
           if (shopDoc.exists()) {
             setCurrentShopData(shopDoc.data());
           }
         } catch (error) {
           console.error("Erro ao carregar dados da loja", error);
         }
      };
      fetchShopData();

      // Carregar Serviços
      const fetchServices = async () => {
        setIsLoadingServices(true);
        try {
          const servicesQuery = query(
            collection(db, "services"),
            where("barbershopId", "==", viewingShopId)
          );
          const querySnapshot = await getDocs(servicesQuery);
          const servicesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setServices(servicesList);
        } catch (error) { 
            console.error("Erro ao buscar serviços: ", error);
            toast.error("Erro ao carregar serviços.");
        } 
        finally { setIsLoadingServices(false); }
      };
      fetchServices();
    }
  }, [viewingShopId]);

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
      const professionalsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableProfessionals(professionalsList);
    } catch (error) { 
      console.error("Erro ao buscar profissionais: ", error); 
      toast.error("Erro ao carregar profissionais.");
    } 
    finally { setIsLoadingProfessionals(false); }
  };

  // 5. Busca Slots (Motor de Agendamento)
  useEffect(() => {
    if (!selectedProfessional || !selectedDate || !selectedService) return;
    
    const fetchAvailableSlots = async () => {
      setIsLoadingSlots(true);
      setAvailableSlots([]);
      const dayKey = daysOfWeek[selectedDate.getDay()];
      
      try {
        // A. Horário de Trabalho
        const workHoursRef = doc(db, "professionals", selectedProfessional.id, "workingHours", dayKey);
        const workHoursSnap = await getDoc(workHoursRef);
        if (!workHoursSnap.exists() || !workHoursSnap.data().isWorking) {
          setIsLoadingSlots(false); 
          return;
        }
        const { startTime, endTime } = workHoursSnap.data();
        const duration = selectedService.duration;
        
        // B. Agendamentos Existentes
        const startOfDay = new Date(selectedDate); 
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate); 
        endOfDay.setHours(23, 59, 59, 999);
        
        const appointmentsQuery = query(
          collection(db, "appointments"),
          where("professionalId", "==", selectedProfessional.id),
          where("startTime", ">=", Timestamp.fromDate(startOfDay)),
          where("startTime", "<=", Timestamp.fromDate(endOfDay))
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        // Consideramos agendamentos que não foram cancelados/rejeitados
        const bookedSlots = appointmentsSnapshot.docs
            .filter(d => !['cancelled_by_client', 'cancelled_by_pro'].includes(d.data().status))
            .map(doc => doc.data().startTime.toDate().toTimeString().substring(0, 5));
        
        // C. Bloqueios
        const blockedPeriods = [];
        const blocksCollectionRef = collection(db, "professionals", selectedProfessional.id, "blockedTimes");
        
        const recurringQuery = query(blocksCollectionRef, where("type", "==", "recurring"), where("dayOfWeek", "==", dayKey));
        const recurringSnapshot = await getDocs(recurringQuery);
        recurringSnapshot.forEach(doc => blockedPeriods.push(doc.data()));
        
        const singleQuery = query(blocksCollectionRef, where("type", "==", "single"), where("date", "==", Timestamp.fromDate(startOfDay)));
        const singleSnapshot = await getDocs(singleQuery);
        singleSnapshot.forEach(doc => blockedPeriods.push(doc.data()));
        
        // D. Cálculo
        const freeSlots = generateTimeSlots(startTime, endTime, duration, bookedSlots, blockedPeriods);
        setAvailableSlots(freeSlots);
        
      } catch (error) {
        console.error("Erro ao buscar slots: ", error);
        toast.error("Erro ao calcular horários.");
      } finally {
        setIsLoadingSlots(false);
      }
    };
    
    fetchAvailableSlots();
  }, [selectedDate, selectedProfessional, selectedService]); 
  
  // --- LÓGICA DE AGENDAMENTO & PAGAMENTO ---

  // Função inicial ao clicar no horário
  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    
    // 1. Se a loja NÃO tem pagamento online habilitado -> Pagar na Loja direto
    if (!currentShopData?.onlinePaymentEnabled) {
       if (window.confirm(`Confirmar agendamento para ${slot}?`)) {
          processBooking('in_store');
       }
       return;
    }

    // 2. Se a loja TEM pagamento online
    // Verifica se é OBRIGATÓRIO (requirePayment)
    if (currentShopData?.requirePayment) {
       // Redireciona direto para pagamento online
       if (window.confirm(`Ir para pagamento do agendamento das ${slot}?`)) {
          processBooking('online');
       }
    } else {
       // NÃO é obrigatório -> Abre Modal de Escolha
       setShowPaymentModal(true);
    }
  };

  // Processa o agendamento baseado no método escolhido
  const processBooking = async (method) => {
    const slot = selectedSlot;
    if (!slot) return;

    try {
      const [hour, minute] = slot.split(':').map(Number);
      const startTimeObj = new Date(selectedDate);
      startTimeObj.setHours(hour, minute, 0, 0);
      const endTimeObj = new Date(startTimeObj.getTime() + selectedService.duration * 60000);

      // A) PAGAR NA LOJA
      if (method === 'in_store') {
        await addDoc(collection(db, "appointments"), {
          clientId: auth.currentUser.uid,
          professionalId: selectedProfessional.id,
          serviceId: selectedService.id,
          barbershopId: viewingShopId,
          startTime: Timestamp.fromDate(startTimeObj),
          endTime: Timestamp.fromDate(endTimeObj),
          status: "confirmed",
          paymentMethod: "in_store",
          createdAt: Timestamp.now()
        });
        
        toast.success("Agendamento confirmado!");
        setShowPaymentModal(false);
        resetSelection();
      }
      
      // B) PAGAR ONLINE (Mercado Pago)
      else if (method === 'online') {
        toast.loading("Gerando pagamento...");
        
        const payload = {
          title: `${selectedService.name} - ${selectedProfessional.name}`,
          price: selectedService.price,
          appointmentData: {
            clientId: auth.currentUser.uid,
            professionalId: selectedProfessional.id,
            serviceId: selectedService.id,
            barbershopId: viewingShopId,
            startTime: startTimeObj.toISOString(), 
            endTime: endTimeObj.toISOString(),
            slotTime: slot 
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
      console.error("Erro no agendamento: ", error);
      toast.error("Erro ao processar agendamento: " + error.message);
    }
  };

  // --- Navegação ---
  const resetSelection = () => {
    setSelectedService(null);
    setAvailableProfessionals([]);
    setSelectedProfessional(null);
    setSelectedDate(new Date());
    setAvailableSlots([]);
    setSelectedSlot(null);
    setShowPaymentModal(false);
  };
  
  const backToProfessionals = () => {
    setSelectedProfessional(null);
    setSelectedDate(new Date());
    setAvailableSlots([]);
    setSelectedSlot(null);
  };
  
  const handleBackToCatalog = () => {
    setViewingShopId(null);
    resetSelection();
    setSearchedCity(''); 
    setSearchCity('');
  };
  
  // --- JSX ---

  // ETAPA 0: Dashboard Inicial
  if (!viewingShopId) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8 animate-fade-in">
        
        {/* Meus Agendamentos */}
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
                    <span className="text-lg font-bold text-text-primary">
                      {app.startTime.toDate().toLocaleDateString('pt-BR')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold border ${app.status === 'checked_in' ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-blue-900/20 border-blue-500 text-blue-400'}`}>
                       {app.status === 'checked_in' ? 'Check-in' : 'Confirmado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gold-main">
                     <Clock size={16}/>
                     <span className="font-mono text-lg">
                       {app.startTime.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                     </span>
                  </div>
                </div>
              ))}
             </div>
          </section>
        )}
        
        {/* Busca de Barbearias */}
        <section className="card-premium">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold text-gold-main mb-2">Encontre sua Barbearia</h2>
            <p className="text-text-secondary">Busque pelos melhores profissionais da sua cidade.</p>
          </div>
          
          <form onSubmit={handleSearchCity} className="relative max-w-lg mx-auto mb-8"> 
            <input 
              type="text" 
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Digite sua cidade (ex: São Paulo)"
              className="input-premium pr-12 h-12"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gold-main hover:text-white transition-colors">
              {isLoadingShops ? <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"/> : <Search size={24}/>}
            </button>
          </form>
          
          {/* Resultados */}
          {searchedCity && (
            <div className="animate-slide-up">
              <h3 className="text-lg font-semibold text-text-secondary mb-4">Resultados para "{searchedCity}"</h3>
              {isLoadingShops ? (
                 <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>
              ) : (
                barbershops.length === 0 ? (
                  <p className="text-center text-text-secondary italic py-8 bg-grafite-main rounded-lg border border-grafite-border border-dashed">
                    Nenhuma barbearia encontrada.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {barbershops.map(shop => (
                      <div key={shop.id} className="bg-grafite-main border border-grafite-border rounded-xl overflow-hidden hover:shadow-glow transition-all duration-300 group">
                        <div className="h-40 overflow-hidden">
                           <img 
                             src={shop.logoUrl} 
                             alt={shop.name} 
                             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                           />
                        </div>
                        <div className="p-5">
                          <h4 className="text-xl font-bold text-text-primary mb-1">{shop.name}</h4>
                          <p className="text-sm text-text-secondary mb-2 flex items-center gap-1"><MapPin size={14}/> {shop.cidade}</p>
                          <p className="text-sm text-text-secondary/70 line-clamp-2 mb-4 min-h-[40px]">{shop.description}</p>
                          <p className="text-xs text-text-secondary mb-4 truncate">{shop.address}</p>
                          <button onClick={() => setViewingShopId(shop.id)} className="btn-primary w-full py-2 text-sm">
                            Ver Serviços
                          </button>
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

  // ETAPA 1: Serviços
  if (viewingShopId && !selectedService) {
    return (
      <div className="max-w-5xl mx-auto p-4 animate-fade-in">
        <button onClick={handleBackToCatalog} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
          <ArrowLeft size={16}/> Voltar ao Catálogo
        </button>
        
        <section className="card-premium">
          <div className="border-b border-grafite-border pb-4 mb-6">
             <h2 className="text-2xl font-heading font-bold text-gold-main">Selecione um Serviço</h2>
             <p className="text-text-secondary text-sm">O que vamos fazer hoje?</p>
          </div>

          {isLoadingServices ? (
             <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>
          ) : (
            services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(service => (
                  <div key={service.id} className="bg-grafite-main border border-grafite-border p-5 rounded-xl hover:border-gold-main/50 transition-all cursor-pointer group" onClick={() => handleSelectService(service)}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-bold text-text-primary group-hover:text-gold-main transition-colors">{service.name}</h4>
                      <Scissors className="text-text-secondary group-hover:text-gold-main" size={20}/>
                    </div>
                    <div className="flex justify-between items-end mt-4">
                      <span className="text-gold-main font-bold text-xl">R$ {service.price.toFixed(2)}</span>
                      <span className="text-xs text-text-secondary bg-grafite-surface px-2 py-1 rounded">{service.duration} min</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-text-secondary py-8">Nenhum serviço disponível.</p>
            )
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
             <p className="text-text-secondary text-sm">Quem você prefere para: <span className="text-text-primary font-semibold">{selectedService.name}</span></p>
          </div>

          {isLoadingProfessionals ? (
             <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>
          ) : (
            availableProfessionals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {availableProfessionals.map(prof => (
                  <div key={prof.id} className="bg-grafite-main border border-grafite-border p-6 rounded-xl hover:shadow-glow hover:border-gold-main/50 transition-all cursor-pointer flex flex-col items-center gap-4 text-center group" onClick={() => handleSelectProfessional(prof)}>
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

  // ETAPA 3: Calendário e Pagamento
  if (selectedService && selectedProfessional) {
    return (
      <div className="max-w-6xl mx-auto p-4 animate-fade-in">
        <button onClick={backToProfessionals} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm">
          <ArrowLeft size={16}/> Voltar
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Resumo da Seleção */}
          <div className="lg:col-span-4 space-y-6">
             <div className="card-premium">
                <h3 className="text-lg font-heading font-bold text-text-primary mb-4 border-b border-grafite-border pb-2">Resumo</h3>
                <div className="space-y-4">
                   <div>
                      <p className="text-xs text-text-secondary uppercase">Serviço</p>
                      <p className="text-gold-main font-bold text-lg">{selectedService.name}</p>
                      <p className="text-sm text-text-primary">R$ {selectedService.price.toFixed(2)} • {selectedService.duration} min</p>
                   </div>
                   <div>
                      <p className="text-xs text-text-secondary uppercase">Profissional</p>
                      <p className="text-text-primary font-medium">{selectedProfessional.name}</p>
                   </div>
                   <div>
                      <p className="text-xs text-text-secondary uppercase">Data</p>
                      <p className="text-text-primary font-medium capitalize">
                        {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                   </div>
                </div>
             </div>
          </div>

          {/* Calendário e Slots */}
          <div className="lg:col-span-8 space-y-6">
             <div className="card-premium">
                <div className="flex flex-col md:flex-row gap-8">
                   
                   {/* Calendário Customizado */}
                   <div className="flex-1 flex justify-center md:justify-start">
                      <div className="calendar-wrapper text-text-primary">
                        <Calendar 
                          onChange={handleSelectDate} 
                          value={selectedDate}
                          minDate={new Date()}
                          className="react-calendar border-none bg-transparent"
                          tileClassName={({ date, view }) => {
                             // Lógica simples para destacar dias (opcional)
                             if(view === 'month' && date.getDay() === 0) return 'text-red-400'; 
                             return null;
                          }}
                        />
                      </div>
                   </div>

                   {/* Slots */}
                   <div className="flex-1 border-l border-grafite-border pl-0 md:pl-8 pt-6 md:pt-0">
                      <h4 className="text-sm font-bold text-text-secondary uppercase mb-4">Horários Disponíveis</h4>
                      {isLoadingSlots ? (
                        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-main"></div></div>
                      ) : (
                        availableSlots.length > 0 ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {availableSlots.map(slot => (
                              <button 
                                key={slot} 
                                onClick={() => handleSlotClick(slot)} 
                                className="py-2 px-1 rounded border border-grafite-border bg-grafite-main text-text-primary hover:bg-gold-main hover:text-grafite-main hover:border-gold-main transition-all text-sm font-medium"
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-text-secondary italic">Nenhum horário livre nesta data.</p>
                        )
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* MODAL DE ESCOLHA DE PAGAMENTO */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
             <div className="bg-grafite-card border border-grafite-border rounded-xl shadow-premium p-6 max-w-md w-full space-y-6">
                <div className="text-center">
                   <h3 className="text-2xl font-heading font-bold text-white mb-2">Como deseja pagar?</h3>
                   <p className="text-text-secondary text-sm">O pagamento online agiliza seu atendimento, mas você também pode pagar no balcão.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                   <button 
                     onClick={() => processBooking('online')}
                     className="flex items-center justify-between p-4 rounded-lg border border-gold-main/30 bg-gold-dim/10 hover:bg-gold-main hover:text-grafite-main group transition-all"
                   >
                      <div className="flex items-center gap-3">
                         <CreditCard className="text-gold-main group-hover:text-grafite-main" size={20}/>
                         <span className="font-semibold">Pagar Agora (Online)</span>
                      </div>
                      <span className="text-xs bg-gold-main text-grafite-main px-2 py-1 rounded font-bold group-hover:bg-grafite-main group-hover:text-gold-main">Recomendado</span>
                   </button>

                   <button 
                     onClick={() => processBooking('in_store')}
                     className="flex items-center justify-start gap-3 p-4 rounded-lg border border-grafite-border bg-grafite-main hover:bg-grafite-surface transition-all text-text-primary"
                   >
                      <Store className="text-text-secondary" size={20}/>
                      <span className="font-medium">Pagar na Barbearia</span>
                   </button>
                </div>

                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  className="w-full text-center text-text-secondary text-sm hover:text-white transition-colors"
                >
                  Cancelar
                </button>
             </div>
          </div>
        )}

      </div>
    );
  }
}

export default ClientPanel;