// src/components/ShopRegistration/ShopRegistration.jsx
// (Corrigido: Acessibilidade e CSS Modules)

import React, { useState } from 'react';
// 1. Importe o CSS Module
import styles from './ShopRegistration.module.css'; 

import { db, auth } from '../../firebase/firebase-config'; // Caminho corrigido
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, writeBatch, collection } from "firebase/firestore";

function ShopRegistration({ onBack }) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados dos formulários
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');

  // Lógica de cadastro (sem mudança)
  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      alert("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setIsLoading(true);
    try {
      // 1. Criar Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: ownerName });
      
      // 2. Criar Batch
      const batch = writeBatch(db);
      
      // 3. Documento 'barbershops'
      const shopDocRef = doc(collection(db, "barbershops")); 
      batch.set(shopDocRef, {
        name: shopName,
        address: shopAddress,
        ownerId: user.uid,
        createdAt: new Date()
      });
      
      // 4. Documento 'users' (público)
      const userDocRef = doc(db, "users", user.uid);
      batch.set(userDocRef, {
        uid: user.uid,
        displayName: ownerName,
        email: user.email
      });

      // 5. Documento 'roles' (privado)
      const roleDocRef = doc(db, "roles", user.uid); 
      batch.set(roleDocRef, {
        role: "admin",
        managingShopId: shopDocRef.id 
      });
      
      // 6. Salvar
      await batch.commit();
      alert("Barbearia cadastrada com sucesso!");

    } catch (error) {
      console.error("Erro ao cadastrar barbearia: ", error);
      alert("Erro: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- RENDERIZAÇÃO (Com correções de acessibilidade) ---
  return (
    <div className={styles.panel}>
      <button onClick={onBack} className={styles.backButton}>
        &larr; Voltar
      </button>
      <h2 className={styles.sectionTitle}>Cadastre sua Barbearia</h2>
      <p>Crie sua conta de Dono e cadastre sua loja na plataforma.</p>
      
      <form onSubmit={handleRegister} className={styles.form}>
        <h4>Seus Dados (Dono)</h4>
        
        {/* Campo 1 */}
        <label className={styles.formField} htmlFor="ownerName">
          <span>Seu Nome Completo:</span>
          <input 
            type="text" 
            value={ownerName} 
            onChange={(e) => setOwnerName(e.target.value)} 
            id="ownerName"
            name="name"
            autoComplete="name"
            required 
          />
        </label>
        
        {/* Campo 2 */}
        <label className={styles.formField} htmlFor="ownerEmail">
          <span>Seu Email de Login:</span>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            id="ownerEmail"
            name="email"
            autoComplete="email"
            required 
          />
        </label>
        
        {/* Campo 3 */}
        <label className={styles.formField} htmlFor="ownerPassword">
          <span>Sua Senha:</span>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            id="ownerPassword"
            name="new-password"
            autoComplete="new-password"
            required 
          />
        </label>
        
        <hr style={{margin: '10px 0'}}/>

        <h4>Dados da Barbearia</h4>
        
        {/* Campo 4 */}
        <label className={styles.formField} htmlFor="shopName">
          <span>Nome da Barbearia:</span>
          <input 
            type="text" 
            value={shopName} 
            onChange={(e) => setShopName(e.target.value)} 
            id="shopName"
            name="organization"
            required 
          />
        </label>
        
        {/* Campo 5 */}
        <label className={styles.formField} htmlFor="shopAddress">
          <span>Endereço da Barbearia:</span>
          <input 
            type="text" 
            value={shopAddress} 
            onChange={(e) => setShopAddress(e.target.value)} 
            id="shopAddress"
            name="street-address"
            placeholder="Ex: Rua X, 123, Bairro, Cidade" 
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