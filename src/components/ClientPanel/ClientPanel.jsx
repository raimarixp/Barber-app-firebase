// src/components/ClientPanel/ClientPanel.jsx
// (Refatorado para "Catálogo" com React Context)

import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../../firebase/firebase-config';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  doc,
  getDoc,
  addDoc,
  Timestamp
} from "firebase/firestore"; 

// 1. Importe os DOIS arquivos CSS
import Calendar from 'react-calendar';
import './Calendar.css';
import styles from './ClientPanel.module.css';

// 2. MUDANÇA: Importe o Contexto
import { useShop } from '../../App.jsx';

const daysOfWeek = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

function ClientPanel() {
  // 3. MUDANÇA: Pegue o 'viewingShopId' do Contexto
  const { viewingShopId, setViewingShopId } = useShop();

  // --- Estados do Catálogo ---
  const [barbershops, setBarbershops] = useState([]);
  const [isLoadingShops, setIsLoadingShops] = useState(true);

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
  
  // 4. MUDANÇA: Este useEffect AGORA SÓ BUSCA O CATÁLOGO
  // Ele roda se 'viewingShopId' for 'null'
  useEffect(() => {
    if (!viewingShopId) { // Se não estamos olhando uma loja...
      setIsLoadingShops(true);
      const fetchShops = async () => {
        try {
          const shopsCollectionRef = collection(db, "barbershops");
          const querySnapshot = await getDocs(shopsCollectionRef);
          const shopsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setBarbershops(shopsList);
        } catch (error) { 
          console.error("Erro ao buscar barbearias: ", error); 
        } finally {
          setIsLoadingShops(false);
        }
      };
      fetchShops();
    }
  }, [viewingShopId]); // Roda quando 'viewingShopId' muda (ex: volta a ser 'null')

  // 5. MUDANÇA: Este useEffect AGORA SÓ BUSCA SERVIÇOS
  // Ele roda se 'viewingShopId' TIVER UM VALOR
  useEffect(() => {
    if (viewingShopId) { // Se estamos olhando uma loja...
      const fetchServices = async () => {
        setIsLoadingServices(true);
        try {
          const servicesQuery = query(
            collection(db, "services"),
            where("barbershopId", "==", viewingShopId) // O FILTRO!
          );
          const querySnapshot = await getDocs(servicesQuery);
          const servicesList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setServices(servicesList);
        } catch (error) { console.error("Erro ao buscar serviços: ", error); } 
        finally { setIsLoadingServices(false); }
      };
      fetchServices();
    }
  }, [viewingShopId]); // Roda quando 'viewingShopId' muda

  // 6. MUDANÇA: handleSelectService agora filtra profissionais PELA LOJA
  const handleSelectService = async (service) => {
    setSelectedService(service);
    setIsLoadingProfessionals(true);
    setAvailableProfessionals([]);
    try {
      const profQuery = query(
        collection(db, "professionals"),
        where("barbershopId", "==", viewingShopId), // O FILTRO!
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
  
  // 7. MUDANÇA: handleConfirmBooking agora carimba o 'barbershopId'
  const handleConfirmBooking = async (slot) => {
    if (!window.confirm(`Confirmar agendamento de ${selectedService.name} com ${selectedProfessional.name} às ${slot} no dia ${selectedDate.toLocaleDateString()}?`)) {
      return;
    }
    try {
      const [hour, minute] = slot.split(':').map(Number);
      const startTimeObj = new Date(selectedDate);
      startTimeObj.setHours(hour, minute, 0, 0);
      const endTimeObj = new Date(startTimeObj.getTime() + selectedService.duration * 60000);
      
      await addDoc(collection(db, "appointments"), {
        clientId: auth.currentUser.uid,
        professionalId: selectedProfessional.id,
        serviceId: selectedService.id,
        barbershopId: viewingShopId, // O FILTRO!
        startTime: Timestamp.fromDate(startTimeObj),
        endTime: Timestamp.fromDate(endTimeObj),
        status: "confirmed"
      });
      alert("Agendamento confirmado com sucesso!");
      resetSelection();
    } catch (error) {
      console.error("Erro ao confirmar agendamento: ", error);
      alert("Erro ao salvar agendamento.");
    }
  };

  // Funções de "Voltar" (Atualizadas)
  const resetSelection = () => { // Volta para a lista de serviços
    setSelectedService(null);
    setAvailableProfessionals([]);
    setSelectedProfessional(null);
    setSelectedDate(new Date());
    setAvailableSlots([]);
  };
  const backToProfessionals = () => { // Volta para a lista de profissionais
    setSelectedProfessional(null);
    setSelectedDate(new Date());
    setAvailableSlots([]);
  };
  const handleBackToCatalog = () => { // (NOVO) Volta para o Catálogo
    setViewingShopId(null); // Limpa o Contexto
    resetSelection(); // Limpa todos os outros estados
  };

  // Funções de lógica (generateTimeSlots, fetchAvailableSlots, etc.)
  // (Nenhuma mudança necessária aqui, elas dependem de 'selectedProfessional',
  // que já foi filtrado pelo 'viewingShopId')
  const handleSelectProfessional = (prof) => { /* ... (código igual) ... */ };
  const handleSelectDate = (date) => { /* ... (código igual) ... */ };
  useEffect(() => { /* ... (código do useEffect que busca SLOTS) ... */ }, [selectedDate, selectedProfessional, selectedService]);
  // (Vou colar o useEffect dos slots aqui para garantir que esteja completo)
  useEffect(() => {
    if (!selectedProfessional || !selectedDate || !selectedService) return;
    const timeToMinutes = (time) => {
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
    const fetchAvailableSlots = async () => {
      setIsLoadingSlots(true);
      setAvailableSlots([]);
      const dayKey = daysOfWeek[selectedDate.getDay()];
      try {
        const workHoursRef = doc(db, "professionals", selectedProfessional.id, "workingHours", dayKey);
        const workHoursSnap = await getDoc(workHoursRef);
        if (!workHoursSnap.exists() || !workHoursSnap.data().isWorking) {
          setIsLoadingSlots(false); return;
        }
        const { startTime, endTime } = workHoursSnap.data();
        const duration = selectedService.duration;
        const startOfDay = new Date(selectedDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate); endOfDay.setHours(23, 59, 59, 999);
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
        const blockedPeriods = [];
        const blocksCollectionRef = collection(db, "professionals", selectedProfessional.id, "blockedTimes");
        const recurringQuery = query(blocksCollectionRef, where("type", "==", "recurring"), where("dayOfWeek", "==", dayKey));
        const recurringSnapshot = await getDocs(recurringQuery);
        recurringSnapshot.forEach(doc => blockedPeriods.push(doc.data()));
        const singleQuery = query(blocksCollectionRef, where("type", "==", "single"), where("date", "==", Timestamp.fromDate(startOfDay)));
        const singleSnapshot = await getDocs(singleQuery);
        singleSnapshot.forEach(doc => blockedPeriods.push(doc.data()));
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


  // --- RENDERIZAÇÃO (JSX) (com CSS Modules) ---

  // 8. MUDANÇA: A lógica de renderização principal
  
  // ETAPA 0: Mostrar Catálogo de Lojas (se nenhuma loja foi selecionada)
  if (!viewingShopId) {
    return (
      <div className={styles.panel}>
        <h2 className={styles.title}>Encontre uma Barbearia</h2>
        {isLoadingShops ? <p>Carregando barbearias...</p> : (
          <div className={styles.shopCatalog}>
            {barbershops.length === 0 ? (
              <p>Nenhuma barbearia cadastrada na plataforma ainda.</p>
            ) : (
              barbershops.map(shop => (
                <div key={shop.id} className={styles.shopCard}>
                  <h4>{shop.name}</h4>
                  <p>{shop.address}</p>
                  <button onClick={() => setViewingShopId(shop.id)} className={styles.actionButton}>
                    Ver Serviços
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Se uma loja FOI selecionada, mostre o fluxo de agendamento ---
  // ----- HTML --------
  // ETAPA 1: Mostrar Lista de Serviços (da loja selecionada)
  if (!selectedService) {
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
        {isLoadingProfessionals && <p>Buscando profissionais...</p>}
        {availableProfessionals.length > 0 ? (
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
            <h4>Horários Livres para {selectedDate.toLocaleDateString()}</h4>
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