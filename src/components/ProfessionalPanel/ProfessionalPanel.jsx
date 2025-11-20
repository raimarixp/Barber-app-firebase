// src/components/ProfessionalPanel/ProfessionalPanel.jsx
// (COMPLETO - Com Nova Aba "Performance", Agendamento Manual, Configurações e Estilo Premium Dark)

import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../../firebase/firebase-config';
import { 
  doc, collection, getDocs, updateDoc, setDoc,
  getDoc, writeBatch, addDoc, onSnapshot,
  query, deleteDoc, Timestamp, where
} from "firebase/firestore";
import { useShop } from '../../App.jsx';
import { toast } from 'sonner'; 
import { 
    Calendar, Clock, Scissors, Ban, CheckCircle, XCircle, User, Plus, UserPlus, 
    Zap, DollarSign, TrendingUp, TrendingDown, ClipboardCheck, FileText
} from 'lucide-react';

const daysOfWeek = [
  { key: 'sunday', label: 'Domingo' }, { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' }, { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' }, { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
];

// Taxa de comissão de serviço como placeholder (idealmente viria do Firestore)
const SERVICE_COMMISSION_RATE = 0.40; // 40%

function ProfessionalPanel() {
  const { managedShopId } = useShop();

  // --- Estados de Navegação e Carregamento ---
  const [activeTab, setActiveTab] = useState('agenda'); // 'agenda', 'booking', 'config', 'performance'
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(true);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);

  // --- Estados de Dados ---
  const [allServices, setAllServices] = useState([]); 
  const [myServiceIds, setMyServiceIds] = useState(new Set()); 
  const [workingHours, setWorkingHours] = useState([]); 
  const [blockedTimes, setBlockedTimes] = useState([]); 
  const [todayAppointments, setTodayAppointments] = useState([]);
  
  // Estados do Formulário de Bloqueio
  const [blockReason, setBlockReason] = useState('Almoço');
  const [blockStartTime, setBlockStartTime] = useState('12:00');
  const [blockEndTime, setBlockEndTime] = useState('13:00');
  const [blockType, setBlockType] = useState('recurring'); 
  const [blockDay, setBlockDay] = useState('monday');
  const [blockDate, setBlockDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados do Novo Agendamento Manual (PRO)
  const [manualClientName, setManualClientName] = useState('');
  const [manualServiceId, setManualServiceId] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState('09:00');
  const [isBookingManual, setIsBookingManual] = useState(false);
  
  // Estado de Performance
  const [performanceData, setPerformanceData] = useState({
      totalRevenue: 0,
      totalCommission: 0,
      servicesCompleted: 0
  });

  const professionalId = auth.currentUser ? auth.currentUser.uid : null;

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
    } catch (error) { 
      console.error("Erro ao buscar horários: ", error); 
      toast.error("Erro ao carregar horários.");
    } finally { 
      setIsLoadingHours(false); 
    }
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
      if(servicesList.length > 0 && !manualServiceId) setManualServiceId(servicesList[0].id);
    } catch (error) { 
      console.error("Erro ao buscar serviços: ", error); 
    } finally { 
      setIsLoadingServices(false); 
    }
  }, [managedShopId, manualServiceId]);
  
  const fetchMyServices = useCallback(async () => {
    if (!professionalId) return;
    try {
      const profDocRef = doc(db, "professionals", professionalId);
      const docSnap = await getDoc(profDocRef);
      if (docSnap.exists()) {
        setMyServiceIds(new Set(docSnap.data().services || []));
      }
    } catch (error) { 
      console.error("Erro ao buscar meus serviços: ", error); 
    }
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

  const fetchPerformanceData = useCallback(async () => {
    if (!professionalId) return;
    setIsLoadingPerformance(true);

    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Busca todos os agendamentos CONCLUÍDOS no mês
        const appointmentsQuery = query(
            collection(db, "appointments"),
            where("professionalId", "==", professionalId),
            where("status", "==", "completed"),
            where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("startTime", "<=", Timestamp.fromDate(endOfMonth))
        );

        const snapshot = await getDocs(appointmentsQuery);
        
        let totalRevenue = 0;
        let servicesCompleted = 0;
        const serviceCache = {};

        const processAppointments = snapshot.docs.map(async (docSnap) => {
            const appData = docSnap.data();
            servicesCompleted++;

            let price = 0;
            const serviceId = appData.serviceId;

            if (serviceCache[serviceId] === undefined) {
                const serviceDoc = await getDoc(doc(db, "services", serviceId));
                price = serviceDoc.exists() ? serviceDoc.data().price || 0 : 0;
                serviceCache[serviceId] = price;
            } else {
                price = serviceCache[serviceId];
            }
            
            totalRevenue += price;
        });

        await Promise.all(processAppointments);
        
        const totalCommission = totalRevenue * SERVICE_COMMISSION_RATE;

        setPerformanceData({
            totalRevenue,
            totalCommission,
            servicesCompleted
        });

    } catch (error) {
        console.error("Erro ao buscar performance:", error);
        toast.error("Erro ao carregar dados de performance.");
    } finally {
        setIsLoadingPerformance(false);
    }
  }, [professionalId]);

  // Efeito Principal (Carrega tudo)
  useEffect(() => {
    if (!managedShopId || !professionalId) return;
    
    fetchWorkingHours();
    fetchAllServices();
    fetchMyServices();
    const unsubscribeBlocks = fetchBlockedTimes();
    
    // AGENDA EM TEMPO REAL (HOJE)
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
        
        if (appData.clientNameManual) {
            appData.clientName = appData.clientNameManual + " (Avulso)";
        } else {
            try {
              const userDoc = await getDoc(doc(db, "users", appData.clientId));
              appData.clientName = userDoc.exists() ? userDoc.data().displayName : "Cliente";
            } catch (e) { appData.clientName = "Cliente"; }
        }
        
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
      setIsLoadingAgenda(false);
    });

    // Recarrega performance quando a aba é ativada
    if (activeTab === 'performance') {
        fetchPerformanceData();
    }

    return () => {
      if (unsubscribeBlocks) unsubscribeBlocks();
      unsubscribeAgenda();
    };
    
  }, [managedShopId, professionalId, activeTab, fetchWorkingHours, fetchAllServices, fetchMyServices, fetchBlockedTimes, fetchPerformanceData]);
  
  // --- FUNÇÕES DE AÇÃO ---

  const handleManualBooking = async (e) => {
    e.preventDefault();
    if(!manualClientName || !manualServiceId || !manualDate || !manualTime) {
        toast.warning("Preencha todos os campos.");
        return;
    }

    setIsBookingManual(true);
    try {
        const service = allServices.find(s => s.id === manualServiceId);
        if(!service) throw new Error("Serviço não encontrado");

        const startTimestamp = new Date(manualDate + 'T' + manualTime);
        const endTimeObj = new Date(startTimestamp.getTime() + service.duration * 60000);

        await addDoc(collection(db, "appointments"), {
            professionalId: professionalId,
            serviceId: manualServiceId,
            barbershopId: managedShopId,
            startTime: Timestamp.fromDate(startTimestamp),
            endTime: Timestamp.fromDate(endTimeObj),
            status: "confirmed",
            paymentMethod: "in_store",
            clientNameManual: manualClientName,
            createdBy: "professional",
            createdAt: Timestamp.now()
        });

        toast.success(`Agendamento criado para ${manualClientName}!`);
        setManualClientName('');
    } catch (error) {
        console.error("Erro manual:", error);
        toast.error("Erro ao agendar: " + error.message);
    } finally {
        setIsBookingManual(false);
    }
  };

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
      toast.success("Horários atualizados com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar horários: ", error);
      toast.error("Erro ao salvar horários.");
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
      toast.success("Sua lista de serviços foi atualizada!");
    } catch (error) {
      console.error("Erro ao salvar meus serviços: ", error);
      toast.error("Erro ao salvar serviços.");
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
      toast.success("Bloqueio adicionado!");
      setBlockReason('Almoço');
    } catch (error) {
      console.error("Erro ao adicionar bloqueio: ", error);
      toast.error("Erro ao salvar bloqueio.");
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm("Remover bloqueio?")) return;
    try {
      const blockDocRef = doc(db, "professionals", professionalId, "blockedTimes", blockId);
      await deleteDoc(blockDocRef);
      toast.success("Bloqueio removido.");
    } catch (error) {
      console.error("Erro ao deletar bloqueio: ", error);
      toast.error("Erro ao remover bloqueio.");
    }
  };

  const handleCheckIn = async (appointmentId) => {
    const checkInPromise = updateDoc(doc(db, "appointments", appointmentId), {
       status: "checked_in"
    });
    
    toast.promise(checkInPromise, {
      loading: 'Realizando Check-in...',
      success: 'Check-in realizado! Cliente na loja.',
      error: 'Erro ao fazer check-in.'
    });
  };
  
  const handleCompleteService = async (appointmentId) => {
    if (!window.confirm("Concluir serviço?")) return;
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        status: "completed"
      });
      toast.success("Serviço concluído!");
    } catch (error) {
      toast.error("Erro ao completar serviço.");
    }
  };

  const handleCancelService = async (appointmentId) => {
    if (!window.confirm("Cancelar este agendamento?")) return;
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        status: "cancelled_by_pro"
      });
      toast.success("Agendamento cancelado.");
    } catch (error) {
      toast.error("Erro ao cancelar.");
    }
  };

  // --- RENDERIZAÇÃO DE SEÇÕES ---

  // Componente de Carregamento Genérico
  const LoadingSpinner = () => (
    <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div>
    </div>
  );

  // 1. Agenda Section
  const renderAgenda = () => (
      <section className="card-premium h-full min-h-[500px]">
         <div className="border-b border-grafite-border pb-4 mb-4 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
                <Calendar className="text-gold-main" size={20}/>
                <h3 className="text-xl font-heading font-semibold text-text-primary">Agenda de Hoje</h3>
            </div>
            <span className="text-xs text-text-secondary bg-grafite-surface px-2 py-1 rounded border border-grafite-border">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          
          {isLoadingAgenda ? (
             <LoadingSpinner />
          ) : (
            <div className="flex flex-col gap-4">
              {todayAppointments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-text-secondary border border-dashed border-grafite-border rounded-lg bg-grafite-surface/30">
                  <Calendar size={48} className="mb-4 opacity-20" />
                  <p className="italic">Nenhum agendamento para hoje.</p>
                  <button onClick={() => setActiveTab('booking')} className="mt-4 text-gold-main hover:underline text-sm">
                    Adicionar manualmente
                  </button>
                </div>
              )}
              
              {todayAppointments.map(app => (
                <div 
                  key={app.id} 
                  className={`
                    relative p-4 md:p-5 rounded-lg border transition-all duration-300 hover:shadow-lg flex flex-col md:flex-row gap-4 md:items-center
                    ${app.status === 'checked_in' 
                      ? 'bg-green-950/10 border-green-500/30' 
                      : 'bg-grafite-main border-grafite-border'}
                  `}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${app.status === 'checked_in' ? 'bg-green-500' : 'bg-blue-500'}`}></div>

                  <div className="flex-1 pl-3">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-xl font-mono font-bold text-text-primary">
                            {app.startTime && app.startTime.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            app.status === 'checked_in' 
                            ? 'bg-green-500/10 border-green-500/50 text-green-400' 
                            : 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                        }`}>
                            {app.status === 'checked_in' ? 'Em Atendimento' : 'Agendado'}
                        </div>
                    </div>
                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        {app.clientName}
                        {app.clientNameManual && <span className="text-xs font-normal text-text-secondary bg-grafite-surface px-1 rounded">Avulso</span>}
                    </h4>
                    <p className="text-sm text-gold-main flex items-center gap-1 mt-1">
                        <Scissors size={14}/> {app.serviceName}
                    </p>
                  </div>

                  <div className="flex gap-2 pl-3 md:pl-0 w-full md:w-auto">
                    {app.status === 'confirmed' && (
                      <button 
                        onClick={() => handleCheckIn(app.id)}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <User size={16}/> Check-in
                      </button>
                    )}
                    
                    {app.status === 'checked_in' && (
                      <button 
                        onClick={() => handleCompleteService(app.id)}
                        className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={16}/> Concluir
                      </button>
                    )}

                    <button 
                      onClick={() => handleCancelService(app.id)}
                      className="px-3 py-2 rounded border border-red-900/50 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-colors"
                      title="Cancelar"
                    >
                      <XCircle size={18}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>
  );

  // 2. Novo Agendamento Section
  const renderBookingManual = () => (
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="card-premium">
              <div className="border-b border-grafite-border pb-4 mb-6 flex items-center gap-2">
                  <UserPlus className="text-gold-main" size={20}/>
                  <h3 className="text-xl font-heading font-semibold text-text-primary">Agendar Cliente Avulso</h3>
              </div>
              <p className="text-text-secondary text-sm mb-6">Use esta opção para clientes balcão.</p>

              <form onSubmit={handleManualBooking} className="space-y-5">
                  <div className="space-y-1">
                      <label className="text-xs font-medium text-text-secondary ml-1">Nome do Cliente</label>
                      <input 
                          type="text" 
                          value={manualClientName} onChange={(e) => setManualClientName(e.target.value)}
                          className="input-premium"
                          placeholder="Ex: João Silva"
                          required
                      />
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs font-medium text-text-secondary ml-1">Serviço</label>
                      <select 
                          value={manualServiceId} onChange={(e) => setManualServiceId(e.target.value)}
                          className="input-premium"
                          required
                      >
                          {allServices.map(s => (
                              <option key={s.id} value={s.id}>{s.name} - R$ {s.price} ({s.duration} min)</option>
                          ))}
                      </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-xs font-medium text-text-secondary ml-1">Data</label>
                          <input 
                              type="date" 
                              value={manualDate} onChange={(e) => setManualDate(e.target.value)}
                              className="input-premium"
                              required
                          />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-medium text-text-secondary ml-1">Horário</label>
                          <input 
                              type="time" 
                              value={manualTime} onChange={(e) => setManualTime(e.target.value)}
                              className="input-premium"
                              required
                          />
                      </div>
                  </div>

                  <button 
                      type="submit" 
                      disabled={isBookingManual} 
                      className="btn-primary w-full h-12 mt-4 flex items-center justify-center gap-2"
                  >
                      {isBookingManual ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"/> : <><Plus size={18}/> Confirmar Agendamento</>}
                  </button>
              </form>
          </section>

          <div className="card-premium flex flex-col justify-center items-center text-center p-8 bg-grafite-surface/30 border-dashed">
              <Zap size={48} className="text-gold-main mb-4 opacity-50"/>
              <h4 className="text-lg font-bold text-text-primary mb-2">Agenda Unificada</h4>
              <p className="text-text-secondary text-sm max-w-xs">
                  Agendamentos manuais atualizam automaticamente o sistema e o painel do cliente, prevenindo overbooking.
              </p>
          </div>
       </div>
  );

  // 3. Configurações Section (Horários, Serviços, Bloqueios)
  const renderConfigSection = () => (
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horários */}
        <section className="card-premium lg:col-span-1">
            <div className="border-b border-grafite-border pb-4 mb-4 flex items-center gap-2">
              <Clock className="text-gold-main" size={20}/>
              <h3 className="text-xl font-heading font-semibold text-text-primary">Horários de Trabalho</h3>
            </div>
            
            {isLoadingHours ? <LoadingSpinner /> : (
              <div className="space-y-3">
                {workingHours.map((day) => (
                  <div key={day.id} className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-grafite-border/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <input 
                        type="checkbox"
                        id={`check-${day.id}`}
                        checked={day.isWorking}
                        onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, isWorking: e.target.checked} : d))}
                        className="w-4 h-4 rounded border-grafite-border bg-grafite-main text-gold-main focus:ring-gold-main/50 accent-gold-main"
                      />
                      <label htmlFor={`check-${day.id}`} className={`text-sm font-medium ${day.isWorking ? 'text-text-primary' : 'text-text-secondary/50'}`}>
                        {day.day}
                      </label>
                    </div>
                    
                    {day.isWorking ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="time"
                          value={day.startTime}
                          onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, startTime: e.target.value} : d))}
                          className="bg-grafite-main border border-grafite-border rounded px-2 py-1 text-sm text-text-primary focus:border-gold-main outline-none"
                        />
                        <span className="text-text-secondary">-</span>
                        <input 
                          type="time"
                          value={day.endTime}
                          onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, endTime: e.target.value} : d))}
                          className="bg-grafite-main border border-grafite-border rounded px-2 py-1 text-sm text-text-primary focus:border-gold-main outline-none"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-text-secondary uppercase tracking-wider">Fechado</span>
                    )}
                  </div>
                ))}
                <div className="pt-4">
                  <button onClick={handleSaveAllHours} disabled={isLoadingHours} className="btn-primary w-full">
                    {isLoadingHours ? 'Salvando...' : 'Salvar Horários'}
                  </button>
                </div>
              </div>
            )}
        </section>

        {/* Serviços */}
        <section className="card-premium lg:col-span-1">
            <div className="border-b border-grafite-border pb-4 mb-4 flex items-center gap-2">
              <Scissors className="text-gold-main" size={20}/>
              <h3 className="text-xl font-heading font-semibold text-text-primary">Meus Serviços</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">Selecione quais serviços da loja você realiza:</p>
            
            {isLoadingServices ? <LoadingSpinner /> : (
              <div className="space-y-4">
                {allServices.length === 0 ? (
                  <p className="text-text-secondary">Nenhum serviço disponível na loja.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allServices.map(service => (
                      <label 
                        key={service.id} 
                        className={`
                          flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${myServiceIds.has(service.id) 
                            ? 'bg-gold-dim border-gold-main/50' 
                            : 'bg-grafite-main border-grafite-border hover:bg-grafite-surface'}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={myServiceIds.has(service.id)}
                          onChange={() => handleServiceToggle(service.id)}
                          className="w-4 h-4 rounded border-grafite-border bg-grafite-main accent-gold-main"
                        />
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${myServiceIds.has(service.id) ? 'text-gold-main' : 'text-text-primary'}`}>
                            {service.name}
                          </span>
                          <span className="text-xs text-text-secondary">R$ {service.price.toFixed(2)}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <button onClick={handleSaveMyServices} disabled={isLoadingServices} className="btn-primary w-full">
                  Atualizar Meus Serviços
                </button>
              </div>
            )}
        </section>
        
        {/* Bloqueios */}
        <section className="card-premium lg:col-span-2">
            <div className="border-b border-grafite-border pb-4 mb-4 flex items-center gap-2">
              <Ban className="text-red-400" size={20}/>
              <h3 className="text-xl font-heading font-semibold text-text-primary">Bloqueios de Agenda</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form de Bloqueio */}
                <div className="md:col-span-1">
                    <form onSubmit={handleAddBlock} className="space-y-4 bg-grafite-surface p-4 rounded-lg border border-grafite-border">
                      <div className="space-y-1">
                         <label className="text-xs font-medium text-text-secondary">Motivo</label>
                         <input 
                          type="text" 
                          value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                          className="input-premium text-sm py-2"
                          placeholder="Ex: Almoço, Médico..."
                          required
                        />
                      </div>

                      <div className="space-y-1">
                          <label className="text-xs font-medium text-text-secondary">Tipo</label>
                          <select 
                            value={blockType} onChange={(e) => setBlockType(e.target.value)}
                            className="input-premium text-sm py-2"
                          >
                            <option value="recurring">Recorrente (Semanal)</option>
                            <option value="single">Data Específica</option>
                          </select>
                      </div>

                      <div className="space-y-1">
                         <label className="text-xs font-medium text-text-secondary">
                           {blockType === 'recurring' ? 'Dia da Semana' : 'Data'}
                         </label>
                         {blockType === 'recurring' ? (
                            <select value={blockDay} onChange={(e) => setBlockDay(e.target.value)} className="input-premium text-sm py-2">
                              {daysOfWeek.map(day => <option key={day.key} value={day.key}>{day.label}</option>)}
                            </select>
                         ) : (
                            <input 
                              type="date" 
                              value={blockDate} onChange={(e) => setBlockDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              className="input-premium text-sm py-2" required
                            />
                         )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary">Início</label>
                            <input type="time" value={blockStartTime} onChange={(e) => setBlockStartTime(e.target.value)} className="input-premium text-sm py-2" required />
                         </div>
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary">Fim</label>
                            <input type="time" value={blockEndTime} onChange={(e) => setBlockEndTime(e.target.value)} className="input-premium text-sm py-2" required />
                         </div>
                      </div>

                      <button type="submit" disabled={isLoadingBlocks} className="w-full py-2 rounded bg-grafite-main border border-gold-main text-gold-main font-medium hover:bg-gold-main hover:text-grafite-main transition-all text-sm">
                        + Adicionar Bloqueio
                      </button>
                    </form>
                </div>

                {/* Lista de Bloqueios */}
                <div className="md:col-span-2">
                    <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">Bloqueios Ativos</h4>
                    {isLoadingBlocks ? <LoadingSpinner /> : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {blockedTimes.length === 0 && <p className="text-text-secondary text-sm col-span-2 italic">Nenhum bloqueio cadastrado.</p>}
                        {blockedTimes.map(block => (
                          <div key={block.id} className="bg-grafite-main border border-grafite-border p-3 rounded text-sm flex justify-between items-center group hover:border-red-900/50 transition-colors">
                            <div>
                              <strong className="block text-text-primary">{block.reason}</strong>
                              <span className="text-text-secondary text-xs">
                                {block.type === 'recurring' 
                                  ? daysOfWeek.find(d => d.key === block.dayOfWeek)?.label 
                                  : new Date(block.date.seconds * 1000).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                              </span>
                              <span className="block text-text-secondary text-xs">{block.startTime} - {block.endTime}</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteBlock(block.id)}
                              className="text-text-secondary hover:text-red-400 p-1 rounded transition-colors"
                              title="Remover"
                            >
                              <XCircle size={16}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
            </div>
        </section>
     </div>
  );

  // 4. Performance Section
  const renderPerformanceReport = () => (
      <section className="card-premium">
          <div className="border-b border-grafite-border pb-4 mb-6 flex items-center gap-2">
              <ClipboardCheck className="text-gold-main" size={20}/>
              <h3 className="text-xl font-heading font-semibold text-text-primary">Minha Performance (Mês Atual)</h3>
          </div>
          
          {isLoadingPerformance ? <LoadingSpinner /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Card Serviços Concluídos */}
                <div className="bg-grafite-surface border border-grafite-border p-5 rounded-xl border-l-4 border-blue-500/70">
                    <p className="text-sm font-medium text-text-secondary uppercase mb-2">Serviços Concluídos</p>
                    <p className="text-3xl font-heading font-bold text-white">{performanceData.servicesCompleted}</p>
                    <p className="text-xs text-text-secondary mt-2">Em {new Date().toLocaleString('pt-BR', {month: 'long', year: 'numeric'})}</p>
                </div>

                {/* Card Receita Bruta */}
                <div className="bg-grafite-surface border border-grafite-border p-5 rounded-xl border-l-4 border-green-500/70">
                    <p className="text-sm font-medium text-text-secondary uppercase mb-2">Receita Total Gerada</p>
                    <p className="text-3xl font-heading font-bold text-white">R$ {performanceData.totalRevenue.toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-text-secondary mt-2">Valor total dos serviços</p>
                </div>

                {/* Card Comissão Estimada */}
                <div className="bg-grafite-surface border border-grafite-border p-5 rounded-xl border-l-4 border-gold-main/70">
                    <p className="text-sm font-medium text-text-secondary uppercase mb-2">Sua Comissão Estimada</p>
                    <p className="text-3xl font-heading font-bold text-gold-main">R$ {performanceData.totalCommission.toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-text-secondary mt-2">Taxa de {SERVICE_COMMISSION_RATE * 100}% [Placeholder]</p>
                </div>
            </div>
          )}

          <div className="p-4 bg-grafite-main border border-grafite-border rounded-lg mt-6">
              <p className="text-xs text-text-secondary italic">
                  * Nota: A comissão real pode variar dependendo das políticas da barbearia. Este valor é uma estimativa com base em **{SERVICE_COMMISSION_RATE * 100}%** dos serviços concluídos no mês atual.
              </p>
          </div>

      </section>
  );


  // --- RENDERIZAÇÃO PRINCIPAL DO PAINEL PROFISSIONAL ---
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 animate-fade-in">
      
      <h2 className="text-3xl font-heading font-bold text-gold-main mb-6">Painel do Profissional</h2>
      
      {/* --- Navegação por Abas --- */}
      <div className="flex p-1 bg-grafite-card border border-grafite-border rounded-xl mb-8 overflow-x-auto">
        {[{id: 'agenda', label: 'Agenda', Icon: Calendar}, {id: 'booking', label: 'Novo Agendamento', Icon: UserPlus}, {id: 'performance', label: 'Performance', Icon: TrendingUp}, {id: 'config', label: 'Configurações', Icon: Clock}].map(({id, label, Icon}) => (
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
          {activeTab === 'agenda' && renderAgenda()}
          {activeTab === 'booking' && renderBookingManual()}
          {activeTab === 'config' && renderConfigSection()}
          {activeTab === 'performance' && renderPerformanceReport()}
      </div>
    </div>
  );
}

export default ProfessionalPanel;