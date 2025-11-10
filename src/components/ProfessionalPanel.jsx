// src/components/ProfessionalPanel.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase-config';
import { 
  doc, 
  collection, 
  getDocs, 
  updateDoc, 
  setDoc, 
  query, 
  where 
} from "firebase/firestore";

// Helper para os dias da semana
const daysOfWeek = [
  { key: 'sunday', label: 'Domingo' },
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
];

function ProfessionalPanel() {
  const [workingHours, setWorkingHours] = useState([]); // Armazena os 7 dias
  const [isLoading, setIsLoading] = useState(true);
  const [professionalId, setProfessionalId] = useState(null); // ID do doc 'professionals'

  // 1. Encontra o Documento do Profissional
  // Esta função busca na coleção 'professionals' pelo doc
  // que corresponde ao 'userId' do usuário logado.
  const fetchProfessionalProfile = useCallback(async () => {
    try {
      const currentUserId = auth.currentUser.uid;
      const profQuery = query(
        collection(db, "professionals"), 
        where("userId", "==", currentUserId)
      );
      
      const querySnapshot = await getDocs(profQuery);
      
      if (querySnapshot.empty) {
        console.error("Nenhum perfil de profissional encontrado para este usuário.");
        // Isso pode acontecer se o Admin ainda não criou o perfil
        alert("Seu perfil profissional ainda não foi configurado pelo Admin.");
        setIsLoading(false);
        return null;
      }
      
      // Pega o primeiro resultado (deve ser único)
      const profDoc = querySnapshot.docs[0];
      setProfessionalId(profDoc.id); // Salva o ID do documento (ex: 'prof_carlos_id')
      return profDoc.id; // Retorna o ID para a próxima função

    } catch (error) {
      console.error("Erro ao buscar perfil profissional: ", error);
      setIsLoading(false);
      return null;
    }
  }, []);

  // 2. Busca os Horários de Trabalho (baseado no ID do profissional)
  const fetchWorkingHours = useCallback(async (profId) => {
    if (!profId) return; // Não rode se não achamos o ID
    
    try {
      const hoursCollectionRef = collection(db, "professionals", profId, "workingHours");
      const querySnapshot = await getDocs(hoursCollectionRef);
      
      let hoursData = {};
      querySnapshot.forEach(doc => {
        hoursData[doc.id] = doc.data(); // Ex: { monday: { startTime: ... } }
      });

      // 3. Garante que os 7 dias existam
      // Se o barbeiro é novo, o Firestore estará vazio.
      // Precisamos criar os 7 dias.
      let needsUpdate = false;
      const completeHours = daysOfWeek.map(day => {
        if (hoursData[day.key]) {
          return { id: day.key, ...hoursData[day.key] };
        } else {
          // Dia não existe no Firestore, crie um padrão (ex: 09:00 - 18:00)
          needsUpdate = true;
          return { 
            id: day.key, 
            day: day.label,
            isWorking: (day.key !== 'sunday'), // Domingo 'false' por padrão
            startTime: "09:00", 
            endTime: "18:00" 
          };
        }
      });
      
      // 4. Se algum dia faltava, crie-o no Firestore (Setup inicial)
      if (needsUpdate) {
        console.log("Configurando horários padrão pela primeira vez...");
        for (const day of completeHours) {
          const dayDocRef = doc(db, "professionals", profId, "workingHours", day.id);
          // 'setDoc' cria ou sobrescreve
          await setDoc(dayDocRef, day); 
        }
      }
      
      setWorkingHours(completeHours); // Salva os 7 dias no estado

    } catch (error) {
      console.error("Erro ao buscar horários: ", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 5. Efeito Principal: Roda quando o componente carrega
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const profId = await fetchProfessionalProfile(); // 1. Acha o ID do Profissional
      if (profId) {
        await fetchWorkingHours(profId); // 2. Acha os horários
      }
    };
    loadData();
  }, [fetchProfessionalProfile, fetchWorkingHours]);
  
  // 6. Função para ATUALIZAR um horário no estado
  const handleTimeChange = (dayId, field, value) => {
    setWorkingHours(currentHours =>
      currentHours.map(day =>
        day.id === dayId ? { ...day, [field]: value } : day
      )
    );
  };
  
  // 7. Função para SALVAR um dia no Firestore
  const handleSaveDay = async (dayId) => {
    const dayToSave = workingHours.find(day => day.id === dayId);
    if (!dayToSave || !professionalId) return;
    
    setIsLoading(true);
    try {
      const dayDocRef = doc(db, "professionals", professionalId, "workingHours", dayId);
      await updateDoc(dayDocRef, dayToSave); // 'updateDoc' atualiza o doc
      alert(`Horários de "${dayToSave.day}" atualizados!`);
    } catch (error) {
      console.error("Erro ao salvar dia: ", error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading) {
    return <h2>Carregando seu painel...</h2>;
  }
  
  if (!professionalId) {
    return <h2>Seu perfil de profissional não foi configurado por um Admin.</h2>;
  }

  // 8. O Formulário (JSX)
  return (
    <div>
      <h3>Meu Horário de Trabalho</h3>
      <p>Ajuste seus dias e horários de atendimento.</p>
      
      {workingHours.map((day) => (
        <div key={day.id} style={{ padding: '10px', border: '1px solid #ddd', margin: '5px' }}>
          <h4>{day.day}</h4>
          <input 
            type="checkbox"
            id={`check-${day.id}`}
            checked={day.isWorking}
            onChange={(e) => handleTimeChange(day.id, 'isWorking', e.target.checked)}
          />
          <label htmlFor={`check-${day.id}`}>Trabalha este dia?</label>
          
          {day.isWorking && (
            <div style={{ display: 'inline-block', marginLeft: '20px' }}>
              <label>De: </label>
              <input 
                type="time"
                value={day.startTime}
                onChange={(e) => handleTimeChange(day.id, 'startTime', e.target.value)}
              />
              <label> Até: </label>
              <input 
                type="time"
                value={day.endTime}
                onChange={(e) => handleTimeChange(day.id, 'endTime', e.target.value)}
              />
            </div>
          )}
          
          <button onClick={() => handleSaveDay(day.id)} style={{ marginLeft: '20px' }}>
            Salvar {day.day}
          </button>
        </div>
      ))}
    </div>
  );
}

export default ProfessionalPanel;