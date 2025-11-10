// src/components/ClientPanel.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase-config';
// Importe 'getDocs' (para buscar múltiplos docs) e 'collection'
import { collection, getDocs } from "firebase/firestore"; 

function ClientPanel() {
  // Estado para armazenar a lista de serviços
  const [services, setServices] = useState([]);
  // Estado para sabermos quando os dados estão carregando
  const [isLoading, setIsLoading] = useState(true);

  // useEffect vai rodar UMA VEZ quando o componente carregar (note o '[]' no final)
  useEffect(() => {
    // Criamos uma função 'async' dentro do useEffect
    const fetchServices = async () => {
      try {
        // 1. Aponta para a coleção "services"
        const servicesCollectionRef = collection(db, "services");
        
        // 2. Busca TODOS os documentos da coleção
        const querySnapshot = await getDocs(servicesCollectionRef);
        
        // 3. Mapeia os resultados (docs) para um array de objetos
        // Adicionamos o 'id' do documento aos dados
        const servicesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() // Pega o resto dos dados (name, price, duration)
        }));
        
        setServices(servicesList); // Salva a lista no estado
        console.log("Serviços carregados:", servicesList);

      } catch (error) {
        console.error("Erro ao buscar serviços: ", error);
        alert("Erro ao carregar serviços.");
      } finally {
        setIsLoading(false); // Para de carregar (mesmo se der erro)
      }
    };

    fetchServices(); // Chama a função
  }, []); // '[]' = Rode apenas uma vez

  // Se estiver carregando, mostre uma mensagem
  if (isLoading) {
    return <h2>Carregando serviços...</h2>;
  }

  // Se não estiver carregando, mostre a lista
  return (
    <div>
      <h3>Nossos Serviços</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 4. Faz um 'map' no array de serviços para renderizar cada um */}
        {services.length > 0 ? (
          services.map(service => (
            <div key={service.id} style={{ padding: '10px', border: '1px solid #ddd' }}>
              <h4>{service.name}</h4>
              <p>Preço: R$ {service.price.toFixed(2)}</p>
              <p>Duração: {service.duration} minutos</p>
              {/* O próximo passo será fazer este botão funcionar */}
              <button>Agendar</button>
            </div>
          ))
        ) : (
          <p>Nenhum serviço cadastrado no momento.</p>
        )}
      </div>
    </div>
  );
}

export default ClientPanel;