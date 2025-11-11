// src/components/ClientPanel.jsx (Etapa Final: Slots e Agendamento)

import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase-config';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  doc, // Para buscar docs específicos
  getDoc,
  addDoc, // Para criar o agendamento
  Timestamp // Para salvar datas
} from "firebase/firestore"; 

import Calendar from 'react-calendar';
import '../Calendar.css';

// Helper para os dias da semana (usado para buscar o dia certo)
const daysOfWeek = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

function ClientPanel() {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados do Fluxo
  const [selectedService, setSelectedService] = useState(null); 
  const [availableProfessionals, setAvailableProfessionals] = useState([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // --- NOVOS ESTADOS ---
  const [availableSlots, setAvailableSlots] = useState([]); // Array de horários (strings)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  
  // 1. Busca os serviços (sem mudança)
  useEffect(() => {
    const fetchServices = async () => {
      // ... (código de fetchServices igual a antes) ...
      setIsLoading(true);
      try {
        const servicesCollectionRef = collection(db, "services");
        const querySnapshot = await getDocs(servicesCollectionRef);
        const servicesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setServices(servicesList);
      } catch (error) { console.error("Erro ao buscar serviços: ", error); } 
      finally { setIsLoading(false); }
    };
    fetchServices();
  }, []); 

  // 2. Busca Profissionais (sem mudança)
  const handleSelectService = async (service) => {
    // ... (código de handleSelectService igual a antes) ...
    setSelectedService(service);
    setIsLoadingProfessionals(true);
    setAvailableProfessionals([]);
    try {
      const profQuery = query(
        collection(db, "professionals"),
        where("services", "array-contains", service.id) 
      );
      const querySnapshot = await getDocs(profQuery);
      const professionalsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableProfessionals(professionalsList);
    } catch (error) { console.error("Erro ao buscar profissionais: ", error); } 
    finally { setIsLoadingProfessionals(false); }
  };

  // 3. Seleciona Profissional (sem mudança)
  const handleSelectProfessional = (prof) => {
    setSelectedProfessional(prof);
    // Reseta os slots quando o profissional muda
    setAvailableSlots([]);
  };

  // 4. Seleciona Data (sem mudança)
  const handleSelectDate = (date) => {
    setSelectedDate(date);
    // Reseta os slots quando a data muda
    setAvailableSlots([]);
  };

  // --- 5. O CORAÇÃO: useEffect para buscar SLOTS ---
  // Roda sempre que o cliente escolhe um profissional OU uma data
  useEffect(() => {
    // Se não temos tudo o que precisamos, não faça nada
    if (!selectedProfessional || !selectedDate || !selectedService) {
      return;
    }
    
    // Função "Helper" para gerar os slots
    // Esta é a "mágica" de UI. Converte "09:00", "18:00" e "30min" em [09:00, 09:30, ...]
    const generateTimeSlots = (start, end, duration, bookedSlots) => {
      const slots = [];
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);
      
      let currentTime = new Date(selectedDate);
      currentTime.setHours(startHour, startMin, 0, 0);
      
      let endTime = new Date(selectedDate);
      endTime.setHours(endHour, endMin, 0, 0);

      while (currentTime < endTime) {
        const slotTime = currentTime.toTimeString().substring(0, 5); // Formato "HH:MM"
        
        // Verifica se o slot já não está em 'bookedSlots'
        if (!bookedSlots.includes(slotTime)) {
          slots.push(slotTime);
        }
        
        // Adiciona a duração para o próximo slot
        currentTime.setMinutes(currentTime.getMinutes() + duration);
      }
      return slots;
    };
    
    // Função "async" principal
    const fetchAvailableSlots = async () => {
      setIsLoadingSlots(true);
      setAvailableSlots([]); // Limpa os slots antigos
      
      // A. Pegue o dia da semana (ex: 'monday')
      const dayKey = daysOfWeek[selectedDate.getDay()];
      
      try {
        // B. Busque o Horário de Trabalho do profissional
        const workHoursRef = doc(db, "professionals", selectedProfessional.id, "workingHours", dayKey);
        const workHoursSnap = await getDoc(workHoursRef);
        
        if (!workHoursSnap.exists() || !workHoursSnap.data().isWorking) {
          console.log("Profissional não trabalha neste dia.");
          setAvailableSlots([]); // Vazio
          setIsLoadingSlots(false);
          return;
        }
        
        const { startTime, endTime } = workHoursSnap.data();
        const duration = selectedService.duration;
        
        // C. Busque os Agendamentos JÁ FEITOS para este dia/profissional
        
        // Crie os 'Timestamps' de início e fim do DIA
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
        
        // Crie um array simples de horários já reservados (ex: ["10:00", "11:30"])
        const bookedSlots = appointmentsSnapshot.docs.map(doc => {
          const startTime = doc.data().startTime.toDate();
          return startTime.toTimeString().substring(0, 5); // "HH:MM"
        });
        
        // D. Calcule os slots livres
        const freeSlots = generateTimeSlots(startTime, endTime, duration, bookedSlots);
        setAvailableSlots(freeSlots);
        
      } catch (error) {
        console.error("Erro ao buscar slots: ", error);
        alert("Erro ao calcular horários. Verifique o console (F12) por erros de índice.");
      } finally {
        setIsLoadingSlots(false);
      }
    };
    
    fetchAvailableSlots();
    
  }, [selectedDate, selectedProfessional, selectedService]); // Dependências
  

  // --- 6. FUNÇÃO FINAL: Confirmar o Agendamento ---
  const handleConfirmBooking = async (slot) => { // 'slot' é a string "HH:MM"
    if (!window.confirm(`Confirmar agendamento de ${selectedService.name} com ${selectedProfessional.name} às ${slot} no dia ${selectedDate.toLocaleDateString()}?`)) {
      return;
    }
    
    try {
      // 1. Prepare os Timestamps de início e fim
      const [hour, minute] = slot.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hour, minute, 0, 0);
      
      const endTime = new Date(startTime.getTime() + selectedService.duration * 60000); // Adiciona minutos
      
      // 2. Crie o documento de agendamento
      await addDoc(collection(db, "appointments"), {
        clientId: auth.currentUser.uid,
        professionalId: selectedProfessional.id,
        serviceId: selectedService.id,
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        status: "confirmed"
      });
      
      alert("Agendamento confirmado com sucesso!");
      
      // 3. Resete o fluxo
      resetSelection();
      
    } catch (error) {
      console.error("Erro ao confirmar agendamento: ", error);
      alert("Erro ao salvar agendamento.");
    }
  };

  // Funções de "Voltar" (sem mudança)
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

  // --- RENDERIZAÇÃO (com a Etapa 4) ---

  if (isLoading) return <h2>Carregando serviços...</h2>;

  // ETAPA 3: Mostrar Calendário E Slots
  if (selectedService && selectedProfessional) {
    return (
      <div>
        <button onClick={backToProfessionals}>&larr; Voltar aos Profissionais</button>
        <h2>Escolha um dia para: {selectedService.name}</h2>
        <p>Com: {selectedProfessional.name}</p>
        
        <div style={{ display: 'flex', gap: '20px' }}>
          <Calendar 
            onChange={handleSelectDate} 
            value={selectedDate}
            minDate={new Date()}
          />
          
          {/* A NOVA ÁREA DE SLOTS */}
          <div style={{ flex: 1, maxHeight: '300px', overflowY: 'auto' }}>
            <h4>Horários Livres para {selectedDate.toLocaleDateString()}</h4>
            {isLoadingSlots && <p>Calculando...</p>}
            
            {availableSlots.length > 0 && !isLoadingSlots && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {availableSlots.map(slot => (
                  <button key={slot} onClick={() => handleConfirmBooking(slot)}>
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

  // ETAPA 2: Mostrar Profissionais (sem mudança)
  if (selectedService) {
    return (
      <div>
        <button onClick={resetSelection}>&larr; Voltar aos Serviços</button>
        <h2>Escolha um Profissional para: {selectedService.name}</h2>
        {isLoadingProfessionals && <p>Buscando profissionais...</p>}
        {availableProfessionals.length > 0 ? (
          availableProfessionals.map(prof => (
            <div key={prof.id} style={{ padding: '10px', border: '1px solid #ddd' }}>
              <h4>{prof.name}</h4>
              <button onClick={() => handleSelectProfessional(prof)}>
                Escolher {prof.name}
              </button> 
            </div>
          ))
        ) : (
          !isLoadingProfessionals && <p>Nenhum profissional oferece este serviço no momento.</p>
        )}
      </div>
    );
  }

  // ETAPA 1: Mostrar Serviços (sem mudança)
  return (
    <div>
      <h2>Nossos Serviços</h2>
      {services.map(service => (
        <div key={service.id} style={{ padding: '10px', border: '1px solid #ddd', margin: '5px' }}>
          <h4>{service.name}</h4>
          <p>Preço: R$ {service.price.toFixed(2)}</p>
          <p>Duração: {service.duration} minutos</p>
          <button onClick={() => handleSelectService(service)}>Agendar</button>
        </div>
      ))}
    </div>
  );
}

export default ClientPanel;