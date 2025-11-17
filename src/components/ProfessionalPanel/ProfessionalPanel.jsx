// src/components/ProfessionalPanel/ProfessionalPanel.jsx
// (COMPLETO - Com Agenda, Horários, Serviços e Bloqueios)

import { useState, useEffect, useCallback } from 'react';
import styles from './ProfessionalPanel.module.css'; 
import { db, auth } from '../../firebase/firebase-config';
import { 
  doc, collection, getDocs, updateDoc, setDoc,
  getDoc, writeBatch, addDoc, onSnapshot,
  query, deleteDoc, Timestamp, where
} from "firebase/firestore";
import { useShop } from '../../App.jsx';

const daysOfWeek = [
  { key: 'sunday', label: 'Domingo' }, { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' }, { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' }, { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
];

function ProfessionalPanel() {
  const { managedShopId } = useShop();

  // --- Estados ---
  const [workingHours, setWorkingHours] = useState([]); 
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  const [allServices, setAllServices] = useState([]); 
  const [myServiceIds, setMyServiceIds] = useState(new Set()); 
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [blockedTimes, setBlockedTimes] = useState([]); 
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);
  const [blockReason, setBlockReason] = useState('Almoço');
  const [blockStartTime, setBlockStartTime] = useState('12:00');
  const [blockEndTime, setBlockEndTime] = useState('13:00');
  const [blockType, setBlockType] = useState('recurring'); 
  const [blockDay, setBlockDay] = useState('monday');
  const [blockDate, setBlockDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(true);

  const professionalId = auth.currentUser.uid;

  // --- Lógica de Carregamento ---
  const fetchWorkingHours = useCallback(async () => {
    if (!professionalId) return;
    setIsLoadingHours(true);
    try {
      const hoursCollectionRef = collection(db, "professionals", professionalId, "workingHours");
      const querySnapshot = await getDocs(hoursCollectionRef);
      let hoursData = {};
      querySnapshot.forEach(doc => { hoursData[doc.id] = doc.data(); });
      let needsUpdate = false;
      const completeHours = daysOfWeek.map(day => {
        if (hoursData[day.key]) {
          return { id: day.key, ...hoursData[day.key] };
        } else {
          needsUpdate = true;
          return { id: day.key, day: day.label, isWorking: (day.key !== 'sunday'), startTime: "09:00", endTime: "18:00" };
        }
      });
      if (needsUpdate) {
        const batch = writeBatch(db);
        for (const day of completeHours) {
          const dayDocRef = doc(db, "professionals", professionalId, "workingHours", day.id);
          batch.set(dayDocRef, day); 
        }
        await batch.commit();
      }
      setWorkingHours(completeHours);
    } catch (error) { console.error("Erro ao buscar horários: ", error); } 
    finally { setIsLoadingHours(false); }
  }, [professionalId]);
  
  const fetchAllServices = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingServices(true);
    try {
      const servicesQuery = query(
        collection(db, "services"),
        where("barbershopId", "==", managedShopId)
      );
      const querySnapshot = await getDocs(servicesQuery);
      const servicesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllServices(servicesList);
    } catch (error) { console.error("Erro ao buscar TODOS os serviços: ", error); } 
    finally { setIsLoadingServices(false); }
  }, [managedShopId]);
  
  const fetchMyServices = useCallback(async () => {
    if (!professionalId) return;
    try {
      const profDocRef = doc(db, "professionals", professionalId);
      const docSnap = await getDoc(profDocRef);
      if (docSnap.exists()) {
        setMyServiceIds(new Set(docSnap.data().services || []));
      } else { console.warn("Documento do profissional não encontrado."); }
    } catch (error) { console.error("Erro ao buscar MEUS serviços: ", error); }
  }, [professionalId]);
  
  const fetchBlockedTimes = useCallback(() => {
    if (!professionalId) return; 
    setIsLoadingBlocks(true);
    const blocksCollectionRef = collection(db, "professionals", professionalId, "blockedTimes");
    const unsubscribe = onSnapshot(blocksCollectionRef, (querySnapshot) => {
      const blocksList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBlockedTimes(blocksList);
      setIsLoadingBlocks(false);
    }, (error) => {
      console.error("Erro ao ouvir bloqueios: ", error);
      setIsLoadingBlocks(false);
    });
    return unsubscribe;
  }, [professionalId]);

  // Efeito Principal (Carrega tudo)
  useEffect(() => {
    if (!managedShopId) return;
    
    fetchWorkingHours();
    fetchAllServices();
    fetchMyServices();
    const unsubscribeBlocks = fetchBlockedTimes();
    
    setIsLoadingAgenda(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("professionalId", "==", professionalId),
      where("startTime", ">=", Timestamp.fromDate(todayStart)),
      where("startTime", "<=", Timestamp.fromDate(todayEnd)),
      where("status", "in", ["confirmed", "checked_in"])
    );

    const unsubscribeAgenda = onSnapshot(appointmentsQuery, async (querySnapshot) => {
      const appointmentsList = [];
      for (const appDoc of querySnapshot.docs) {
        const appData = { id: appDoc.id, ...appDoc.data() };
        
        try {
          const userDoc = await getDoc(doc(db, "users", appData.clientId));
          appData.clientName = userDoc.exists() ? userDoc.data().displayName : "Cliente";
        } catch (e) { appData.clientName = "Cliente"; }
        
        try {
          const serviceDoc = await getDoc(doc(db, "services", appData.serviceId));
          appData.serviceName = serviceDoc.exists() ? serviceDoc.data().name : "Serviço";
        } catch (e) { appData.serviceName = "Serviço"; }
        
        appointmentsList.push(appData);
      }
      
      appointmentsList.sort((a, b) => a.startTime.seconds - b.startTime.seconds);
      setTodayAppointments(appointmentsList);
      setIsLoadingAgenda(false);
    }, (error) => {
      console.error("Erro ao ouvir agenda: ", error);
      alert("Erro ao carregar agenda. Verifique o console (F12) para criar um índice.");
      setIsLoadingAgenda(false);
    });

    return () => {
      if (unsubscribeBlocks) unsubscribeBlocks();
      unsubscribeAgenda();
    };
    
  }, [managedShopId, professionalId, fetchWorkingHours, fetchAllServices, fetchMyServices, fetchBlockedTimes]);
  
  // --- Funções de SALVAR ---
  const handleSaveAllHours = async () => {
    setIsLoadingHours(true);
    try {
      const batch = writeBatch(db);
      workingHours.forEach((day) => {
        const dayDocRef = doc(db, "professionals", professionalId, "workingHours", day.id);
        batch.update(dayDocRef, {
          isWorking: day.isWorking,
          startTime: day.startTime,
          endTime: day.endTime
        });
      });
      await batch.commit();
      alert("Horários atualizados com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar horários: ", error);
      alert("Erro ao salvar horários: " + error.message);
    } finally {
      setIsLoadingHours(false);
    }
  };
  
  const handleServiceToggle = (serviceId) => {
    setMyServiceIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(serviceId)) newIds.delete(serviceId);
      else newIds.add(serviceId);
      return newIds;
    });
  };
  
  const handleSaveMyServices = async () => {
    setIsLoadingServices(true);
    try {
      const profDocRef = doc(db, "professionals", professionalId);
      await updateDoc(profDocRef, {
        services: Array.from(myServiceIds)
      });
      alert("Sua lista de serviços foi atualizada!");
    } catch (error) {
      console.error("Erro ao salvar meus serviços: ", error);
      alert("Erro ao salvar serviços: " + error.message);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const handleAddBlock = async (e) => {
    e.preventDefault();
    setIsLoadingBlocks(true);
    let newBlock = {
      reason: blockReason,
      startTime: blockStartTime,
      endTime: blockEndTime,
      type: blockType
    };
    try {
      if (blockType === 'recurring') {
        newBlock.dayOfWeek = blockDay;
      } else {
        const dateObj = new Date(blockDate + 'T00:00:00');
        newBlock.date = Timestamp.fromDate(dateObj);
      }
      const blocksCollectionRef = collection(db, "professionals", professionalId, "blockedTimes");
      await addDoc(blocksCollectionRef, newBlock);
      alert("Bloqueio adicionado!");
      setBlockReason('Almoço');
    } catch (error) {
      console.error("Erro ao adicionar bloqueio: ", error);
      alert("Erro ao salvar bloqueio.");
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm("Tem certeza que quer remover este bloqueio?")) return;
    try {
      const blockDocRef = doc(db, "professionals", professionalId, "blockedTimes", blockId);
      await deleteDoc(blockDocRef);
      alert("Bloqueio removido.");
    } catch (error) {
      console.error("Erro ao deletar bloqueio: ", error);
      alert("Erro ao remover bloqueio.");
    }
  };

  // Funções de Ação da Agenda
  const handleCheckIn = async (appointmentId) => {
    try {
      const appDocRef = doc(db, "appointments", appointmentId);
      await updateDoc(appDocRef, {
        status: "checked_in"
      });
    } catch (error) {
      console.error("Erro ao fazer check-in: ", error);
    }
  };
  
  const handleCompleteService = async (appointmentId) => {
    if (!window.confirm("Confirmar que este serviço foi concluído?")) return;
    try {
      const appDocRef = doc(db, "appointments", appointmentId);
      await updateDoc(appDocRef, {
        status: "completed"
      });
    } catch (error) {
      console.error("Erro ao completar serviço: ", error);
    }
  };

  const handleCancelService = async (appointmentId) => {
    if (!window.confirm("Tem certeza que quer CANCELAR este agendamento?")) return;
    try {
      const appDocRef = doc(db, "appointments", appointmentId);
      await updateDoc(appDocRef, {
        status: "cancelled_by_pro"
      });
    } catch (error) {
      console.error("Erro ao cancelar serviço: ", error);
    }
  };


  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <div>
      {/* Seção 4: Minha Agenda de Hoje */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Minha Agenda de Hoje</h3>
        {isLoadingAgenda ? <p>Carregando agenda...</p> : (
          <div className={styles.agendaContainer}>
            {todayAppointments.length === 0 && <p>Nenhum agendamento para hoje.</p>}
            
            {todayAppointments.map(app => (
              <div 
                key={app.id} 
                className={`
                  ${styles.agendaCard} 
                  ${app.status === 'checked_in' ? styles.statusCheckedIn : styles.statusConfirmed}
                `}
              >
                <h4>
                  {app.startTime.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                  - {app.clientName}
                </h4>
                <p><strong>Serviço:</strong> {app.serviceName}</p>
                
                {app.status === 'confirmed' && (
                  <>
                    <p style={{color: 'blue', fontWeight: 'bold'}}>Aguardando chegada...</p>
                    <div className={styles.agendaActions}>
                      <button 
                        className={styles.checkInButton}
                        onClick={() => handleCheckIn(app.id)}
                      >
                        Fazer Check-in
                      </button>
                      <button 
                        className={styles.cancelButton}
                        onClick={() => handleCancelService(app.id)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
                
                {app.status === 'checked_in' && (
                  <>
                    <p style={{color: 'green', fontWeight: 'bold'}}>CLIENTE NA LOJA</p>
                    <div className={styles.agendaActions}>
                      <button 
                        className={styles.completeButton}
                        onClick={() => handleCompleteService(app.id)}
                      >
                        Concluir Serviço
                      </button>
                       <button 
                        className={styles.cancelButton}
                        onClick={() => handleCancelService(app.id)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
                
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção 1: Meus Horários */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Meu Horário de Trabalho</h3>
        {isLoadingHours ? <p>Carregando horários...</p> : (
          <div> 
            {workingHours.map((day) => (
              <div key={day.id} className={styles.dayRow}>
                <input 
                  type="checkbox"
                  id={`check-${day.id}`}
                  name={`check-${day.id}`}
                  checked={day.isWorking}
                  onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, isWorking: e.target.checked} : d))}
                />
                <label className={styles.dayLabel} htmlFor={`check-${day.id}`}>
                  {day.day}
                </label>
                
                {day.isWorking && (
                  <div className={styles.timeInputs}>
                    <label htmlFor={`start-${day.id}`}>De:</label>
                    <input 
                      type="time"
                      id={`start-${day.id}`}
                      name={`start-${day.id}`}
                      value={day.startTime}
                      onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, startTime: e.target.value} : d))}
                    />
                    <label htmlFor={`end-${day.id}`}>Até:</label>
                    <input 
                      type="time"
                      id={`end-${day.id}`}
                      name={`end-${day.id}`}
                      value={day.endTime}
                      onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, endTime: e.target.value} : d))}
                    />
                  </div>
                )}
                {!day.isWorking && (
                  <span style={{color: '#888'}}>Fechado</span>
                )}
              </div>
            ))}
            <button 
              onClick={handleSaveAllHours} 
              className={styles.saveButton}
              disabled={isLoadingHours}
            >
              {isLoadingHours ? 'Salvando...' : 'Salvar Horários'}
            </button>
          </div>
        )}
      </div>

      {/* Seção 2: Meus Serviços */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Meus Serviços</h3>
        <p>Selecione os serviços que você oferece.</p>
        {isLoadingServices ? <p>Carregando serviços...</p> : (
          <div>
            {allServices.length === 0 ? (
              <p>Nenhum serviço encontrado para sua barbearia. Peça ao seu Admin para cadastrá-los.</p>
            ) : (
              allServices.map(service => (
                <div key={service.id} style={{padding: '5px'}}>
                  <input
                    type="checkbox"
                    id={`service-${service.id}`}
                    name={`service-${service.id}`}
                    checked={myServiceIds.has(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                  />
                  <label htmlFor={`service-${service.id}`}>
                    {service.name} (R$ {service.price})
                  </label>
                </div>
              ))
            )}
            <button 
              onClick={handleSaveMyServices} 
              className={styles.saveButton}
              disabled={isLoadingServices}
            >
              {isLoadingServices ? 'Salvando...' : 'Salvar Meus Serviços'}
            </button>
          </div>
        )}
      </div>

      {/* Seção 3: Meus Bloqueios */}
      <div className={styles.panel}>
        <h3 className={styles.sectionTitle}>Meus Bloqueios</h3>
        <p>Adicione pausas (ex: Almoço) ou bloqueios de dia único (ex: Dentista).</p>
        
        <form onSubmit={handleAddBlock} className={styles.form}>
          <label className={styles.formField} htmlFor="blockReason">
            <span>Motivo:</span>
            <input 
              type="text" id="blockReason" name="blockReason"
              value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
              required
            />
          </label>
          
          <label className={styles.formField} htmlFor="blockType">
            <span>Tipo:</span>
            <select 
              id="blockType" name="blockType" value={blockType} 
              onChange={(e) => setBlockType(e.target.value)}
            >
              <option value="recurring">Recorrente (Ex: Almoço)</option>
              <option value="single">Dia Único (Ex: Dentista)</option>
            </select>
          </label>

          {blockType === 'recurring' ? (
            <label className={styles.formField} htmlFor="blockDay">
              <span>Dia da Semana:</span>
              <select id="blockDay" name="blockDay" value={blockDay} onChange={(e) => setBlockDay(e.target.value)}>
                {daysOfWeek.map(day => (
                  <option key={day.key} value={day.key}>{day.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className={styles.formField} htmlFor="blockDate">
              <span>Data:</span>
              <input 
                type="date" id="blockDate" name="blockDate"
                value={blockDate} onChange={(e) => setBlockDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </label>
          )}

          <div style={{display: 'flex', gap: '10px'}}>
            <label className={styles.formField} htmlFor="blockStart">
              <span>Das:</span>
              <input type="time" id="blockStart" name="blockStart" value={blockStartTime} onChange={(e) => setBlockStartTime(e.target.value)} required />
            </label>
            <label className={styles.formField} htmlFor="blockEnd">
              <span>Até:</span>
              <input type="time" id="blockEnd" name="blockEnd" value={blockEndTime} onChange={(e) => setBlockEndTime(e.target.value)} required />
            </label>
          </div>
          
          <button type="submit" disabled={isLoadingBlocks} className={styles.saveButton}>
            Adicionar Bloqueio
          </button>
        </form>
        
        <hr />
        
        <h4>Bloqueios Atuais</h4>
        {isLoadingBlocks ? <p>Carregando...</p> : (
          <div className={styles.blockList}>
            {blockedTimes.length === 0 && <p>Nenhum bloqueio cadastrado.</p>}
            {blockedTimes.map(block => (
              <div key={block.id} className={styles.blockCard}>
                <p><strong>Motivo:</strong> {block.reason}</p>
                <p><strong>Horário:</strong> {block.startTime} - {block.endTime}</p>
                <p>
                  <strong>Quando:</strong> 
                  {block.type === 'recurring' ? 
                   `Toda ${daysOfWeek.find(d => d.key === block.dayOfWeek)?.label}` : 
                   new Date(block.date.seconds * 1000).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                </p>
                <button onClick={() => handleDeleteBlock(block.id)}>
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

export default ProfessionalPanel;