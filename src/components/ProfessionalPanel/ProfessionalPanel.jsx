// src/components/ProfessionalPanel/ProfessionalPanel.jsx
// (VERSÃO FINAL - Com visualização das Preferências do Cliente: Zen/Papo/Sugestão)

import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../../firebase/firebase-config';
import { 
  doc, collection, getDocs, updateDoc, getDoc,
  writeBatch, addDoc, onSnapshot,
  query, deleteDoc, Timestamp, where
} from "firebase/firestore";
import { useShop } from '../../App.jsx';
import { toast } from 'sonner'; 
import { 
    Calendar, Megaphone, Clock, Scissors, Ban, CheckCircle, XCircle, User, Plus, UserPlus, 
    TrendingUp, ClipboardCheck, Package, Minus, ChevronLeft, ChevronRight,
    MessageCircle, VolumeX, Lightbulb, Star, Camera, Video 
} from 'lucide-react';

import ReactCalendar from 'react-calendar';
import '../ClientPanel/Calendar.css';

const daysOfWeek = [
  { key: 'sunday', label: 'Domingo' }, { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' }, { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' }, { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
];

const SERVICE_COMMISSION_RATE = 0.40; 

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
    console.error("Erro no upload:", error);
    throw error;
  }
};

function ProfessionalPanel() {
  const { managedShopId } = useShop();
  const professionalId = auth.currentUser ? auth.currentUser.uid : null;

  // --- Estados de Navegação ---
  const [activeTab, setActiveTab] = useState('agenda');

  // Estado da Navegação Principal (Barra Inferior)
  const [mainTab, setMainTab] = useState('agenda'); // 'agenda' | 'feed' | 'profile'

  // Estados do Perfil
  const [profileBio, setProfileBio] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [newProfilePhoto, setNewProfilePhoto] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // ... CRM ...
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clients, setClients] = useState([]);
  
  // --- Loadings ---
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(true);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false); 

  // --- Dados Principais ---
  const [shopData, setShopData] = useState(null);
  const [allServices, setAllServices] = useState([]); 
  const [products, setProducts] = useState([]); 
  const [myServiceIds, setMyServiceIds] = useState(new Set()); 
  const [workingHours, setWorkingHours] = useState([]); 
  const [blockedTimes, setBlockedTimes] = useState([]); 
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(new Date()); // Estado para controlar a data da agenda
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Abre/fecha o calendário
  const [monthBusyDates, setMonthBusyDates] = useState([]); // Dias com agendamento

  // Navegar dias
  const changeDate = (days) => {
      const newDate = new Date(selectedAgendaDate);
      newDate.setDate(newDate.getDate() + days);
      setSelectedAgendaDate(newDate);
  };

  // Carregar "bolinhas" dos agendamentos do mês (Visualização Macro)
  useEffect(() => {
      if (!professionalId) return;
      
      const startOfMonth = new Date(selectedAgendaDate.getFullYear(), selectedAgendaDate.getMonth(), 1);
      const endOfMonth = new Date(selectedAgendaDate.getFullYear(), selectedAgendaDate.getMonth() + 1, 0);
      endOfMonth.setHours(23,59,59);

      const q = query(
          collection(db, "appointments"),
          where("professionalId", "==", professionalId),
          where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
          where("startTime", "<=", Timestamp.fromDate(endOfMonth)),
          where("status", "in", ["confirmed", "checked_in", "completed"])
      );

      const unsubscribe = onSnapshot(q, (snap) => {
          const dates = snap.docs.map(doc => doc.data().startTime.toDate().toDateString());
          setMonthBusyDates([...new Set(dates)]); // Remove duplicatas
      });

      return () => unsubscribe();
  }, [selectedAgendaDate.getMonth(), professionalId]); // Recarrega se mudar o mês

  // --- Estados do Formulário de Bloqueio ---
  const [blockReason, setBlockReason] = useState('Almoço');
  const [blockStartTime, setBlockStartTime] = useState('12:00');
  const [blockEndTime, setBlockEndTime] = useState('13:00');
  const [blockType, setBlockType] = useState('recurring'); 
  const [blockDay, setBlockDay] = useState('monday');
  const [blockDate, setBlockDate] = useState(new Date().toISOString().split('T')[0]);

  // --- Estados do Agendamento Manual ---
  const [manualClientName, setManualClientName] = useState('');
  const [manualClientPhone, setManualClientPhone] = useState('');
  const [manualServiceId, setManualServiceId] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState('09:00');
  const [manualCart, setManualCart] = useState([]); 
  const [isBookingManual, setIsBookingManual] = useState(false);
  
  // --- Estado de Performance ---
  const [performanceData, setPerformanceData] = useState({
      totalRevenue: 0, totalCommission: 0, servicesCompleted: 0,
      averageRating: 0, ratingcount: 0, topPreference: 'N/A'
  });

  // --- CARREGAMENTO DE DADOS ---

  // Busca dados da loja (Nome e Endereço para o WhatsApp)
  useEffect(() => {
    if (managedShopId) {
        getDoc(doc(db, "barbershops", managedShopId)).then(snap => {
            if (snap.exists()) setShopData(snap.data());
        });
    }
  }, [managedShopId]);

  const fetchWorkingHours = useCallback(async () => {
    if (!professionalId) return;
    setIsLoadingHours(true);
    try {
      const querySnapshot = await getDocs(collection(db, "professionals", professionalId, "workingHours"));
      let hoursData = {};
      querySnapshot.forEach(doc => { hoursData[doc.id] = doc.data(); });
      
      const completeHours = daysOfWeek.map(day => {
        if (hoursData[day.key]) return { id: day.key, ...hoursData[day.key] };
        return { id: day.key, day: day.label, isWorking: (day.key !== 'sunday'), startTime: "09:00", endTime: "18:00" };
      });
      setWorkingHours(completeHours);
    } catch (error) { toast.error("Erro ao carregar horários."); } 
    finally { setIsLoadingHours(false); }
  }, [professionalId]);
  
  const fetchAllServices = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingServices(true);
    try {
      const q = query(collection(db, "services"), where("barbershopId", "==", managedShopId));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllServices(list);
      if(list.length > 0 && !manualServiceId) setManualServiceId(list[0].id);
    } catch (error) { console.error("Erro serviços:", error); } 
    finally { setIsLoadingServices(false); }
  }, [managedShopId, manualServiceId]);

  const fetchProducts = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingProducts(true);
    try {
        const q = query(collection(db, "products"), where("barbershopId", "==", managedShopId));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error("Erro produtos:", error); } 
    finally { setIsLoadingProducts(false); }
  }, [managedShopId]);
  
  const fetchMyServices = useCallback(async () => {
    if (!professionalId) return;
    try {
      const docSnap = await getDoc(doc(db, "professionals", professionalId));
      if (docSnap.exists()) {
          const data = docSnap.data();
          setMyServiceIds(new Set(data.services || []));
          // Carrega dados do perfil
          setProfileBio(data.bio || '');
          setProfilePhotoUrl(data.photoUrl || '');
      }
    } catch (error) { console.error("Erro meus dados:", error); }
  }, [professionalId]);
  
  const fetchBlockedTimes = useCallback(() => {
    if (!professionalId) return; 
    setIsLoadingBlocks(true);
    return onSnapshot(collection(db, "professionals", professionalId, "blockedTimes"), (snap) => {
      setBlockedTimes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingBlocks(false);
    });
  }, [professionalId]);

  const fetchPerformanceData = useCallback(async () => {
    if (!professionalId) return;
    setIsLoadingPerformance(true);
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const q = query(
            collection(db, "appointments"),
            where("professionalId", "==", professionalId),
            where("status", "==", "completed"),
            where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("startTime", "<=", Timestamp.fromDate(endOfMonth))
        );

        const snapshot = await getDocs(q);
        
        let totalRevenue = 0;
        let servicesCompleted = 0;
        let totalStars = 0;
        let ratedCount = 0;
        const prefCounts = { chat: 0, silent: 0, suggestion: 0 };

        snapshot.forEach(docSnap => {
            const appData = docSnap.data();
            servicesCompleted++;
            totalRevenue += appData.totalPrice || 0;
            
            // Cálculo de Avaliação
            if (appData.rating) {
                totalStars += appData.rating;
                ratedCount++;
            }
            
            // Contagem de Preferências
            if (appData.preference && prefCounts[appData.preference] !== undefined) {
                prefCounts[appData.preference]++;
            }
        });
        
        const totalCommission = totalRevenue * SERVICE_COMMISSION_RATE;
        const averageRating = ratedCount > 0 ? (totalStars / ratedCount).toFixed(1) : 0;
        
        // Descobre a preferência vencedora
        let topPreference = 'Indefinido';
        if (servicesCompleted > 0) {
            const maxPref = Object.keys(prefCounts).reduce((a, b) => prefCounts[a] > prefCounts[b] ? a : b);
            if (prefCounts[maxPref] > 0) {
                const labels = { chat: 'Papo', silent: 'Zen', suggestion: 'Sugestão' };
                topPreference = labels[maxPref];
            }
        }

        setPerformanceData({ 
            totalRevenue, totalCommission, servicesCompleted, 
            averageRating, ratingCount: ratedCount, topPreference 
        });

    } catch (error) { 
      console.error("Erro performance:", error);
    } finally {
      setIsLoadingPerformance(false);
    }
  }, [professionalId]);

  // --- BUSCA CLIENTES (CRM) ---
  const fetchClientsCRM = useCallback(async () => {
    if (!managedShopId) return;
    setIsLoadingClients(true);
    try {
        // Busca todos os agendamentos da loja para montar o CRM
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

  // --- EFEITO PRINCIPAL ---
  useEffect(() => {
    if (!managedShopId || !professionalId) return;
    
    fetchWorkingHours();
    fetchAllServices();
    fetchMyServices();
    fetchProducts(); 
    const unsubscribeBlocks = fetchBlockedTimes();
    
    // Agenda em tempo real
    setIsLoadingAgenda(true);
    const startOfDay = new Date(selectedAgendaDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedAgendaDate); endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "appointments"),
      where("professionalId", "==", professionalId),
      where("startTime", ">=", Timestamp.fromDate(startOfDay)),
      where("startTime", "<=", Timestamp.fromDate(endOfDay)),
      where("status", "in", ["confirmed", "checked_in"])
    );

    const unsubscribeAgenda = onSnapshot(q, async (snap) => {
      const list = [];
      for (const d of snap.docs) {
        const data = { id: d.id, ...d.data() };
        
        if (data.clientNameManual) {
            data.clientName = data.clientNameManual + " (Avulso)";
        } else {
            try {
              const u = await getDoc(doc(db, "users", data.clientId));
              data.clientName = u.exists() ? u.data().displayName : "Cliente";
              if (u.exists() && u.data().phoneNumber) data.clientPhone = u.data().phoneNumber;
            } catch (e) { data.clientName = "Cliente"; }
        }
        
        if (data.orderItems && data.orderItems.length > 0) {
            const mainService = data.orderItems.find(i => i.type === 'service');
            data.serviceName = mainService ? mainService.name : "Venda";
            data.productsCount = data.orderItems.filter(i => i.type === 'product').length;
        } else {
            try {
                const s = await getDoc(doc(db, "services", data.serviceId));
                data.serviceName = s.exists() ? s.data().name : "Serviço";
            } catch (e) { data.serviceName = "Serviço"; }
        }
        
        list.push(data);
      }
      list.sort((a, b) => a.startTime.seconds - b.startTime.seconds);
      setTodayAppointments(list);
      setIsLoadingAgenda(false);
    });

    if (activeTab === 'performance') fetchPerformanceData();
    if (activeTab === 'clients') fetchClientsCRM();

    return () => {
      if (unsubscribeBlocks && typeof unsubscribeBlocks === 'function') unsubscribeBlocks();
      unsubscribeAgenda();
    };
  }, [managedShopId, professionalId, activeTab, selectedAgendaDate, fetchWorkingHours, fetchAllServices, fetchMyServices, fetchBlockedTimes, fetchPerformanceData, fetchProducts, fetchClientsCRM]);
  
  // --- AÇÕES ---

  const handleSendWhatsapp = (app) => {
      const phone = app.clientPhone;
      if (!phone) {
          toast.error("Cliente sem telefone cadastrado.");
          return;
      }
      
      const clientName = app.clientName.replace(' (Avulso)', '').split(' ')[0];
      const date = app.startTime.toDate().toLocaleDateString('pt-BR', {day: 'numeric', month: 'long'});
      const time = app.startTime.toDate().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
      const service = app.serviceName;
      const total = app.totalPrice ? `R$ ${app.totalPrice.toFixed(2)}` : '';
      
      let message = `Olá, *${clientName}*! Tudo bem? 👋%0A%0A`;
      message += `Aqui é da *${shopData?.name || 'Barbearia'}*.%0A`;
      message += `Passando para confirmar seu horário:%0A%0A`;
      message += `🗓 *${date}*%0A`;
      message += `⏰ *${time}*%0A`;
      message += `✂ *${service}*`;
      
      if (total) message += `%0A💰 Valor: *${total}*`;
      
      if (shopData?.address) message += `%0A%0A📍 ${shopData.address}`;
      
      message += `%0A%0AConfirmado? 👊`;
      
      const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`;
      window.open(url, '_blank');
  };

  const handleUpdateManualCart = (product, operation) => {
    setManualCart(prev => {
        const exists = prev.find(i => i.productId === product.id);
        if(operation === 'add') {
            if(exists) return prev.map(i => i.productId === product.id ? {...i, qty: i.qty + 1} : i);
            return [...prev, { productId: product.id, name: product.name, price: Number(product.price), qty: 1 }];
        }
        if(operation === 'remove' && exists) {
            if(exists.qty === 1) return prev.filter(i => i.productId !== product.id);
            return prev.map(i => i.productId === product.id ? {...i, qty: i.qty - 1} : i);
        }
        return prev;
    });
  };

  const handleManualBooking = async (e) => {
    e.preventDefault();
    if(!manualClientName || !manualServiceId || !manualDate || !manualTime) {
        toast.warning("Preencha os dados básicos.");
        return;
    }

    setIsBookingManual(true);
    try {
        const service = allServices.find(s => s.id === manualServiceId);
        if(!service) throw new Error("Serviço inválido");

        const startTimestamp = new Date(manualDate + 'T' + manualTime);
        const endTimeObj = new Date(startTimestamp.getTime() + service.duration * 60000);

        const orderItems = [
            { type: 'service', id: service.id, name: service.name, price: Number(service.price), qty: 1 },
            ...manualCart.map(p => ({ type: 'product', id: p.productId, name: p.name, price: p.price, qty: p.qty }))
        ];

        const totalPrice = orderItems.reduce((acc, item) => acc + (item.price * item.qty), 0);

        await addDoc(collection(db, "appointments"), {
            professionalId: professionalId,
            serviceId: manualServiceId,
            barbershopId: managedShopId,
            startTime: Timestamp.fromDate(startTimestamp),
            endTime: Timestamp.fromDate(endTimeObj),
            status: "confirmed",
            paymentMethod: "in_store_combined",
            clientNameManual: manualClientName,
            clientPhone: manualClientPhone,
            createdBy: "professional",
            createdAt: Timestamp.now(),
            orderItems: orderItems,
            totalPrice: totalPrice,
            preference: 'chat' // Padrão para manual
        });

        toast.success(`Venda/Agendamento registrado! Total: R$ ${totalPrice.toFixed(2)}`);
        setManualClientName('');
        setManualClientPhone('');
        setManualCart([]); 
    } catch (error) {
        console.error("Erro manual:", error);
        toast.error("Erro ao registrar.");
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




  // Ação de Salvar Perfil
  const handleSaveProfile = async () => {
      setIsSavingProfile(true);
      try {
          let url = profilePhotoUrl;
          if (newProfilePhoto) {
              const uploadPromise = uploadImageToCloudinary(newProfilePhoto);
              toast.promise(uploadPromise, { loading: 'Enviando foto...', success: 'Foto enviada!', error: 'Erro na foto' });
              url = await uploadPromise;
          }
          
          await updateDoc(doc(db, "professionals", professionalId), {
              bio: profileBio,
              photoUrl: url
          });
          
          setProfilePhotoUrl(url);
          setNewProfilePhoto(null);
          toast.success("Perfil atualizado com sucesso!");
      } catch (error) {
          toast.error("Erro ao salvar perfil.");
      } finally {
          setIsSavingProfile(false);
      }
  };

  // Renderização da Aba Perfil
  const renderProfile = () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Foto e Stats */}
          <section className="card-premium md:col-span-1 flex flex-col items-center text-center">
              <div className="relative group cursor-pointer mb-4">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-grafite-border group-hover:border-gold-main transition-all">
                      <img 
                          src={newProfilePhoto ? URL.createObjectURL(newProfilePhoto) : (profilePhotoUrl || 'https://placehold.co/200?text=Foto')} 
                          className="w-full h-full object-cover"
                      />
                  </div>
                  <label htmlFor="profile_photo_upload" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer text-white font-bold text-xs">
                      <Camera size={24} className="mb-1"/>
                      <input 
                          id="profile_photo_upload" 
                          name="profile_photo_upload" 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => setNewProfilePhoto(e.target.files[0])}
                      />
                  </label>
              </div>
              
              <h3 className="text-xl font-heading font-bold text-white">{shopData?.name || 'Profissional'}</h3>
              <p className="text-text-secondary text-sm mb-4">Barbeiro Profissional</p>
              
              <div className="flex items-center gap-2 bg-grafite-main px-4 py-2 rounded-full border border-grafite-border mb-6">
                  <Star size={16} className="text-gold-main fill-gold-main"/>
                  <span className="font-bold text-white">{performanceData.averageRating || '5.0'}</span>
                  <span className="text-xs text-text-secondary">({performanceData.ratingCount || 0} avaliações)</span>
              </div>

          </section>

          {/* Coluna da Direita: Bio e Configurações */}
          <section className="card-premium md:col-span-2 space-y-6">
              <div className="border-b border-grafite-border pb-4">
                  <h3 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                      <User size={20} className="text-gold-main"/> Sobre Mim
                  </h3>
              </div>
              
              <div className="space-y-2">
                  <label htmlFor="profile_bio" className="text-xs text-text-secondary ml-1">Biografia (Aparece para o cliente)</label>
                  <textarea 
                      id="profile_bio"
                      name="profile_bio"
                      value={profileBio}
                      onChange={(e) => setProfileBio(e.target.value)}
                      className="input-premium min-h-[150px] resize-none"
                      placeholder="Conte um pouco sobre sua experiência, especialidades e estilo..."
                  />
              </div>

              <div className="flex justify-end pt-4">
                  <button 
                      onClick={handleSaveProfile} 
                      disabled={isSavingProfile}
                      className="btn-primary px-8"
                  >
                      {isSavingProfile ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
              </div>
          </section>
      </div>
  );
  
  const handleSaveMyServices = async () => {
    setIsLoadingServices(true);
    try {
      const profDocRef = doc(db, "professionals", professionalId);
      await updateDoc(profDocRef, {
        services: Array.from(myServiceIds)
      });
      toast.success("Sua lista de serviços foi atualizada!");
    } catch (error) {
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
      toast.error("Erro ao remover bloqueio.");
    }
  };

  const handleCheckIn = async (appointmentId) => {
    const checkInPromise = updateDoc(doc(db, "appointments", appointmentId), {
       status: "checked_in"
    });
    toast.promise(checkInPromise, {
      loading: 'Realizando Check-in...',
      success: 'Check-in realizado!',
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

  // Ação de Resgate CRM
  const handleResgateZap = (client) => {
      if(!client.phone) return toast.error("Cliente sem telefone.");
      const message = `Olá ${client.name.split(' ')[0]}! 💈%0A%0ASentimos sua falta aqui na ${shopData?.name || 'Barbearia'}.%0A%0AQue tal dar um trato no visual essa semana? Acesse nosso app para agendar! ✂️`;
      window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  // --- RENDERIZAÇÃO ---

  const Loading = () => <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>;

  // 1. Agenda Section
  const renderAgenda = () => (
      <section className="card-premium h-full min-h-[500px]">
         <div className="border-b border-grafite-border pb-4 mb-4 flex flex-col gap-4">
            
            {/* Barra de Controle de Data */}
            <div className="flex items-center justify-between bg-grafite-main p-2 rounded-lg border border-grafite-border">
                <button 
                    onClick={() => changeDate(-1)} 
                    className="p-2 rounded hover:bg-grafite-surface text-text-secondary hover:text-white transition-colors"
                >
                    <ChevronLeft size={20}/>
                </button>

                <button 
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className="flex items-center gap-2 text-sm font-bold text-white hover:text-gold-main transition-colors"
                >
                    <Calendar size={18} className="text-gold-main"/>
                    <span className="capitalize">
                        {selectedAgendaDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })}
                    </span>
                </button>

                <button 
                    onClick={() => changeDate(1)}
                    className="p-2 rounded hover:bg-grafite-surface text-text-secondary hover:text-white transition-colors"
                >
                    <ChevronRight size={20}/>
                </button>
            </div>

            {/* Calendário Pop-up (Black Gold Style) */}
            {isCalendarOpen && (
                <div className="animate-slide-up bg-[#1C1C1C] border border-gray-800 rounded-2xl p-6 shadow-2xl relative z-10 mt-2 w-full max-w-[380px] mx-auto">
                    {/* Indicadores de Legenda no Topo */}
                    <div className="flex justify-end gap-3 mb-4 text-[10px] uppercase tracking-wider font-bold">
                        <span className="flex items-center gap-1 text-gray-400">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div> Ocupado
                        </span>
                        <span className="flex items-center gap-1 text-gold-main">
                            <div className="w-1.5 h-1.5 bg-gold-main rounded-full shadow-[0_0_8px_rgba(212,175,55,0.8)]"></div> Selecionado
                        </span>
                    </div>

                    <ReactCalendar 
                        onChange={(date) => {
                            setSelectedAgendaDate(date);
                            setIsCalendarOpen(false);
                        }} 
                        value={selectedAgendaDate} 
                        showNavigation={false} /* Remove navegação padrão para usar a nossa customizada */
                        formatShortWeekday={(locale, date) => 
                            ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][date.getDay()] /* Letras únicas */
                        }
                        className="react-calendar w-full"
                        tileClassName={({ date, view }) => {
                            if (view !== 'month') return null;
                            const dateString = date.toDateString();
                            // Apenas lógica de classe base aqui, o CSS faz o resto
                            return null;
                        }}
                        tileContent={({ date, view }) => {
                            // Bolinhas indicadoras (Neon Style)
                            if (view === 'month' && monthBusyDates.includes(date.toDateString())) {
                                // Não mostra bolinha se for o dia selecionado (para não poluir)
                                if (date.toDateString() === selectedAgendaDate.toDateString()) return null;
                                return (
                                    <div className="absolute bottom-1.5 flex justify-center w-full">
                                        <div className="w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,1)]"></div>
                                    </div>
                                );
                            }
                        }}
                    />
                </div>
            )}
         </div>

         {isLoadingAgenda ? <Loading /> : (
            <div className="flex flex-col gap-4">
              {todayAppointments.length === 0 && <div className="py-12 text-center text-text-secondary border border-dashed border-grafite-border rounded bg-grafite-surface/30"><p className="italic">Agenda vazia hoje.</p><button onClick={() => setActiveTab('booking')} className="mt-4 text-gold-main hover:underline text-sm">Adicionar manualmente</button></div>}
              {todayAppointments.map(app => (
                <div key={app.id} className={`relative p-4 rounded-lg border flex flex-col md:flex-row gap-4 md:items-center ${app.status === 'checked_in' ? 'bg-green-950/10 border-green-500/30' : 'bg-grafite-main border-grafite-border'}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${app.status === 'checked_in' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  <div className="flex-1 pl-3">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-xl font-mono font-bold text-text-primary">{app.startTime?.toDate().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${app.status === 'checked_in' ? 'border-green-500 text-green-400' : 'border-blue-500 text-blue-400'}`}>{app.status === 'checked_in' ? 'Em Andamento' : 'Agendado'}</span>
                    </div>
                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        {app.clientName}
                        {app.clientNameManual && <span className="text-[10px] bg-grafite-surface px-1 rounded text-text-secondary">Avulso</span>}
                    </h4>

                    {/* PREFERÊNCIAS DO CLIENTE (Modo Zen / etc) */}
                    <div className="flex gap-2 mt-1 mb-2">
                        {app.preference === 'silent' && (
                            <span className="text-[10px] flex items-center gap-1 bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 font-bold uppercase tracking-wider">
                                <VolumeX size={12} /> Prefere Silêncio
                            </span>
                        )}
                        {app.preference === 'suggestion' && (
                            <span className="text-[10px] flex items-center gap-1 bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-bold uppercase tracking-wider">
                                <Lightbulb size={12} /> Quer Sugestão de corte
                            </span>
                        )}
                        {app.preference === 'chat' && (
                             <span className="text-[10px] flex items-center gap-1 bg-green-900/30 text-green-300 px-2 py-0.5 rounded border border-green-500/30 font-bold uppercase tracking-wider">
                                <MessageCircle size={12} /> Bate-Papo
                            </span>
                        )}
                    </div>

                    <div className="text-sm text-gold-main flex flex-wrap gap-2 mt-1">
                        <span className="flex items-center gap-1"><Scissors size={14}/> {app.serviceName}</span>
                        {app.productsCount > 0 && <span className="flex items-center gap-1 text-text-primary"><Package size={14}/> +{app.productsCount} itens</span>}
                        <span className="text-text-secondary ml-auto font-bold">Total: R$ {(app.totalPrice || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pl-3 w-full md:w-auto">
                     {/* Botão WhatsApp (Novo) */}
                     {app.status === 'confirmed' && app.clientPhone && (
                        <button 
                            onClick={() => handleSendWhatsapp(app)}
                            className="w-10 h-10 rounded-full bg-green-600/20 text-green-500 flex items-center justify-center hover:bg-green-600 hover:text-white transition-colors"
                            title="WhatsApp"
                        >
                            <MessageCircle size={20} />
                        </button>
                     )}
                    {app.status === 'confirmed' && <button onClick={() => handleCheckIn(app.id)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded text-sm flex items-center justify-center gap-2"><User size={16}/> Check-in</button>}
                    {app.status === 'checked_in' && <button onClick={() => handleCompleteService(app.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded text-sm flex items-center justify-center gap-2"><CheckCircle size={16}/> Concluir</button>}
                    <button onClick={() => handleCancelService(app.id)} className="px-3 py-2 rounded border border-red-900/50 text-red-400 hover:bg-red-900/20"><XCircle size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
         )}
      </section>
  );

  // 2. Novo Agendamento
  const renderBookingManual = () => {
      const selectedSvc = allServices.find(s => s.id === manualServiceId);
      const currentServicePrice = selectedSvc ? Number(selectedSvc.price) : 0;
      const productsTotal = manualCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
      const manualTotal = currentServicePrice + productsTotal;

      return (
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 card-premium space-y-5">
              <div className="border-b border-grafite-border pb-4 flex items-center gap-2">
                  <UserPlus className="text-gold-main" size={20}/>
                  <h3 className="text-xl font-bold text-text-primary">Dados do Agendamento</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label htmlFor="manual_client_name" className="text-xs text-text-secondary ml-1">Nome do Cliente</label><input id="manual_client_name" type="text" value={manualClientName} onChange={(e) => setManualClientName(e.target.value)} className="input-premium" placeholder="Ex: João Silva" required/></div>
                  <div className="space-y-1"><label htmlFor="manual_client_phone" className="text-xs text-text-secondary ml-1">WhatsApp / Telefone</label><input id="manual_client_phone" type="tel" value={manualClientPhone} onChange={(e) => setManualClientPhone(e.target.value)} className="input-premium" placeholder="21 99999-9999"/></div>
              </div>

              <div className="space-y-1"><label htmlFor="manual_service" className="text-xs text-text-secondary ml-1">Serviço Principal</label><select id="manual_service" value={manualServiceId} onChange={(e) => setManualServiceId(e.target.value)} className="input-premium" required>{allServices.map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.price}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label htmlFor="manual_date" className="text-xs text-text-secondary ml-1">Data</label><input id="manual_date" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="input-premium" required/></div>
                  <div className="space-y-1"><label htmlFor="manual_time" className="text-xs text-text-secondary ml-1">Horário</label><input id="manual_time" type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} className="input-premium" required/></div>
              </div>
              <div className="pt-4 border-t border-grafite-border">
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Package size={16} className="text-gold-main"/> Adicionar Produtos</h4>
                  {products.length === 0 ? <p className="text-xs text-text-secondary italic">Sem produtos cadastrados.</p> : (
                      <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto custom-scrollbar">
                          {products.map(p => (
                              <div key={p.id} className="bg-grafite-main border border-grafite-border p-2 rounded flex justify-between items-center">
                                  <div className="truncate pr-2"><p className="text-xs font-bold text-text-primary truncate">{p.name}</p><p className="text-[10px] text-gold-main">R$ {p.price}</p></div>
                                  <button onClick={() => handleUpdateManualCart(p, 'add')} className="text-gold-main hover:text-white bg-gold-dim p-1 rounded hover:bg-gold-main transition-colors"><Plus size={14}/></button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </section>
          <section className="lg:col-span-5 space-y-6">
              <div className="card-premium bg-grafite-surface/30">
                  <h3 className="text-lg font-bold text-text-primary mb-4 border-b border-grafite-border pb-2">Resumo da Venda</h3>
                  <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-white"><span>{selectedSvc?.name || 'Serviço'}</span><span>R$ {currentServicePrice.toFixed(2)}</span></div>
                      {manualCart.map(item => (
                          <div key={item.productId} className="flex justify-between text-text-secondary"><div className="flex items-center gap-2"><button onClick={() => handleUpdateManualCart(item, 'remove')} className="text-red-400 hover:text-red-300"><Minus size={12}/></button><span>{item.qty}x {item.name}</span></div><span>R$ {(item.price * item.qty).toFixed(2)}</span></div>
                      ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-grafite-border flex justify-between items-center"><span className="text-text-secondary uppercase text-xs">Total a Receber</span><span className="text-2xl font-bold text-gold-main">R$ {manualTotal.toFixed(2)}</span></div>
                  <button onClick={handleManualBooking} disabled={isBookingManual} className="btn-primary w-full h-12 mt-6 flex items-center justify-center gap-2 shadow-glow">{isBookingManual ? <div className="animate-spin h-5 w-5 border-2 border-current rounded-full"/> : <><CheckCircle size={18}/> Confirmar Venda</>}</button>
              </div>
          </section>
       </div>
      );
  };

  // 3. Configurações
  const renderConfig = () => (
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-premium">
            <div className="flex items-center gap-2 mb-4 border-b border-grafite-border pb-2"><Clock className="text-gold-main"/><h3 className="font-bold">Horários</h3></div>
            {isLoadingHours ? <Loading/> : workingHours.map(d => (
                <div key={d.id} className="flex justify-between text-sm py-1 border-b border-grafite-border/30">
                    <div className="flex gap-2">
                        <input type="checkbox" id={`work_check_${d.id}`} checked={d.isWorking} onChange={e => setWorkingHours(prev => prev.map(x => x.id === d.id ? {...x, isWorking: e.target.checked} : x))} className="accent-gold-main"/> 
                        <label htmlFor={`work_check_${d.id}`}>{d.day}</label>
                    </div>
                    {d.isWorking ? (
                        <div className="flex gap-2">
                            <input type="time" id={`start_time_${d.id}`} value={d.startTime} onChange={e => setWorkingHours(prev => prev.map(x => x.id === d.id ? {...x, startTime: e.target.value} : x))} className="bg-transparent text-white"/>
                            <input type="time" id={`end_time_${d.id}`} value={d.endTime} onChange={e => setWorkingHours(prev => prev.map(x => x.id === d.id ? {...x, endTime: e.target.value} : x))} className="bg-transparent text-white"/>
                        </div>
                    ) : <span className="text-text-secondary">Fechado</span>}
                </div>
            ))}
            <button onClick={handleSaveAllHours} className="btn-primary w-full mt-4 h-10">Salvar Horários</button>
        </section>
        <section className="card-premium">
            <div className="flex items-center gap-2 mb-4 border-b border-grafite-border pb-2"><Scissors className="text-gold-main"/><h3 className="font-bold">Meus Serviços</h3></div>
            {isLoadingServices ? <Loading/> : <div className="grid grid-cols-2 gap-2">{allServices.map(s => (
                <label key={s.id} htmlFor={`svc_${s.id}`} className={`p-2 rounded border cursor-pointer text-sm flex items-center gap-2 ${myServiceIds.has(s.id) ? 'border-gold-main bg-gold-dim text-white' : 'border-grafite-border text-text-secondary'}`}>
                    <input type="checkbox" id={`svc_${s.id}`} className="hidden" checked={myServiceIds.has(s.id)} onChange={() => handleServiceToggle(s.id)}/>{s.name}
                </label>
            ))}</div>}
            <button onClick={handleSaveMyServices} className="btn-primary w-full mt-4 h-10">Salvar Serviços</button>
        </section>
        <section className="card-premium lg:col-span-2">
             <div className="flex items-center gap-2 mb-4 border-b border-grafite-border pb-2"><Ban className="text-red-400"/><h3 className="font-bold">Bloqueios</h3></div>
             <form onSubmit={handleAddBlock} className="flex gap-2 mb-4">
                 <input id="block_reason" placeholder="Motivo" value={blockReason} onChange={e=>setBlockReason(e.target.value)} className="input-premium flex-1"/>
                 <input id="block_start" type="time" value={blockStartTime} onChange={e=>setBlockStartTime(e.target.value)} className="input-premium w-24"/>
                 <input id="block_end" type="time" value={blockEndTime} onChange={e=>setBlockEndTime(e.target.value)} className="input-premium w-24"/>
                 <button className="btn-primary px-4">+</button>
             </form>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{blockedTimes.map(b => <div key={b.id} className="p-2 border border-red-900/50 bg-red-950/10 rounded text-xs flex justify-between"><span>{b.reason} ({b.startTime}-{b.endTime})</span><button onClick={()=>handleDeleteBlock(b.id)} className="text-red-400">x</button></div>)}</div>
        </section>
     </div>
  );

  // 4. Performance
  const renderPerformance = () => (
      <section className="card-premium">
          <div className="flex items-center gap-2 border-b border-grafite-border pb-4 mb-6"><ClipboardCheck className="text-gold-main"/><h3 className="text-xl font-bold text-text-primary">Performance (Mês)</h3></div>
          {isLoadingPerformance ? <Loading/> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Serviços */}
                <div className="p-5 rounded-xl border border-blue-500/50 bg-blue-950/10">
                    <p className="text-xs uppercase text-text-secondary">Serviços</p>
                    <p className="text-3xl font-bold text-white">{performanceData.servicesCompleted}</p>
                </div>
                
                {/* Receita */}
                <div className="p-5 rounded-xl border border-green-500/50 bg-green-950/10">
                    <p className="text-xs uppercase text-text-secondary">Receita Total</p>
                    <p className="text-3xl font-bold text-white">R$ {performanceData.totalRevenue.toFixed(2)}</p>
                </div>
                
                {/* Comissão */}
                <div className="p-5 rounded-xl border border-gold-main/50 bg-gold-dim/10">
                    <p className="text-xs uppercase text-text-secondary">Comissão (Est.)</p>
                    <p className="text-3xl font-bold text-gold-main">R$ {performanceData.totalCommission.toFixed(2)}</p>
                </div>

                {/* --- NOVOS CARDS (LINHA DE BAIXO) --- */}
                
                {/* Avaliação Média */}
                <div className="p-5 rounded-xl border border-yellow-500/50 bg-yellow-950/10 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase text-text-secondary">Sua Nota</p>
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-bold text-white">{performanceData.averageRating}</p>
                            <div className="flex pb-1.5 text-yellow-500">
                                {[...Array(5)].map((_,i) => (
                                    <Star key={i} size={12} fill={i < Math.round(performanceData.averageRating) ? "currentColor" : "none"} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-text-secondary block">{performanceData.ratingCount} avaliações</span>
                    </div>
                </div>

                {/* Vibe Principal */}
                <div className="p-5 rounded-xl border border-purple-500/50 bg-purple-950/10 md:col-span-2">
                    <p className="text-xs uppercase text-text-secondary">Vibe dos Clientes</p>
                    <div className="flex items-center gap-3 mt-1">
                        {performanceData.topPreference === 'Zen' && <VolumeX size={32} className="text-purple-400"/>}
                        {performanceData.topPreference === 'Papo' && <MessageCircle size={32} className="text-purple-400"/>}
                        {performanceData.topPreference === 'Sugestão' && <Lightbulb size={32} className="text-purple-400"/>}
                        
                        <div>
                            <p className="text-2xl font-bold text-white">Modo {performanceData.topPreference}</p>
                            <p className="text-xs text-text-secondary">
                                A maioria dos seus clientes prefere {performanceData.topPreference === 'Zen' ? 'silêncio' : performanceData.topPreference === 'Papo' ? 'conversar' : 'suas dicas'}.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          )}
      </section>
  );

  // 5. CRM de Clientes (Renderização)
  const renderClientsCRM = () => (
    <section className="card-premium">
        <div className="flex justify-between items-center mb-6 border-b border-grafite-border pb-4">
            <h3 className="text-xl font-heading font-semibold text-text-primary flex items-center gap-2"><Megaphone className="text-gold-main" size={20}/> Gestão de Clientes (CRM)</h3>
            <button onClick={fetchClientsCRM} className="text-xs text-gold-main hover:underline">Atualizar</button>
        </div>
        {isLoadingClients ? <Loading /> : clients.length === 0 ? (
            <p className="text-center text-text-secondary italic py-10">Nenhum histórico de clientes ainda.</p>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead><tr className="text-xs text-text-secondary border-b border-grafite-border"><th className="pb-2 pl-2">Cliente</th><th className="pb-2">Última Visita</th><th className="pb-2">Visitas</th><th className="pb-2">Gasto Total</th><th className="pb-2 text-right pr-2">Ação</th></tr></thead>
                    <tbody className="text-sm">
                        {clients.map(client => {
                            const daysSince = Math.floor((new Date() - client.lastVisit) / (1000 * 60 * 60 * 24));
                            const isInactive = daysSince > 30;
                            return (
                                <tr key={client.id} className="border-b border-grafite-border/30 hover:bg-grafite-surface transition-colors group">
                                    <td className="py-3 pl-2"><p className="font-bold text-white">{client.name}</p><p className="text-xs text-text-secondary">{client.phone || 'Sem telefone'}</p></td>
                                    <td className="py-3"><span className={`text-xs px-2 py-1 rounded border ${isInactive ? 'bg-red-950/30 text-red-400 border-red-900/50' : 'bg-green-950/30 text-green-400 border-green-900/50'}`}>{daysSince} dias</span></td>
                                    <td className="py-3 text-text-primary">{client.visitCount} visitas</td>
                                    <td className="py-3 text-gold-main font-bold">R$ {client.totalSpent.toFixed(2)}</td>
                                    <td className="py-3 text-right pr-2">
                                        {client.phone && <button onClick={() => handleResgateZap(client)} className="text-xs bg-gold-dim text-gold-main px-3 py-1.5 rounded hover:bg-gold-main hover:text-grafite-main transition-colors flex items-center gap-1 ml-auto"><Megaphone size={12}/> Resgatar</button>}
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


// Ultimo return
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 animate-fade-in pb-32"> {/* Padding extra no fundo para a barra */}
      
      {/* Título Dinâmico */}
      <h2 className="text-3xl font-heading font-bold text-gold-main mb-2">
          {mainTab === 'agenda' ? 'Painel do Profissional' : mainTab === 'feed' ? 'BarberTok' : 'Meu Perfil'}
      </h2>

      {/* --- CONTEÚDO: AGENDA (Com Menu Superior Original) --- */}
      {mainTab === 'agenda' && (
        <div className="animate-fade-in">
            {/* Menu Deslizante Superior (Mantido apenas para Agenda) */}
            <div className="flex p-1 bg-grafite-card border border-grafite-border rounded-xl mb-6 overflow-x-auto gap-1 scrollbar-hide">
                {[
                    {id: 'agenda', label: 'Agenda', Icon: Calendar}, 
                    {id: 'booking', label: 'Novo Agendamento', Icon: UserPlus}, 
                    {id: 'performance', label: 'Performance', Icon: TrendingUp}, 
                    {id: 'config', label: 'Configurações', Icon: Clock}, 
                    {id: 'clients', label: 'Clientes', Icon: Megaphone}
                ].map(({id, label, Icon}) => (
                    <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === id ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-text-primary'}`}>
                        <Icon size={18} /> {label}
                    </button>
                ))}
            </div>
            
            <div className="min-h-[500px]">
                {activeTab === 'agenda' && renderAgenda()}
                {activeTab === 'booking' && renderBookingManual()}
                {activeTab === 'config' && renderConfig()}
                {activeTab === 'performance' && renderPerformance()}
                {activeTab === 'clients' && renderClientsCRM()}
            </div>
        </div>
      )}

      {/* --- CONTEÚDO: FEED (Placeholder) --- */}
      {mainTab === 'feed' && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-fade-in">
              <div className="w-24 h-24 bg-grafite-card rounded-full flex items-center justify-center border border-grafite-border shadow-premium">
                  <Video size={40} className="text-gold-main" />
              </div>
              <h3 className="text-2xl font-bold text-white">BarberTok</h3>
              <p className="text-text-secondary max-w-xs">Em breve você poderá postar seus cortes e tendências aqui para atrair mais clientes.</p>
          </div>
      )}

      {/* --- CONTEÚDO: PERFIL --- */}
      {mainTab === 'profile' && (
          <div className="animate-fade-in">
              {renderProfile()}
          </div>
      )}

      {/* --- BARRA DE NAVEGAÇÃO INFERIOR FLUTUANTE (DOCK) --- */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-[#1C1C1C]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl p-1.5 flex justify-between items-center z-50">
          
          <button 
            onClick={() => setMainTab('agenda')}
            className={`flex flex-col items-center justify-center w-full h-14 rounded-full transition-all duration-300 group ${mainTab === 'agenda' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-white'}`}
          >
              <Calendar size={22} strokeWidth={mainTab === 'agenda' ? 2.5 : 2} className="mb-0.5" />
              {mainTab === 'agenda' && <span className="text-[10px] font-bold leading-none">Agenda</span>}
          </button>

          <button 
            onClick={() => setMainTab('feed')}
            className={`flex flex-col items-center justify-center w-full h-14 rounded-full transition-all duration-300 group ${mainTab === 'feed' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-white'}`}
          >
              <Video size={22} strokeWidth={mainTab === 'feed' ? 2.5 : 2} className="mb-0.5" />
              {mainTab === 'feed' && <span className="text-[10px] font-bold leading-none">Feed</span>}
          </button>

          <button 
            onClick={() => setMainTab('profile')}
            className={`flex flex-col items-center justify-center w-full h-14 rounded-full transition-all duration-300 group ${mainTab === 'profile' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-white'}`}
          >
              <User size={22} strokeWidth={mainTab === 'profile' ? 2.5 : 2} className="mb-0.5" />
              {mainTab === 'profile' && <span className="text-[10px] font-bold leading-none">Perfil</span>}
          </button>

      </div>

    </div>
  );
}

export default ProfessionalPanel;