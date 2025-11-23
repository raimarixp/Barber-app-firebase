// src/hooks/useShopBranding.jsx
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../firebase/firebase-config';

// Função para converter Hex em RGB com opacidade (para o brilho/dim)
const hexToRgba = (hex, alpha) => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = "0x" + hex[1] + hex[1];
    g = "0x" + hex[2] + hex[2];
    b = "0x" + hex[3] + hex[3];
  } else if (hex.length === 7) {
    r = "0x" + hex[1] + hex[2];
    g = "0x" + hex[3] + hex[4];
    b = "0x" + hex[5] + hex[6];
  }
  return `rgba(${+r}, ${+g}, ${+b}, ${alpha})`;
};

// Ajusta o brilho da cor para o hover
const adjustBrightness = (hex, percent) => {
    // Lógica simplificada ou apenas retorna a mesma cor por segurança
    // Para MVP, retornamos a mesma cor ou uma variação simples se quiser implementar
    return hex; 
}

const useShopBranding = (setViewingShopId) => {
    const [branding, setBranding] = useState({
        isBranded: false,
        shopId: null,
        shopName: 'Barber SaaS',
        loading: true
    });

    useEffect(() => {
        const applyBranding = async () => {
            const hostname = window.location.hostname;
            // Detecta subdomínio (ex: viking.meuapp.com -> viking)
            // Ignora 'www', 'localhost' e IP
            const subdomain = hostname.split('.')[0];
            const isLocal = hostname.includes('localhost') || hostname.includes('127.0.0.1');
            const isMainDomain = subdomain === 'www' || subdomain === 'seuapp' || (isLocal && subdomain === 'localhost');

            if (isMainDomain) {
                // Reseta para o padrão
                document.documentElement.style.setProperty('--brand-primary', '#D4AF37');
                document.documentElement.style.setProperty('--brand-hover', '#C8A233');
                document.documentElement.style.setProperty('--brand-dim', 'rgba(212, 175, 55, 0.1)');
                setBranding({ isBranded: false, shopId: null, shopName: 'Barber SaaS', loading: false });
                if(setViewingShopId) setViewingShopId(null);
                return;
            }

            try {
                // Busca loja pelo subdomínio
                const q = query(collection(db, "barbershops"), where("subdomain", "==", subdomain));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const shopData = snapshot.docs[0].data();
                    const shopId = snapshot.docs[0].id;
                    const primaryColor = shopData.brandPrimaryColor || '#D4AF37';

                    // INJETA AS CORES NO CSS
                    const root = document.documentElement;
                    root.style.setProperty('--brand-primary', primaryColor);
                    root.style.setProperty('--brand-hover', primaryColor); // Pode fazer uma função escurecer depois
                    root.style.setProperty('--brand-dim', hexToRgba(primaryColor, 0.15));

                    setBranding({ 
                        isBranded: true, 
                        shopId: shopId, 
                        shopName: shopData.name, 
                        loading: false 
                    });

                    if(setViewingShopId) setViewingShopId(shopId);
                } else {
                    console.warn("Subdomínio não encontrado:", subdomain);
                    setBranding({ isBranded: false, shopId: null, loading: false });
                }
            } catch (error) {
                console.error("Erro branding:", error);
                setBranding({ isBranded: false, shopId: null, loading: false });
            }
        };

        applyBranding();
    }, [setViewingShopId]);

    return branding;
};

export default useShopBranding;