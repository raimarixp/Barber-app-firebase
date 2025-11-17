// src/components/ClientPanel/ClientPanel.jsx
// (COMPLETO - Com Catálogo, Agendamento e "Meus Agendamentos" [Apenas Leitura])
import { functions } from '../../firebase/firebase-config';
import { httpsCallable } from 'firebase/functions';
import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase/firebase-config';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  doc,
  getDoc,
  addDoc,
  Timestamp,
  onSnapshot
} from "firebase/firestore"; 

// Importe o Calendário e os arquivos CSS
import Calendar from 'react-calendar';
import './Calendar.css';
import styles from './ClientPanel.module.css';

// Importe o Contexto
import { useShop } from '../../App.jsx';

const daysOfWeek = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

// Helper functions movidas para fora do componente
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
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState(null); 
  const [availableProfessionals, setAvailableProfessionals] = useState([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

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

    // Esta consulta precisa do Índice Composto que você criou
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("clientId", "==", auth.currentUser.uid),
      where("startTime", ">=", today),
      // Mostra 'confirmado' E 'check-in' (se o cliente fez check-in e recarregou)
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
  }, []); // '[]' = Rode uma vez

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
    } catch (error) { 
      console.error("Erro ao buscar barbearias: ", error); 
      alert("Erro ao buscar lojas. (O índice do Firestore pode estar sendo criado, tente em 1 min)");
    } finally {
      setIsLoadingShops(false);
    }
  };

  // 3. Busca Serviços (Roda quando 'viewingShopId' é definido)
  useEffect(() => {
    if (viewingShopId) { 
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
        } catch (error) { console.error("Erro ao buscar serviços: ", error); } 
        finally { setIsLoadingServices(false); }
      };
      fetchServices();
    }
  }, [viewingShopId]);

  // 4. Busca Profissionais (Roda ao selecionar serviço)
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
      alert("Erro ao buscar profissionais. Verifique o console (F12) para um link de criação de índice.");
    } 
    finally { setIsLoadingProfessionals(false); }
  };

  // 5. Busca Slots (O "Motor")
  useEffect(() => {
    if (!selectedProfessional || !selectedDate || !selectedService) return;
    
    const fetchAvailableSlots = async () => {
      setIsLoadingSlots(true);
      setAvailableSlots([]);
      const dayKey = daysOfWeek[selectedDate.getDay()];
      
      try {
        // A. Busque o Horário de Trabalho
        const workHoursRef = doc(db, "professionals", selectedProfessional.id, "workingHours", dayKey);
        const workHoursSnap = await getDoc(workHoursRef);
        if (!workHoursSnap.exists() || !workHoursSnap.data().isWorking) {
          console.log("Profissional não trabalha neste dia.");
          setIsLoadingSlots(false); 
          return;
        }
        const { startTime, endTime } = workHoursSnap.data();
        const duration = selectedService.duration;
        
        // B. Busque os Agendamentos JÁ FEITOS
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
        const bookedSlots = appointmentsSnapshot.docs.map(doc => 
          doc.data().startTime.toDate().toTimeString().substring(0, 5)
        );
        
        // C. Busque os BLOQUEIOS
        const blockedPeriods = [];
        const blocksCollectionRef = collection(db, "professionals", selectedProfessional.id, "blockedTimes");
        
        const recurringQuery = query(blocksCollectionRef, where("type", "==", "recurring"), where("dayOfWeek", "==", dayKey));
        const recurringSnapshot = await getDocs(recurringQuery);
        recurringSnapshot.forEach(doc => blockedPeriods.push(doc.data()));
        
        const singleQuery = query(blocksCollectionRef, where("type", "==", "single"), where("date", "==", Timestamp.fromDate(startOfDay)));
        const singleSnapshot = await getDocs(singleQuery);
        singleSnapshot.forEach(doc => blockedPeriods.push(doc.data()));
        
        // D. Calcule os slots livres
        const freeSlots = generateTimeSlots(startTime, endTime, duration, bookedSlots, blockedPeriods);
        setAvailableSlots(freeSlots);
        
      } catch (error) {
        console.error("Erro ao buscar slots: ", error);
        alert("Erro ao calcular horários. Verifique o console (F12) por erros de índice.");
      } finally {
        setIsLoadingSlots(false);
      }
    };
    
    fetchAvailableSlots();
  }, [selectedDate, selectedProfessional, selectedService]); 
  

  // 6. Confirmar Agendamento (LÓGICA HÍBRIDA)
  const handleConfirmBooking = async (slot) => {
    if (!window.confirm(`Confirmar agendamento de ${selectedService.name} com ${selectedProfessional.name} às ${slot}?`)) return;
    
    // Feedback visual
    // (Idealmente use um estado separado para loading do botão, mas aqui usamos o de slots)
    
    try {
      const [hour, minute] = slot.split(':').map(Number);
      const startTimeObj = new Date(selectedDate);
      startTimeObj.setHours(hour, minute, 0, 0);
      const endTimeObj = new Date(startTimeObj.getTime() + selectedService.duration * 60000);
      
      // 1. VERIFICAR SE A LOJA ACEITA PAGAMENTO ONLINE
      // Precisamos buscar o documento da loja (barbershop) para ver o 'onlinePaymentEnabled'
      // Como já buscamos as lojas no início (state 'barbershops'), podemos procurar lá.
      const currentShop = barbershops.find(s => s.id === viewingShopId);
      
      // Se a loja NÃO tem pagamento ativado, agende direto (Pagar na Loja)
      if (!currentShop?.onlinePaymentEnabled) {
        console.log("Loja sem pagamento online. Agendando direto...");
        
        await addDoc(collection(db, "appointments"), {
          clientId: auth.currentUser.uid,
          professionalId: selectedProfessional.id,
          serviceId: selectedService.id,
          barbershopId: viewingShopId,
          startTime: Timestamp.fromDate(startTimeObj),
          endTime: Timestamp.fromDate(endTimeObj),
          status: "confirmed",
          paymentMethod: "in_store" // Marcamos que será pago na loja
        });
        
        alert("Agendamento confirmado! (Pagamento no local)");
        resetSelection();
        return; // FIM DO FLUXO
      }

      // 2. SE TEM PAGAMENTO ONLINE, CHAME A CLOUD FUNCTION
      console.log("Loja com pagamento online. Iniciando checkout...");
      
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
        alert("Erro ao gerar pagamento. Tente novamente.");
      }

    } catch (error) {
      console.error("Erro no agendamento: ", error);
      alert("Ocorreu um erro: " + error.message);
    }
  };

  // --- Funções de Navegação "Voltar" ---
  const resetSelection = () => {
    setSelectedService(null);
    setAvailableProfessionals([]);
    setSelectedProfessional(null);
    setSelectedDate(new Date());
    setAvailableSlots([]);
  };
  
  const backToProfessionals = () => {
    setSelectedProfessional(null);
    setSelectedDate(new Date());
    setAvailableSlots([]);
  };
  
  const handleBackToCatalog = () => {
    setViewingShopId(null);
    resetSelection();
    setSearchedCity(''); 
    setSearchCity('');
  };
  
  const handleSelectProfessional = (prof) => setSelectedProfessional(prof);
  const handleSelectDate = (date) => setSelectedDate(date);

  
  // --- RENDERIZAÇÃO (JSX) ---

  // ETAPA 0: Mostrar Barra de Busca E "Meus Agendamentos"
  if (!viewingShopId) {
    return (
      <div className={styles.panel}>
        
        {/* Seção "Meus Agendamentos" (Simplificada) */}
        {!isLoadingAppointments && myAppointments.length > 0 && (
          <div className={styles.appointmentsList}>
            <h2 className={styles.title}>Meus Próximos Agendamentos</h2>
            {myAppointments.map(app => (
              <div key={app.id} className={styles.appointmentCard}>
                <h4>Agendamento Confirmado</h4>
                <p>
                  <strong>Data:</strong> {app.startTime.toDate().toLocaleDateString('pt-BR')}
                  {' às '}
                  {app.startTime.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                </p>
                <p style={{color: '#007bff', fontWeight: 'bold'}}>
                  Status: {app.status === 'checked_in' ? 'Check-in Realizado' : 'Confirmado'}
                </p>
              </div>
            ))}
          </div>
        )}
        
        {/* Seção "Encontre uma Barbearia" */}
        <div style={{marginTop: '20px'}}>
          <h2 className={styles.title}>Encontre uma Barbearia</h2>
          <form onSubmit={handleSearchCity} className={styles.searchForm}> 
            <label className={styles.formField} htmlFor="searchCity">
              <span>Digite sua cidade:</span>
              <input 
                type="text" 
                id="searchCity" 
                name="searchCity"
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </label>
            <button type="submit" className={styles.saveButton}>
              {isLoadingShops ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
          
          {/* Lista de Resultados */}
          {searchedCity && (
            <div style={{marginTop: '20px'}}>
              <h3 className={styles.title}>Resultados para "{searchedCity}"</h3>
              {isLoadingShops ? <p>Carregando...</p> : (
                barbershops.length === 0 ? (
                  <p>Nenhuma barbearia encontrada nesta cidade.</p>
                ) : (
                  <div className={styles.shopCatalog}>
                    {barbershops.map(shop => (
                      <div key={shop.id} className={styles.shopCard}>
                        <img 
                          src={shop.logoUrl} 
                          alt={`Logo da ${shop.name}`} 
                          style={{width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px'}} 
                        />
                        <h4 style={{marginTop: '10px'}}>{shop.name}</h4>
                        <p>{shop.cidade}</p>
                        <p style={{fontStyle: 'italic', color: '#666'}}>{shop.description.substring(0, 100)}...</p>
                        <p>{shop.address}</p>
                        <button onClick={() => setViewingShopId(shop.id)} className={styles.actionButton}>
                          Ver Serviços
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Se uma loja FOI selecionada, mostre o fluxo de agendamento ---
  
  // ETAPA 1: Mostrar Lista de Serviços (da loja selecionada)
  if (viewingShopId && !selectedService) {
    return (
      <div className={styles.panel}>
        <button onClick={handleBackToCatalog} className={styles.backButton}>&larr; Voltar ao Catálogo</button>
        <h2 className={styles.title}>Nossos Serviços</h2>
        {isLoadingServices ? <p>Carregando serviços...</p> : (
          services.length > 0 ? (
            <div className={styles.serviceList}>
              {services.map(service => (
                <div key={service.id} className={styles.serviceCard}>
                  <h4>{service.name}</h4>
                  <p>Preço: R$ {service.price.toFixed(2)}</p>
                  <p>Duração: {service.duration} minutos</p>
                  <button onClick={() => handleSelectService(service)} className={styles.actionButton}>
                    Agendar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p>Nenhum serviço cadastrado para esta barbearia.</p>
          )
        )}
      </div>
    );
  }

  // ETAPA 2: Mostrar Profissionais
  if (selectedService && !selectedProfessional) {
    return (
      <div className={styles.panel}>
        <button onClick={resetSelection} className={styles.backButton}>&larr; Voltar aos Serviços</button>
        <h2 className={styles.title}>Escolha um Profissional para: {selectedService.name}</h2>
        {isLoadingProfessionals ? <p>Buscando profissionais...</p> : (
          availableProfessionals.length > 0 ? (
            <div className={styles.professionalList}>
              {availableProfessionals.map(prof => (
                <div key={prof.id} className={styles.professionalCard}>
                  <h4>{prof.name}</h4>
                  <button onClick={() => handleSelectProfessional(prof)} className={styles.actionButton}>
                    Escolher {prof.name}
                  </button> 
                </div>
              ))}
            </div>
          ) : (
            !isLoadingProfessionals && <p>Nenhum profissional oferece este serviço no momento.</p>
          )
        )}
      </div>
    );
  }

  // ETAPA 3: Mostrar Calendário E Slots
  if (selectedService && selectedProfessional) {
    return (
      <div className={styles.panel}>
        <button onClick={backToProfessionals} className={styles.backButton}>&larr; Voltar aos Profissionais</button>
        <h2 className={styles.title}>Escolha um dia para: {selectedService.name}</h2>
        <p>Com: {selectedProfessional.name}</p>
        
        <div className={styles.calendarContainer}>
          <Calendar 
            onChange={handleSelectDate} 
            value={selectedDate}
            minDate={new Date()}
            className="react-calendar" // Usa o CSS do 'Calendar.css'
          />
          <div className={styles.slotsContainer}>
            <h4>Horários Livres para {selectedDate.toLocaleDateString('pt-BR')}</h4>
            {isLoadingSlots && <p>Calculando...</p>}
            {availableSlots.length > 0 && !isLoadingSlots && (
              <div className={styles.slotsGrid}>
                {availableSlots.map(slot => (
                  <button key={slot} onClick={() => handleConfirmBooking(slot)} className={styles.slotButton}>
                    {slot}
                  </button>
                ))}
              </div>
            )}
            {availableSlots.length === 0 && !isLoadingSlots && (
              <p>Nenhum horário livre para este dia.</p>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ClientPanel;