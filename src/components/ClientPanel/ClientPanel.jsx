// src/components/ClientPanel/ClientPanel.jsx
// (VERSÃO FINAL DEFINITIVA - 100% FUNCIONAL)

import { useState, useEffect } from 'react';
import { functions, db, auth } from '../../firebase/firebase-config';
import { httpsCallable } from 'firebase/functions';
import { 
  collection, getDocs, query, where, doc, getDoc, 
  addDoc, updateDoc, Timestamp, onSnapshot, orderBy, limit
} from "firebase/firestore"; 
import Calendar from 'react-calendar';
import './Calendar.css'; 
import { useShop } from '../../App.jsx';
import { toast } from 'sonner';
import { 
  MapPin, Calendar as CalIcon, Clock, Scissors, 
  CreditCard, Store, Search, ArrowLeft, Package, Minus, Plus, Image as ImageIcon,
  LayoutGrid, Star, ChevronRight, Info, MessageCircle, Moon, Sparkles, VolumeX, Lightbulb, User,
  Video, Heart, Play, Share2, 
  Camera, Save, Settings, LogOut, X, Home
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

// Helper de Upload
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

function ClientPanel() {
  const { viewingShopId, setViewingShopId } = useShop();

  // --- ESTADOS DE NAVEGAÇÃO ---
  const [mainTab, setMainTab] = useState('agenda'); // 'agenda' | 'feed' | 'profile'
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'new' (Dentro da Agenda)
  const [selectedAppointment, setSelectedAppointment] = useState(null); // Modal de Detalhes
  
  // Verifica se está em ambiente Whitelabel
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

  // --- ESTADOS DO FEED ---
  const [feedPosts, setFeedPosts] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState(null);

  // --- ESTADOS DO PERFIL ---
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [newProfilePhoto, setNewProfilePhoto] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- ESTADOS DE CHECKOUT ---
  const [cart, setCart] = useState([]); 
  const [checkoutStage, setCheckoutStage] = useState('slots');
  const [clientPreference, setClientPreference] = useState('chat'); 

  // Estados da Visualização da Loja
  const [shopSection, setShopSection] = useState('services'); // 'services' | 'feed'
  const [shopPosts, setShopPosts] = useState([]);
  const [isLoadingShopFeed, setIsLoadingShopFeed] = useState(false);

  // Estados da Loja (Rating)
  const [shopRating, setShopRating] = useState(0);
  const [shopReviewCount, setShopReviewCount] = useState(0);
  const [isShopInfoOpen, setIsShopInfoOpen] = useState(false); // Para expandir a descrição

  // Cálculos de totais
  const totalServicePrice = selectedService ? selectedService.price : 0;
  const totalProductsPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const finalTotal = totalServicePrice + totalProductsPrice;

  // --- EFEITOS ---

  // 1. Carregar Perfil
  useEffect(() => {
      if (auth.currentUser) {
          const fetchProfile = async () => {
              const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  setProfileName(data.displayName || '');
                  setProfilePhone(data.phoneNumber || '');
                  setProfilePhotoUrl(data.photoUrl || '');
              }
          };
          fetchProfile();
      }
  }, []);

  // 2. Busca Agendamentos (Tempo Real)
  useEffect(() => {
    if (!auth.currentUser) {
      setIsLoadingAppointments(false);
      return;
    }
    setIsLoadingAppointments(true);
    
    const startOfTime = Timestamp.fromDate(new Date(2023, 0, 1)); 

    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("clientId", "==", auth.currentUser.uid),
      where("startTime", ">=", startOfTime),
      where("status", "in", ["confirmed", "checked_in", "completed"]) 
    );

    const unsubscribe = onSnapshot(appointmentsQuery, (querySnapshot) => {
      const appointmentsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Ordena: Futuros primeiro
      appointmentsList.sort((a, b) => b.startTime.seconds - a.startTime.seconds);
      
      setMyAppointments(appointmentsList);
      setIsLoadingAppointments(false);
    }, (error) => {
      console.error("Erro agendamentos:", error);
      setIsLoadingAppointments(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Busca Feed
  useEffect(() => {
    if (mainTab === 'feed' && !viewingShopId) {
        const fetchFeed = async () => {
            setIsLoadingFeed(true);
            try {
                const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20));
                const snap = await getDocs(q);
                const postsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setFeedPosts(postsList);
            } catch (error) {
                console.error("Erro feed:", error);
            } finally {
                setIsLoadingFeed(false);
            }
        };
        fetchFeed();
    }
  }, [mainTab, viewingShopId]);

  // 3.1 Busca Feed da Loja Específica (Perfil da Loja)
useEffect(() => {
  if (viewingShopId && shopSection === 'feed') {
    const fetchShopFeed = async () => {
      setIsLoadingShopFeed(true);
      try {
        const q = query(collection(db, "posts"), where("shopId", "==", viewingShopId), orderBy("createdAt", "desc"), limit(20));
        const snap = await getDocs(q);
        setShopPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) { 
        console.error("Erro feed loja:", error); 
      } finally { 
        setIsLoadingShopFeed(false); 
      }
    };
    fetchShopFeed();
  }
}, [viewingShopId, shopSection]);

// 3.2 Busca Rating da Loja (independente da seção)
useEffect(() => {
  if (viewingShopId) {
    const fetchShopRating = async () => {
      try {
        const q = query(collection(db, "appointments"), where("barbershopId", "==", viewingShopId));
        const snap = await getDocs(q);
        let total = 0;
        let count = 0;
        
        snap.forEach(doc => {
          const d = doc.data();
          if (d.rating && d.rating > 0) {
            total += d.rating;
            count++;
          }
        });
        
        setShopRating(count > 0 ? (total / count).toFixed(1) : "Novo");
        setShopReviewCount(count);
      } catch (error) { 
        console.error("Erro rating", error); 
      }
    };
    fetchShopRating();
  }
}, [viewingShopId]); // ← Só depende da loja, não da seção



  // 4. Carregar dados da loja (quando selecionada)
  useEffect(() => {
    if (viewingShopId) {
      const fetchShopData = async () => {
         try {
           const shopDoc = await getDoc(doc(db, "barbershops", viewingShopId));
           if (shopDoc.exists()) setCurrentShopData(shopDoc.data());
         } catch (error) { console.error("Erro loja", error); }
      };
      fetchShopData();

      const fetchServices = async () => {
        setIsLoadingServices(true);
        try {
          const q = query(collection(db, "services"), where("barbershopId", "==", viewingShopId));
          const snap = await getDocs(q);
          setServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) { console.error("Erro serviços", error); }
        finally { setIsLoadingServices(false); }
      };
      fetchServices();
      
      const fetchProducts = async () => {
        setIsLoadingProducts(true);
        try {
          const q = query(collection(db, "products"), where("barbershopId", "==", viewingShopId));
          const snap = await getDocs(q);
          setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), stock: doc.data().stock || 0 })));
        } catch (error) { console.error("Erro produtos", error); } 
        finally { setIsLoadingProducts(false); }
      };
      fetchProducts();
    }
  }, [viewingShopId]);

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

        if (result.data && result.data.slots) setAvailableSlots(result.data.slots);
        else setAvailableSlots([]);
        
      } catch (error) { 
          console.error("Erro slots:", error);
          toast.error("Erro ao buscar horários.");
      } 
      finally { setIsLoadingSlots(false); }
    };
    
    fetchAvailableSlots();
  }, [selectedDate, selectedProfessional, selectedService, viewingShopId]);

  // --- HANDLERS ---

  const handleSearchCity = async (e) => {
    e.preventDefault();
    if (!searchCity) return;
    setIsLoadingShops(true);
    setBarbershops([]);
    const normalizedSearch = searchCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    try {
      const q = query(collection(db, "barbershops"), where("cidadeQuery", "==", normalizedSearch));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBarbershops(list);
      setSearchedCity(searchCity);
      if(list.length === 0) toast.info("Nenhuma barbearia encontrada.");
    } catch (error) { toast.error("Erro ao buscar."); } 
    finally { setIsLoadingShops(false); }
  };

  const handleSelectService = async (service) => {
    setSelectedService(service);
    setIsLoadingProfessionals(true);
    setAvailableProfessionals([]);
    try {
      const q = query(
        collection(db, "professionals"),
        where("barbershopId", "==", viewingShopId),
        where("services", "array-contains", service.id) 
      );
      const snap = await getDocs(q);
      setAvailableProfessionals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { toast.error("Erro ao carregar profissionais."); } 
    finally { setIsLoadingProfessionals(false); }
  };

  const handleUpdateCart = (product, operation) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      if (operation === 'add') {
        if (existingItem) {
          if (existingItem.qty >= product.stock) {
            toast.error(`Estoque máximo atingido.`);
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

  const handleRateService = async (appointmentId, ratingValue) => {
    try {
        await updateDoc(doc(db, "appointments", appointmentId), { rating: ratingValue });
        toast.success(`Avaliação enviada! ⭐`);
    } catch (error) { toast.error("Erro ao avaliar."); }
  };

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
      
      if (method === 'in_store_combined') {
        await addDoc(collection(db, "appointments"), {
          clientId: auth.currentUser.uid, professionalId: selectedProfessional.id, barbershopId: viewingShopId,
          startTime: Timestamp.fromDate(startTimeObj), endTime: Timestamp.fromDate(endTimeObj),
          serviceId: selectedService.id, status: "confirmed", paymentMethod: "in_store_combined",
          preference: clientPreference,
          orderItems: orderItems, totalPrice: finalTotal, createdAt: Timestamp.now()
        });
        toast.success("Agendamento Confirmado!");
        resetSelection();
        setViewingShopId(null); // Volta para o dashboard
      } else if (method === 'online_combined') {
        toast.loading("Gerando pagamento...");
        const payload = {
          title: `Serviços - ${currentShopData?.name}`, price: finalTotal,
          appointmentData: {
            clientId: auth.currentUser.uid, professionalId: selectedProfessional.id, serviceId: selectedService.id,
            barbershopId: viewingShopId, startTime: startTimeObj.toISOString(), endTime: endTimeObj.toISOString(),
            orderItems: orderItems, totalPrice: finalTotal, preference: clientPreference,
          }
        };
        const createPaymentFn = httpsCallable(functions, 'createPayment');
        const response = await createPaymentFn(payload);
        if (response.data.paymentUrl) window.location.href = response.data.paymentUrl;
        else toast.error("Erro no pagamento.");
      }
    } catch (error) { toast.error("Erro: " + error.message); }
  };

  const resetSelection = () => {
    setSelectedService(null); setAvailableProfessionals([]); setSelectedProfessional(null);
    setSelectedDate(new Date()); setAvailableSlots([]); setSelectedSlot(null); setCart([]);
    setCheckoutStage('slots'); setClientPreference('chat');
  };
  
  const handleBackToCatalog = () => {
    setViewingShopId(null); resetSelection();
  };

  const handleSaveProfile = async (e) => {
      e.preventDefault();
      setIsSavingProfile(true);
      try {
          let url = profilePhotoUrl;
          if (newProfilePhoto) {
              const uploadPromise = uploadImageToCloudinary(newProfilePhoto);
              toast.promise(uploadPromise, { loading: 'Enviando foto...', success: 'Foto enviada!', error: 'Erro na foto' });
              url = await uploadPromise;
          }
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
              displayName: profileName, phoneNumber: profilePhone, photoUrl: url
          });
          setProfilePhotoUrl(url); setNewProfilePhoto(null);
          toast.success("Perfil atualizado!");
      } catch (error) { toast.error("Erro ao salvar perfil."); } 
      finally { setIsSavingProfile(false); }
  };

  const handleLogout = () => {
      auth.signOut(); window.location.reload();
  };

  // --- RENDERERS ---

  const renderProfile = () => (
      <div className="max-w-md mx-auto animate-fade-in pt-4">
          <div className="card-premium flex flex-col items-center text-center space-y-6">
              <div className="relative group cursor-pointer">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-grafite-border group-hover:border-gold-main transition-all shadow-xl">
                      <img src={newProfilePhoto ? URL.createObjectURL(newProfilePhoto) : (profilePhotoUrl || 'https://placehold.co/200?text=Foto')} className="w-full h-full object-cover"/>
                  </div>
                  <label htmlFor="profile_photo" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer text-white font-bold text-xs">
                      <Camera size={24} className="mb-1"/>
                      <input id="profile_photo" name="profile_photo" type="file" className="hidden" accept="image/*" onChange={(e) => setNewProfilePhoto(e.target.files[0])}/>
                  </label>
              </div>
              <div className="flex items-center gap-1 text-gold-main bg-gold-dim/10 px-4 py-2 rounded-full border border-gold-main/20">
                  <span className="font-bold text-lg">5.0</span> 
                  <div className="flex"><Star size={14} fill="currentColor"/></div>
                  <span className="text-xs text-text-secondary ml-1">(Cliente VIP)</span>
              </div>
              <form onSubmit={handleSaveProfile} className="w-full space-y-4 text-left">
                  <div className="space-y-1">
                      <label htmlFor="p_name" className="text-xs text-text-secondary ml-1">Seu Nome</label>
                      <input id="p_name" name="p_name" type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="input-premium"/>
                  </div>
                  <div className="space-y-1">
                      <label htmlFor="p_phone" className="text-xs text-text-secondary ml-1">WhatsApp</label>
                      <input id="p_phone" name="p_phone" type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="input-premium"/>
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs text-text-secondary ml-1">E-mail (Não editável)</label>
                      <input type="email" value={auth.currentUser?.email || ''} disabled className="input-premium opacity-50 cursor-not-allowed"/>
                  </div>
                  <button type="submit" disabled={isSavingProfile} className="btn-primary w-full h-12 mt-4 shadow-glow flex items-center justify-center gap-2">
                      {isSavingProfile ? 'Salvando...' : <><Save size={18}/> Salvar Alterações</>}
                  </button>
              </form>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2 mt-4 transition-colors">
                  <LogOut size={16}/> Sair da conta
              </button>
          </div>
      </div>
  );

  const renderAppointmentDetails = () => {
      if (!selectedAppointment) return null;
      const app = selectedAppointment;
      return (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
              <div className="bg-grafite-card w-full max-w-md h-[85vh] sm:h-auto rounded-t-3xl sm:rounded-3xl border-t sm:border border-grafite-border p-6 relative flex flex-col shadow-2xl overflow-y-auto">
                  <button onClick={() => setSelectedAppointment(null)} className="absolute top-4 right-4 p-2 bg-grafite-surface rounded-full text-text-secondary hover:text-white transition-colors">
                      <X size={20}/>
                  </button>
                  <div className="flex flex-col items-center mb-6">
                      <div className="w-16 h-16 bg-gold-main rounded-full flex items-center justify-center text-grafite-main mb-3 shadow-glow">
                          <Scissors size={32}/>
                      </div>
                      <h3 className="text-xl font-heading font-bold text-white text-center">{app.serviceName}</h3>
                      <p className="text-sm text-text-secondary">{app.barbershopName || 'Barbearia'}</p>
                      <span className={`mt-2 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide border ${app.status === 'checked_in' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-blue-500/10 border-blue-500 text-blue-400'}`}>
                          {app.status === 'checked_in' ? 'Na Loja' : 'Confirmado'}
                      </span>
                  </div>
                  <div className="space-y-4 bg-grafite-main p-4 rounded-xl border border-grafite-border">
                      <div className="flex items-center justify-between"><span className="text-sm text-text-secondary flex items-center gap-2"><CalIcon size={16}/> Data</span><span className="text-white font-bold">{app.startTime?.toDate().toLocaleDateString('pt-BR')}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm text-text-secondary flex items-center gap-2"><Clock size={16}/> Horário</span><span className="text-white font-bold">{app.startTime?.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm text-text-secondary flex items-center gap-2"><User size={16}/> Profissional</span><span className="text-white font-bold">Verifique na Loja</span></div>
                      <div className="border-t border-grafite-border my-2"></div>
                      <div className="flex items-center justify-between"><span className="text-sm text-text-secondary flex items-center gap-2"><CreditCard size={16}/> Valor Total</span><span className="text-gold-main font-bold text-lg">R$ {(app.totalPrice || 0).toFixed(2)}</span></div>
                  </div>
                  <div className="mt-6 flex gap-3">
                      <button className="flex-1 btn-primary py-3 rounded-xl text-sm" onClick={() => setSelectedAppointment(null)}>Fechar</button>
                      <button className="flex-1 bg-grafite-surface border border-grafite-border text-white py-3 rounded-xl text-sm hover:bg-white/5 transition-colors"><MapPin size={16} className="inline mr-2"/> Como Chegar</button>
                  </div>
              </div>
          </div>
      );
  };

  // --- ESTRUTURA PRINCIPAL (RETURN) ---
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in pb-32 min-h-screen relative">
        
        {selectedAppointment && renderAppointmentDetails()}

        <h2 className="text-3xl font-heading font-bold text-gold-main mb-2 pl-1">
            {mainTab === 'agenda' ? (viewingShopId ? 'Agendamento' : 'Sua Agenda') : mainTab === 'feed' ? 'BarberTok' : 'Seu Perfil'}
        </h2>

        {/* --- ABA 1: AGENDA --- */}
        {mainTab === 'agenda' && (
            <div className="animate-slide-up">
                
                {viewingShopId ? (
                    /* FLUXO DE AGENDAMENTO (LOJA SELECIONADA) */
                    <>
                        {!isBrandedEnvironment && (
                            <button onClick={handleBackToCatalog} className="mb-4 flex items-center text-text-secondary hover:text-gold-main gap-2 text-sm font-medium">
                                <ArrowLeft size={16}/> Sair da Loja
                            </button>
                        )}
                        
                        {/* Etapas de Agendamento */}

                        {/* PERFIL DA LOJA (Home da Loja) */}
                        {!selectedService && (
                            <div className="animate-fade-in">
                                {/* Header de Navegação */}
                                {!isBrandedEnvironment && (
                                    <button onClick={handleBackToCatalog} className="mb-4 flex items-center text-text-secondary hover:text-gold-main gap-2 text-sm font-medium">
                                        <ArrowLeft size={16}/> Voltar
                                    </button>
                                )}

                                {/* Cabeçalho do Perfil da Loja (PREMIUM) */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="w-28 h-28 rounded-full p-1 border-2 border-gold-main mb-3 shadow-glow relative group">
                                        <img 
                                            src={currentShopData?.logoUrl || 'https://placehold.co/150?text=Logo'} 
                                            className="w-full h-full rounded-full object-cover bg-grafite-surface"
                                        />
                                        <div className="absolute bottom-0 right-0 bg-grafite-main border border-gold-main rounded-full p-1.5 shadow-sm">
                                            <div className="flex items-center gap-1 text-xs font-bold text-gold-main">
                                                <Star size={10} fill="currentColor"/> {shopRating}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <h2 className="text-2xl font-heading font-bold text-white">{currentShopData?.name || 'Carregando...'}</h2>
                                    
                                    <div className="flex items-center gap-3 mt-2 text-sm text-text-secondary">
                                        <span className="flex items-center gap-1"><MapPin size={14} className="text-gold-main"/> {currentShopData?.cidade}</span>
                                        <span className="w-1 h-1 rounded-full bg-text-secondary/50"></span>
                                        <span className="text-xs">{shopReviewCount} avaliações</span>
                                    </div>

                                    <p className="text-xs text-text-secondary/70 mt-1 mb-3">{currentShopData?.address}</p>

                                    {/* Descrição Expansível */}
                                    <div 
                                        onClick={() => setIsShopInfoOpen(!isShopInfoOpen)}
                                        className={`relative text-sm text-gray-300 text-center max-w-md bg-grafite-card/50 p-3 rounded-xl border border-grafite-border cursor-pointer transition-all ${isShopInfoOpen ? '' : 'line-clamp-2'}`}
                                    >
                                        {currentShopData?.description || "Bem-vindo à nossa barbearia!"}
                                        {!isShopInfoOpen && (currentShopData?.description?.length > 80) && (
                                            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-grafite-card to-transparent flex justify-center items-end">
                                                <ChevronRight size={14} className="rotate-90 text-gold-main"/>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Abas da Loja (Serviços vs Feed) */}
                                <div className="flex p-1 bg-grafite-card border border-grafite-border rounded-lg mb-6">
                                    <button 
                                        onClick={() => setShopSection('services')} 
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${shopSection === 'services' ? 'bg-gold-main text-grafite-main shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                    >
                                        Serviços
                                    </button>
                                    <button 
                                        onClick={() => setShopSection('feed')} 
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${shopSection === 'feed' ? 'bg-gold-main text-grafite-main shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                    >
                                        Feed
                                    </button>
                                </div>

                                {/* CONTEÚDO: SERVIÇOS (Lista Original) */}
                                {shopSection === 'services' && (
                                    <section className="animate-slide-up">
                                        {isLoadingServices ? (
                                            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>
                                        ) : services.length > 0 ? (
                                            <div className="flex flex-col gap-3">
                                                {services.map(service => (
                                                    <div 
                                                        key={service.id} 
                                                        onClick={() => handleSelectService(service)} 
                                                        className="bg-grafite-card border border-grafite-border rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:border-gold-main hover:shadow-glow transition-all group"
                                                    >
                                                        <div className="h-16 w-16 rounded-lg bg-grafite-surface overflow-hidden flex-shrink-0">
                                                            {service.imageUrl ? (
                                                                <img src={service.imageUrl} className="w-full h-full object-cover"/>
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-text-secondary/30"><Scissors size={24}/></div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-bold text-white group-hover:text-gold-main transition-colors">{service.name}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                                                                <span className="flex items-center gap-1"><Clock size={10}/> {service.duration} min</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-gold-main font-bold">R$ {service.price.toFixed(2)}</span>
                                                            <div className="mt-2 w-6 h-6 rounded-full bg-gold-dim text-gold-main flex items-center justify-center group-hover:bg-gold-main group-hover:text-grafite-main transition-colors">
                                                                <Plus size={14}/>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {/* Produtos Teaser */}
                                                {products.length > 0 && (
                                                    <div className="mt-4 p-3 bg-grafite-surface/50 border border-dashed border-grafite-border rounded-xl flex items-center justify-center gap-2 text-xs text-text-secondary">
                                                        <Package size={14}/> {products.length} produtos disponíveis na próxima etapa
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-text-secondary italic text-center py-10">Nenhum serviço disponível.</p>
                                        )}
                                    </section>
                                )}

                                {/* CONTEÚDO: FEED DA LOJA */}
                                {shopSection === 'feed' && (
                                    <section className="animate-slide-up">
                                        {isLoadingShopFeed ? (
                                            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div>
                                        ) : shopPosts.length === 0 ? (
                                            <div className="text-center py-16 border-2 border-dashed border-grafite-border rounded-xl">
                                                <Video size={32} className="mx-auto text-text-secondary mb-2 opacity-50"/>
                                                <p className="text-text-secondary text-sm">Essa barbearia ainda não postou nada.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-1">
                                                {shopPosts.map(post => (
                                                    <div key={post.id} className="aspect-square bg-grafite-card relative overflow-hidden cursor-pointer group" onClick={() => {
                                                        // Lógica opcional: Abrir modal do post (Full View)
                                                        // Por enquanto, apenas visualização em grade
                                                    }}>
                                                        {post.type === 'video' ? (
                                                            <video src={post.mediaUrl} className="w-full h-full object-cover"/>
                                                        ) : (
                                                            <img src={post.mediaUrl} className="w-full h-full object-cover"/>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all"/>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        )}
                        
                        {selectedService && !selectedProfessional && (
                             /* Etapa 2: Profissionais */
                             <div className="animate-fade-in">
                                <button onClick={resetSelection} className="mb-6 flex items-center text-text-secondary hover:text-gold-main gap-2 text-sm font-medium"><ArrowLeft size={18}/> Voltar</button>
                                <h2 className="text-2xl font-bold text-white mb-6 text-center">Quem vai te atender?</h2>
                                {isLoadingProfessionals ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div> : 
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {availableProfessionals.length > 0 ? availableProfessionals.map(prof => (
                                     <div key={prof.id} onClick={() => setSelectedProfessional(prof)} className="bg-grafite-card border border-grafite-border p-6 rounded-2xl hover:border-gold-main hover:shadow-glow transition-all cursor-pointer flex items-center gap-4 group">
                                        <div className="w-16 h-16 rounded-full bg-grafite-surface border-2 border-grafite-border flex items-center justify-center text-2xl font-bold text-gold-main group-hover:border-gold-main transition-colors shadow-lg">{prof.name.charAt(0).toUpperCase()}</div>
                                        <div><h4 className="text-lg font-bold text-white group-hover:text-gold-main transition-colors">{prof.name}</h4><div className="flex items-center gap-1 text-xs text-text-secondary mt-1"><Star size={12} className="text-gold-main fill-gold-main"/> Profissional</div></div>
                                        <ChevronRight className="ml-auto text-text-secondary group-hover:text-gold-main transition-colors"/>
                                     </div>
                                  )) : <p className="col-span-2 text-center text-text-secondary py-10">Nenhum profissional disponível.</p>}
                                </div>}
                             </div>
                        )}

                        {selectedService && selectedProfessional && checkoutStage === 'slots' && (
                             /* Etapa 3: Horários */
                             <div className="animate-fade-in">
                                <button onClick={() => setSelectedProfessional(null)} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm"><ArrowLeft size={16}/> Voltar</button>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                  <div className="lg:col-span-4 card-premium space-y-4">
                                     <div><p className="text-xs text-text-secondary uppercase">Serviço</p><p className="text-gold-main font-bold text-lg">{selectedService.name}</p></div>
                                     <div><p className="text-xs text-text-secondary uppercase">Profissional</p><p className="text-text-primary font-medium">{selectedProfessional.name}</p></div>
                                  </div>
                                  <div className="lg:col-span-8 card-premium flex flex-col md:flex-row gap-8">
                                     <div className="flex-1 calendar-wrapper text-text-primary"><Calendar onChange={setSelectedDate} value={selectedDate} minDate={new Date()} className="react-calendar border-none bg-transparent" tileClassName={({ date, view }) => (view === 'month' && date.getDay() === 0) ? 'text-red-400' : null}/></div>
                                     <div className="flex-1 border-l border-grafite-border pl-0 md:pl-8 pt-6 md:pt-0">
                                        <h4 className="text-sm font-bold text-text-secondary uppercase mb-4">Horários</h4>
                                        {isLoadingSlots ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-main"></div></div> : 
                                          availableSlots.length > 0 ? <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">{availableSlots.map(slot => <button key={slot} onClick={() => handleSlotClick(slot)} className="py-2 px-1 rounded border border-grafite-border bg-grafite-main text-text-primary hover:bg-gold-main hover:text-grafite-main hover:border-gold-main transition-all text-sm font-medium">{slot}</button>)}</div> : <p className="text-sm text-text-secondary italic">Nenhum horário livre.</p>
                                        }
                                     </div>
                                  </div>
                                </div>
                             </div>
                        )}

                        {selectedService && selectedProfessional && checkoutStage === 'products' && (
                             /* Etapa 4: Produtos */
                             <div className="animate-fade-in">
                                <button onClick={() => setCheckoutStage('slots')} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm"><ArrowLeft size={16}/> Voltar</button>
                                <h2 className="text-2xl font-heading font-bold text-gold-main mb-6">Deseja adicionar algo?</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <section className="card-premium lg:col-span-2 h-full">
                                        {isLoadingProducts ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gold-main"></div></div> :
                                        products.length === 0 ? <p className="text-text-secondary italic">Nenhum produto cadastrado.</p> :
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            {products.map(product => {
                                                const currentQty = cart.find(item => item.productId === product.id)?.qty || 0;
                                                return (
                                                <div key={product.id} className="bg-grafite-main border border-grafite-border rounded-xl p-4 flex items-center gap-4">
                                                    <img src={product.imageUrl} className="w-16 h-16 object-cover rounded-lg"/>
                                                    <div className="flex-1 overflow-hidden"><h4 className="font-bold text-text-primary truncate">{product.name}</h4><span className="text-gold-main text-sm font-medium">R$ {Number(product.price).toFixed(2)}</span></div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => handleUpdateCart(product, 'remove')} className="p-1 rounded-full border border-grafite-border bg-grafite-surface disabled:opacity-50" disabled={currentQty === 0}><Minus size={16}/></button>
                                                        <span className="text-white font-mono w-4 text-center">{currentQty}</span>
                                                        <button onClick={() => handleUpdateCart(product, 'add')} className="p-1 rounded-full border border-gold-main/50 text-gold-main bg-gold-dim" disabled={currentQty >= product.stock}><Plus size={16}/></button>
                                                    </div>
                                                </div>
                                            )})}
                                        </div>}
                                    </section>
                                    <section className="lg:col-span-1 card-premium sticky top-24 h-fit">
                                        <div className="flex justify-between text-white font-semibold mb-2"><span>{selectedService.name}</span><span>R$ {totalServicePrice.toFixed(2)}</span></div>
                                        {cart.map(item => <div key={item.productId} className="flex justify-between text-sm text-text-secondary"><span>{item.name} x{item.qty}</span><span>R$ {(item.price * item.qty).toFixed(2)}</span></div>)}
                                        <div className="pt-4 border-t border-grafite-border/50 flex justify-between font-bold text-xl text-gold-main mt-2"><span>TOTAL:</span><span>R$ {finalTotal.toFixed(2)}</span></div>
                                        <button onClick={() => setCheckoutStage('review')} className="btn-primary w-full h-12 flex items-center justify-center gap-2 shadow-glow mt-6">Finalizar Pedido</button>
                                    </section>
                                </div>
                             </div>
                        )}

                        {checkoutStage === 'review' && (
                             /* Etapa 5: Revisão */
                             <div className="max-w-xl mx-auto animate-fade-in">
                                <button onClick={() => setCheckoutStage('products')} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm"><ArrowLeft size={16}/> Voltar</button>
                                <section className="card-premium space-y-6">
                                    <h2 className="text-2xl font-heading font-bold text-gold-main text-center">Pagamento</h2>
                                    <div className="bg-grafite-main p-4 rounded-lg border border-grafite-border mb-4">
                                        <h4 className="text-sm text-text-secondary mb-3 uppercase font-bold flex items-center gap-2"><User size={14} className="text-gold-main"/> Como prefere o atendimento?</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['chat', 'silent', 'suggestion'].map(pref => (
                                                <button key={pref} onClick={() => setClientPreference(pref)} className={`p-2 rounded border flex flex-col items-center gap-1 transition-all ${clientPreference === pref ? 'bg-gold-dim border-gold-main text-white' : 'border-grafite-border text-text-secondary hover:bg-grafite-surface'}`}>
                                                    {pref === 'chat' ? <MessageCircle size={20} /> : pref === 'silent' ? <VolumeX size={20} /> : <Lightbulb size={20} />}
                                                    <span className="text-[10px] font-bold capitalize">{pref === 'chat' ? 'Papo' : pref === 'silent' ? 'Zen' : 'Sugestão'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {currentShopData?.onlinePaymentEnabled && <button onClick={() => processBooking('online_combined')} className="w-full flex items-center justify-between p-4 rounded-lg border border-gold-main/30 bg-gold-dim/10 hover:bg-gold-main hover:text-grafite-main group transition-all text-text-primary font-semibold"><div className="flex items-center gap-3"><CreditCard size={20}/><span>Pagar Agora (Online)</span></div></button>}
                                        <button onClick={() => processBooking('in_store_combined')} className="w-full flex items-center justify-start gap-3 p-4 rounded-lg border border-grafite-border bg-grafite-main hover:bg-grafite-surface transition-all text-text-primary font-semibold"><Store size={20}/><span>Pagar na Barbearia</span></button>
                                    </div>
                                </section>
                             </div>
                        )}
                    </>
                ) : (
                    /* DASHBOARD DO CLIENTE (FORA DE LOJA) */
                    <>
                        <div className="flex p-1 bg-grafite-card border border-grafite-border rounded-xl mb-6 overflow-x-auto gap-1 scrollbar-hide sticky top-0 z-10 shadow-lg">
                            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'dashboard' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-text-primary'}`}><LayoutGrid size={16}/> Dashboard</button>
                            <button onClick={() => setActiveTab('new')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'new' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-text-primary'}`}><Plus size={16}/> Novo Agendamento</button>
                        </div>

                        {activeTab === 'dashboard' && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white mb-2">Próximos Cortes</h3>
                                {!isLoadingAppointments && myAppointments.length > 0 ? myAppointments.map(app => (
                                    <div key={app.id} onClick={() => setSelectedAppointment(app)} className="bg-grafite-card border border-grafite-border rounded-xl p-4 flex justify-between items-center hover:border-gold-main/50 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-grafite-surface flex flex-col items-center justify-center border border-grafite-border text-gold-main"><span className="text-xs font-bold uppercase">{app.startTime.toDate().toLocaleString('default', { month: 'short' })}</span><span className="text-lg font-bold leading-none">{app.startTime.toDate().getDate()}</span></div>
                                            <div><h4 className="font-bold text-white group-hover:text-gold-main transition-colors">{app.serviceName}</h4><p className="text-xs text-text-secondary flex items-center gap-1"><Clock size={10}/> {app.startTime.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p></div>
                                        </div>
                                        <ChevronRight className="text-text-secondary group-hover:translate-x-1 transition-transform"/>
                                    </div>
                                )) : <div className="text-center py-12 border-2 border-dashed border-grafite-border rounded-xl bg-grafite-surface/20"><p className="text-text-secondary text-sm">Sua agenda está vazia.</p><button onClick={() => setActiveTab('new')} className="text-gold-main font-bold hover:underline mt-1 text-sm">Agendar agora</button></div>}
                            </div>
                        )}

                        {activeTab === 'new' && (
                            <div className="animate-slide-up">
                                <div className="card-premium mb-6">
                                    <h2 className="text-lg font-bold text-white mb-4">Buscar Barbearia</h2>
                                    <form onSubmit={handleSearchCity} className="flex gap-2"><input type="text" value={searchCity} onChange={(e) => setSearchCity(e.target.value)} placeholder="Cidade..." className="input-premium h-10 text-sm flex-1"/><button type="submit" className="btn-primary h-10 w-10 flex items-center justify-center rounded-lg p-0"><Search size={18}/></button></form>
                                </div>
                                {searchedCity && barbershops.length > 0 && <div className="grid grid-cols-1 gap-4">{barbershops.map(shop => <div key={shop.id} onClick={() => setViewingShopId(shop.id)} className="bg-grafite-card border border-grafite-border rounded-xl p-3 flex gap-4 cursor-pointer hover:border-gold-main transition-all"><img src={shop.logoUrl} className="w-16 h-16 rounded-lg object-cover"/><div><h4 className="font-bold text-white">{shop.name}</h4><p className="text-xs text-text-secondary">{shop.address}</p></div></div>)}</div>}
                            </div>
                        )}
                    </>
                )}
            </div>
        )}

        {/* --- ABA 2: FEED --- */}
        {mainTab === 'feed' && (
            <div className="animate-slide-up pb-20">
                {isLoadingFeed ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-main"></div></div> : 
                 feedPosts.length === 0 ? <div className="text-center py-20 text-text-secondary"><p>Feed vazio.</p></div> : (
                    <div className="space-y-6 max-w-md mx-auto">
                        {feedPosts.map(post => (
                            <div key={post.id} className="bg-black rounded-xl overflow-hidden border border-grafite-border relative">
                                <div className="aspect-[4/5] bg-grafite-surface flex items-center justify-center">
                                    {post.type === 'video' ? <video src={post.mediaUrl} controls className="w-full h-full object-cover"/> : <img src={post.mediaUrl} className="w-full h-full object-cover"/>}
                                </div>
                                <div className="p-3 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent">
                                    <div className="flex justify-between items-end">
                                        <button onClick={() => { setViewingShopId(post.shopId); setMainTab('agenda'); }} className="bg-gold-main text-grafite-main px-4 py-1.5 rounded-full text-xs font-bold shadow-glow flex items-center gap-1"><CalIcon size={12}/> Agendar</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* --- ABA 3: PERFIL --- */}
        {mainTab === 'profile' && renderProfile()}

        {/* --- BARRA INFERIOR (DOCK) --- */}
        {!viewingShopId && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl p-1.5 flex justify-between items-center z-50">
                <button onClick={() => setMainTab('agenda')} className={`flex flex-col items-center justify-center w-full h-14 rounded-full transition-all duration-300 ${mainTab === 'agenda' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-white'}`}>
                    <Home size={22} strokeWidth={mainTab === 'agenda' ? 2.5 : 2} className="mb-0.5" />
                    {mainTab === 'agenda' && <span className="text-[10px] font-bold leading-none">Agenda</span>}
                </button>
                <button onClick={() => setMainTab('feed')} className={`flex flex-col items-center justify-center w-full h-14 rounded-full transition-all duration-300 ${mainTab === 'feed' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-white'}`}>
                    <Video size={22} strokeWidth={mainTab === 'feed' ? 2.5 : 2} className="mb-0.5" />
                    {mainTab === 'feed' && <span className="text-[10px] font-bold leading-none">Feed</span>}
                </button>
                <button onClick={() => setMainTab('profile')} className={`flex flex-col items-center justify-center w-full h-14 rounded-full transition-all duration-300 ${mainTab === 'profile' ? 'bg-gold-main text-grafite-main shadow-glow' : 'text-text-secondary hover:text-white'}`}>
                    <User size={22} strokeWidth={mainTab === 'profile' ? 2.5 : 2} className="mb-0.5" />
                    {mainTab === 'profile' && <span className="text-[10px] font-bold leading-none">Perfil</span>}
                </button>
            </div>
        )}

    </div>
  );
}

export default ClientPanel;