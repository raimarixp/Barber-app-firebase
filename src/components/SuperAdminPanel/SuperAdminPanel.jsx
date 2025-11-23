// src/components/SuperAdminPanel/SuperAdminPanel.jsx
// (COMPLETO - Com Drill Down para AdminPanel)

import { useState, useEffect } from 'react';
import { db } from '../../firebase/firebase-config';
import { collection, getDocs, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { toast } from 'sonner';
import { LayoutDashboard, Store, ShieldCheck, ShieldAlert, Search, ExternalLink, Settings } from 'lucide-react';
import AdminPanel from '../AdminPanel/AdminPanel.jsx'; // Importa o AdminPanel

function SuperAdminPanel() {
  const [shops, setShops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState({ totalShops: 0, activeShops: 0 });
  const [selectedShopId, setSelectedShopId] = useState(null); // Estado para controlar a loja selecionada

  const fetchShops = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "barbershops"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const shopsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setShops(shopsList);
      setStats({
          totalShops: shopsList.length,
          activeShops: shopsList.filter(s => s.isActive !== false).length
      });
    } catch (error) {
      console.error("Erro lojas:", error);
      toast.error("Erro ao carregar lojas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedShopId) fetchShops();
  }, [selectedShopId]);

  const toggleShopStatus = async (shop) => {
      const newStatus = !shop.isActive; 
      if(!confirm(`Alterar status de ${shop.name}?`)) return;
      try {
          await updateDoc(doc(db, "barbershops", shop.id), { isActive: newStatus });
          toast.success(`Status atualizado.`);
          fetchShops();
      } catch (error) { toast.error("Erro."); }
  };

  const filteredShops = shops.filter(s => s.name?.toLowerCase().includes(filter.toLowerCase()));

  // --- RENDERIZAÇÃO DO MODO GOD (Drill Down) ---
  if (selectedShopId) {
      return (
          <div className="border-4 border-red-900 rounded-xl overflow-hidden">
              <AdminPanel 
                  forcedShopId={selectedShopId} 
                  onBack={() => setSelectedShopId(null)} 
              />
          </div>
      );
  }

  // --- RENDERIZAÇÃO DA LISTA ---
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div><h2 className="text-3xl font-heading font-bold text-purple-500">God Mode</h2><p className="text-text-secondary">Gestão Global</p></div>
          <div className="flex gap-4">
              <div className="bg-grafite-card border border-grafite-border px-4 py-2 rounded-lg text-center"><span className="text-xs text-text-secondary uppercase block">Total</span><span className="text-xl font-bold text-white">{stats.totalShops}</span></div>
              <div className="bg-grafite-card border border-grafite-border px-4 py-2 rounded-lg text-center"><span className="text-xs text-text-secondary uppercase block">Ativas</span><span className="text-xl font-bold text-green-500">{stats.activeShops}</span></div>
          </div>
      </div>

      <section className="card-premium">
          <div className="flex justify-between items-center mb-6">
              <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18}/>
                  <input type="text" placeholder="Buscar..." value={filter} onChange={(e) => setFilter(e.target.value)} className="input-premium pl-10"/>
              </div>
          </div>

          {isLoading ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div></div> : (
              <div className="grid gap-4">
                  {filteredShops.map(shop => (
                      <div key={shop.id} className="bg-grafite-main border border-grafite-border p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 hover:border-purple-500/30 transition-all">
                          <div className="flex items-center gap-4 w-full md:w-auto">
                              <img src={shop.logoUrl || 'https://placehold.co/100'} className="w-12 h-12 rounded-full object-cover border border-grafite-border"/>
                              <div>
                                  <h4 className="font-bold text-text-primary text-lg flex items-center gap-2">{shop.name} {shop.isActive === false && <span className="text-[10px] bg-red-500 text-white px-2 rounded">BLOQUEADA</span>}</h4>
                                  <p className="text-xs text-text-secondary">{shop.cidade} • {shop.phone}</p>
                                  <p className="text-[10px] text-text-secondary font-mono mt-1">ID: {shop.id}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-3 w-full md:w-auto">
                              <button onClick={() => setSelectedShopId(shop.id)} className="px-4 py-2 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20">
                                  <Settings size={16}/> Gerenciar
                              </button>
                              <button onClick={() => toggleShopStatus(shop)} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${shop.isActive === false ? 'bg-green-600/20 text-green-400 border border-green-500' : 'bg-red-900/20 text-red-400 border border-red-900'}`}>
                                  {shop.isActive === false ? <ShieldCheck size={14}/> : <ShieldAlert size={14}/>}
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </section>
    </div>
  );
}

export default SuperAdminPanel;