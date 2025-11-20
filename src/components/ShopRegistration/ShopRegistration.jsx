// src/components/ShopRegistration/ShopRegistration.jsx
// (COMPLETO - Visual Premium + Cloudinary + Tailwind + Sonner)

import { useState } from 'react';
import { db, auth } from '../../firebase/firebase-config'; 
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, writeBatch, collection } from "firebase/firestore";
import { toast } from 'sonner';
import { 
  Store, User, Mail, Lock, MapPin, FileText, Upload, ArrowLeft, Image as ImageIcon 
} from 'lucide-react';

function ShopRegistration({ onBack }) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopCity, setShopCity] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [shopLogoFile, setShopLogoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); // Estado para preview da imagem

  const handleLogoChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setShopLogoFile(file);
      // Cria URL temporária para preview
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // --- Função de Upload do Cloudinary ---
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
        return data.secure_url;
      } else {
        throw new Error(data.error.message || 'Falha no upload do Cloudinary');
      }
    } catch (error) {
      console.error("Erro no upload do Cloudinary:", error);
      throw error;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.warning("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!shopLogoFile) {
      toast.warning("Por favor, selecione uma logo para sua loja.");
      return;
    }
    
    setIsLoading(true);
    const loadingToast = toast.loading("Criando sua barbearia...");

    try {
      // 1. Criar Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: ownerName });
      
      // 2. Upload da Logo
      toast.loading("Enviando logo...", { id: loadingToast });
      const logoUrl = await uploadImageToCloudinary(shopLogoFile); 
      
      // 3. Preparar Batch do Firestore
      toast.loading("Finalizando cadastro...", { id: loadingToast });
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
        logoUrl: logoUrl,
        onlinePaymentEnabled: false, // Padrão
        requirePayment: false // Padrão
      });
      
      // 4. Preparar 'users' e 'roles'
      const userDocRef = doc(db, "users", user.uid);
      batch.set(userDocRef, { uid: user.uid, displayName: ownerName, email: user.email });
      const roleDocRef = doc(db, "roles", user.uid); 
      batch.set(roleDocRef, { role: "admin", managingShopId: shopDocRef.id });
      
      // 5. Salvar tudo
      await batch.commit();
      
      toast.dismiss(loadingToast);
      toast.success("Barbearia cadastrada com sucesso!");

      // O App.jsx vai detectar a mudança de auth e redirecionar, 
      // mas podemos limpar o form se necessário.

    } catch (error) {
      console.error("Erro ao cadastrar barbearia: ", error);
      toast.dismiss(loadingToast);
      
      if(error.code === 'auth/email-already-in-use') {
        toast.error("Este e-mail já está em uso.");
      } else {
        toast.error("Erro ao cadastrar: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-4 animate-fade-in">
      
      <button onClick={onBack} className="mb-6 flex items-center text-gold-main hover:underline gap-2 text-sm transition-all">
        <ArrowLeft size={16}/> Voltar
      </button>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-heading font-bold text-gold-main mb-2">Cadastre sua Barbearia</h2>
        <p className="text-text-secondary">Junte-se à plataforma e gerencie seu negócio com estilo.</p>
      </div>
      
      <form onSubmit={handleRegister} className="card-premium space-y-8">
        
        {/* --- Seção 1: Dados do Dono --- */}
        <div>
          <h3 className="text-xl font-heading font-semibold text-text-primary mb-4 flex items-center gap-2">
            <User className="text-gold-main" size={20}/>
            Dados do Proprietário
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="ownerName">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text" id="ownerName" 
                  value={ownerName} onChange={(e) => setOwnerName(e.target.value)} 
                  className="input-premium pl-10" placeholder="Seu nome" required 
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="ownerEmail">E-mail de Login</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="email" id="ownerEmail" 
                  value={email} onChange={(e) => setEmail(e.target.value)} 
                  className="input-premium pl-10" placeholder="seu@email.com" required 
                />
              </div>
            </div>
            
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="ownerPassword">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="password" id="ownerPassword" 
                  value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="input-premium pl-10" placeholder="Mínimo 6 caracteres" required 
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-grafite-border" />

        {/* --- Seção 2: Dados da Barbearia --- */}
        <div>
          <h3 className="text-xl font-heading font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Store className="text-gold-main" size={20}/>
            Dados da Barbearia
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopName">Nome da Barbearia</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text" id="shopName" 
                  value={shopName} onChange={(e) => setShopName(e.target.value)} 
                  className="input-premium pl-10" placeholder="Ex: Barbearia Viking" required 
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopCity">Cidade</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text" id="shopCity" 
                  value={shopCity} onChange={(e) => setShopCity(e.target.value)} 
                  className="input-premium pl-10" placeholder="Ex: São Paulo" required 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopAddress">Endereço</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text" id="shopAddress" 
                  value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} 
                  className="input-premium pl-10" placeholder="Rua, Número, Bairro" required 
                />
              </div>
            </div>
            
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-text-secondary ml-1" htmlFor="shopDescription">Descrição</label>
              <div className="relative">
                <FileText className="absolute left-3 top-4 text-text-secondary" size={16} />
                <textarea
                  id="shopDescription" 
                  value={shopDescription} onChange={(e) => setShopDescription(e.target.value)}
                  className="input-premium pl-10 resize-none" 
                  rows="3" 
                  placeholder="Fale um pouco sobre sua história e estilo..."
                  required
                />
              </div>
            </div>

            {/* Upload Customizado */}
            <div className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-text-secondary ml-1">Logo da Barbearia</span>
              <label 
                htmlFor="shopLogo" 
                className={`
                  flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                  ${previewUrl ? 'border-gold-main bg-grafite-main' : 'border-grafite-border bg-grafite-surface hover:bg-grafite-main hover:border-gold-main/50'}
                `}
              >
                {previewUrl ? (
                  <div className="relative w-full h-full p-2 flex items-center justify-center">
                     <img src={previewUrl} alt="Preview" className="h-full object-contain rounded" />
                     <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                        <p className="text-white text-sm font-medium flex items-center gap-2"><Upload size={16}/> Alterar</p>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-8 h-8 mb-2 text-text-secondary" />
                    <p className="text-sm text-text-secondary">
                      <span className="font-semibold text-gold-main">Clique para enviar</span> ou arraste
                    </p>
                    <p className="text-xs text-text-secondary/70">JPG ou PNG (MAX. 2MB)</p>
                  </div>
                )}
                <input 
                  id="shopLogo" 
                  type="file" 
                  className="hidden" 
                  accept="image/png, image/jpeg"
                  onChange={handleLogoChange}
                  required={!previewUrl}
                />
              </label>
            </div>

          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading} 
          className="btn-primary w-full h-12 text-lg shadow-glow mt-6"
        >
          {isLoading ? 'Processando...' : 'Finalizar Cadastro'}
        </button>

      </form>
    </div>
  );
}

export default ShopRegistration;