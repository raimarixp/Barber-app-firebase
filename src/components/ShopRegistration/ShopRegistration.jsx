// src/components/ShopRegistration/ShopRegistration.jsx
// (Atualizado com CLOUDINARY em vez de Firebase Storage)

import { useState } from 'react';
import styles from './ShopRegistration.module.css'; 
// 1. REMOVEMOS 'storage' daqui
import { db, auth } from '../../firebase/firebase-config'; 
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, writeBatch, collection } from "firebase/firestore";
// 2. REMOVEMOS 'ref', 'uploadBytes', 'getDownloadURL'

function ShopRegistration({ onBack }) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados (sem mudança)
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopCity, setShopCity] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [shopLogoFile, setShopLogoFile] = useState(null);

  const handleLogoChange = (e) => {
    if (e.target.files[0]) {
      setShopLogoFile(e.target.files[0]);
    }
  };

  // --- 3. (NOVA) Função de Upload do Cloudinary ---
  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
    
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.secure_url) {
        return data.secure_url; // Esta é a URL da imagem!
      } else {
        throw new Error(data.error.message || 'Falha no upload do Cloudinary');
      }
    } catch (error) {
      console.error("Erro no upload do Cloudinary:", error);
      throw error; // Repassa o erro para o handleRegister
    }
  };
  // --- Fim da Nova Função ---

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 6) { /* ... (validação de senha) ... */ }
    if (!shopLogoFile) {
      alert("Por favor, selecione uma logo para sua loja.");
      return;
    }
    
    setIsLoading(true);

    try {
      // 1. Criar Auth (sem mudança)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: ownerName });
      
      // --- 4. (MUDANÇA) Fazer Upload da Logo ---
      let logoUrl = '';
      console.log("Enviando logo para o Cloudinary...");
      // Chama nossa nova função de upload
      logoUrl = await uploadImageToCloudinary(shopLogoFile); 
      console.log("Logo enviada, URL:", logoUrl);
      // --- Fim da Mudança ---

      // 5. Preparar Batch do Firestore (sem mudança)
      const batch = writeBatch(db);
      const shopDocRef = doc(collection(db, "barbershops"));
      const normalizedCity = shopCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      batch.set(shopDocRef, {
        name: shopName,
        address: shopAddress,
        cidade: shopCity,
        cidadeQuery: normalizedCity,
        ownerId: user.uid,
        createdAt: new Date(),
        description: shopDescription,
        logoUrl: logoUrl // Salva a URL do Cloudinary
      });
      
      // 6. Preparar 'users' e 'roles' (sem mudança)
      const userDocRef = doc(db, "users", user.uid);
      batch.set(userDocRef, { uid: user.uid, displayName: ownerName, email: user.email });
      const roleDocRef = doc(db, "roles", user.uid); 
      batch.set(roleDocRef, { role: "admin", managingShopId: shopDocRef.id });
      
      // 7. Salvar tudo (sem mudança)
      await batch.commit();
      alert("Barbearia cadastrada com sucesso!");

    } catch (error) {
      console.error("Erro ao cadastrar barbearia: ", error);
      alert("Erro: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- RENDERIZAÇÃO (JSX) ---
  // (O JSX é 100% o mesmo, não mudamos nada visual)
  return (
    <div className={styles.panel}>
      <button onClick={onBack} className={styles.backButton}>
        &larr; Voltar
      </button>
      <h2 className={styles.sectionTitle}>Cadastre sua Barbearia</h2>
      <p>Crie sua conta de Dono e cadastre sua loja na plataforma.</p>
      
      <form onSubmit={handleRegister} className={styles.form}>
        <h4>Seus Dados (Dono)</h4>
        
        <label className={styles.formField} htmlFor="ownerName">
          <span>Seu Nome Completo:</span>
          <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} id="ownerName" name="name" required />
        </label>
        
        <label className={styles.formField} htmlFor="ownerEmail">
          <span>Seu Email de Login:</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} id="ownerEmail" name="email" required />
        </label>
        
        <label className={styles.formField} htmlFor="ownerPassword">
          <span>Sua Senha:</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} id="ownerPassword" name="new-password" required />
        </label>
        
        <hr style={{margin: '10px 0'}}/>
        <h4>Dados da Barbearia</h4>
        
        <label className={styles.formField} htmlFor="shopName">
          <span>Nome da Barbearia:</span>
          <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} id="shopName" name="organization" required />
        </label>
        
        <label className={styles.formField} htmlFor="shopAddress">
          <span>Endereço da Barbearia:</span>
          <input type="text" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} id="shopAddress" name="street-address" required />
        </label>
        
        <label className={styles.formField} htmlFor="shopCity">
          <span>Cidade:</span>
          <input type="text" value={shopCity} onChange={(e) => setShopCity(e.target.value)} id="shopCity" name="city" required />
        </label>
        
        <label className={styles.formField} htmlFor="shopDescription">
          <span>Sobre sua Barbearia (Descrição):</span>
          <textarea
            id="shopDescription" name="shopDescription"
            value={shopDescription} onChange={(e) => setShopDescription(e.target.value)}
            rows="4" required
          />
        </label>
        
        <label className={styles.formField} htmlFor="shopLogo">
          <span>Logo da Barbearia (Arquivo):</span>
          <input 
            type="file" 
            id="shopLogo" name="shopLogo"
            accept="image/png, image/jpeg"
            onChange={handleLogoChange}
            required 
          />
        </label>
        
        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Cadastrando...' : 'Finalizar Cadastro'}
        </button>
      </form>
    </div>
  );
}

export default ShopRegistration;