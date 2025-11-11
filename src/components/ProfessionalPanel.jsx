// src/components/ProfessionalPanel.jsx (Com Botão Único para Horários)

import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase-config';
import { 
  doc, 
  collection, 
  getDocs, 
  updateDoc, 
  setDoc,
  getDoc,
  writeBatch // 1. Importe o 'writeBatch'
} from "firebase/firestore";

// Helper para os dias da semana (sem mudança)
const daysOfWeek = [
  { key: 'sunday', label: 'Domingo' },
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
];

// CSS simples para organizar
const styles = {
  panel: {
    padding: '15px', 
    border: '1px solid #ccc', 
    marginBottom: '20px',
    borderRadius: '8px'
  },
  dayRow: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    alignItems: 'center',
    gap: '15px' // Espaçamento entre os elementos
  },
  dayLabel: {
    fontWeight: 'bold',
    minWidth: '100px' // Alinha os campos
  },
  sectionTitle: {
    borderBottom: '2px solid #007bff',
    paddingBottom: '5px',
    color: '#007bff'
  },
  saveButton: {
    marginTop: '15px',
    padding: '10px 15px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  }
};


function ProfessionalPanel() {
  // --- Estados (sem mudança) ---
  const [workingHours, setWorkingHours] = useState([]); 
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  const [allServices, setAllServices] = useState([]); 
  const [myServiceIds, setMyServiceIds] = useState(new Set()); 
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  const professionalId = auth.currentUser.uid;

  // --- Lógica de Carregamento (sem mudança) ---
  const fetchWorkingHours = useCallback(async () => {
    // ... (lógica de fetchWorkingHours igual a antes) ...
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
        console.log("Configurando horários padrão...");
        const batch = writeBatch(db); // Use um batch para o setup inicial
        for (const day of completeHours) {
          const dayDocRef = doc(db, "professionals", professionalId, "workingHours", day.id);
          batch.set(dayDocRef, day); 
        }
        await batch.commit(); // Salva todos de uma vez
      }
      setWorkingHours(completeHours);
    } catch (error) { console.error("Erro ao buscar horários: ", error); } 
    finally { setIsLoadingHours(false); }
  }, [professionalId]);

  const fetchAllServices = useCallback(async () => {
    // ... (lógica de fetchAllServices igual a antes) ...
    setIsLoadingServices(true);
    try {
      const servicesCollectionRef = collection(db, "services");
      const querySnapshot = await getDocs(servicesCollectionRef);
      const servicesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllServices(servicesList);
    } catch (error) { console.error("Erro ao buscar TODOS os serviços: ", error); } 
    finally { setIsLoadingServices(false); }
  }, []);

  const fetchMyServices = useCallback(async () => {
    // ... (lógica de fetchMyServices igual a antes) ...
    if (!professionalId) return;
    try {
      const profDocRef = doc(db, "professionals", professionalId);
      const docSnap = await getDoc(profDocRef);
      if (docSnap.exists()) {
        setMyServiceIds(new Set(docSnap.data().services || []));
      } else { console.warn("Documento do profissional não encontrado."); }
    } catch (error) { console.error("Erro ao buscar MEUS serviços: ", error); }
  }, [professionalId]);

  useEffect(() => {
    fetchWorkingHours();
    fetchAllServices();
    fetchMyServices();
  }, [fetchWorkingHours, fetchAllServices, fetchMyServices]);
  

  // --- Funções de SALVAR ---

  // 2. REMOVIDO: 'handleSaveDay' não é mais necessário.

  // 3. NOVA FUNÇÃO: Salva TODOS os horários de uma vez
  const handleSaveAllHours = async () => {
    setIsLoadingHours(true);
    try {
      // Cria um "batch" (pacote) de escritas
      const batch = writeBatch(db);
      
      // Adiciona cada um dos 7 dias ao "pacote"
      workingHours.forEach((day) => {
        const dayDocRef = doc(db, "professionals", professionalId, "workingHours", day.id);
        // Usamos 'update' em vez de 'set' para não sobrescrever outros campos
        // (embora 'set' com 'merge:true' também funcionaria)
        batch.update(dayDocRef, {
          isWorking: day.isWorking,
          startTime: day.startTime,
          endTime: day.endTime
        });
      });
      
      // Envia o "pacote" (todos os 7 updates) de uma só vez
      await batch.commit();
      
      // 4. Confirmação de Sucesso
      alert("Horários atualizados com sucesso!");

    } catch (error) {
      console.error("Erro ao salvar horários: ", error);
      alert("Erro ao salvar horários: " + error.message);
    } finally {
      setIsLoadingHours(false);
    }
  };

  // Lógica de toggle dos serviços (sem mudança)
  const handleServiceToggle = (serviceId) => {
    setMyServiceIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(serviceId)) newIds.delete(serviceId);
      else newIds.add(serviceId);
      return newIds;
    });
  };

  // Salva os serviços (já tinha o alert, está OK)
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

  // --- RENDERIZAÇÃO (JSX) ---

  return (
    <div>
      {/* Seção 1: Meus Horários */}
      <div style={styles.panel}>
        <h3 style={styles.sectionTitle}>Meu Horário de Trabalho</h3>
        {isLoadingHours ? <p>Carregando horários...</p> : (
          <div> {/* Container para os dias */}
            {workingHours.map((day) => (
              // 5. O HTML de cada dia (removido o botão de salvar)
              <div key={day.id} style={styles.dayRow}>
                <label style={styles.dayLabel} htmlFor={`check-${day.id}`}>
                  {day.day}
                </label>
                <input 
                  type="checkbox"
                  id={`check-${day.id}`}
                  checked={day.isWorking}
                  onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, isWorking: e.target.checked} : d))}
                />
                
                {day.isWorking && (
                  <> {/* 'Fragment' para agrupar os inputs */}
                    <label>De: </label>
                    <input 
                      type="time"
                      value={day.startTime}
                      onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, startTime: e.target.value} : d))}
                    />
                    <label> Até: </label>
                    <input 
                      type="time"
                      value={day.endTime}
                      onChange={(e) => setWorkingHours(wh => wh.map(d => d.id === day.id ? {...d, endTime: e.target.value} : d))}
                    />
                  </>
                )}
                {!day.isWorking && (
                  <span style={{color: '#888'}}>Fechado</span>
                )}
              </div>
            ))}
            {/* 6. O NOVO Botão Único */}
            <button 
              onClick={handleSaveAllHours} 
              style={styles.saveButton}
              disabled={isLoadingHours}
            >
              {isLoadingHours ? 'Salvando...' : 'Salvar Horários'}
            </button>
          </div>
        )}
      </div>

      {/* Seção 2: Meus Serviços (sem mudança na lógica, só estilo) */}
      <div style={styles.panel}>
        <h3 style={styles.sectionTitle}>Meus Serviços</h3>
        <p>Selecione os serviços que você oferece.</p>
        {isLoadingServices ? <p>Carregando serviços...</p> : (
          <div>
            {allServices.map(service => (
              <div key={service.id} style={{padding: '5px'}}>
                <input
                  type="checkbox"
                  id={`service-${service.id}`}
                  checked={myServiceIds.has(service.id)}
                  onChange={() => handleServiceToggle(service.id)}
                />
                <label htmlFor={`service-${service.id}`}>
                  {service.name} (R$ {service.price})
                </label>
              </div>
            ))}
            <button 
              onClick={handleSaveMyServices} 
              style={styles.saveButton}
              disabled={isLoadingServices}
            >
              {isLoadingServices ? 'Salvando...' : 'Salvar Meus Serviços'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfessionalPanel;