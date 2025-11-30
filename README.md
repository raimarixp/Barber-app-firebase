# Barber App - Plataforma de Agendamento Multi-loja (SaaS)

Uma plataforma completa para barbearias, permitindo gestão de serviços, profissionais e agendamentos online com pagamentos integrados, agora com recursos sociais e de fidelização.

## 🚀 Funcionalidades

### 🏢 Para Donos de Barbearia (Admin)
- **Cadastro de Loja:** Crie sua barbearia na plataforma (Whitelabel/Subdomínio).
- **Gestão de Perfil:** Edite nome, endereço, descrição, cores da marca e logo.
- **Gestão de Serviços & Produtos:** Adicione serviços e produtos para venda (upsell).
- **Gestão de Equipe:** Convide profissionais por e-mail e gerencie permissões.
- **Pagamentos:** Configure chaves do Mercado Pago para receber pagamentos online.

### ✂️ Para Profissionais (Barbeiros)
- **Agenda Inteligente:** Navegação por dias, visualização mensal e indicadores de ocupação.
- **Feed BarberTok:** Publique fotos e vídeos dos seus cortes para atrair clientes.
- **Perfil Profissional:** Gerencie sua foto de perfil, biografia e veja sua nota média.
- **Métricas de Performance:** Acompanhe faturamento, comissão, total de atendimentos e sua avaliação (estrelas).
- **Preferências do Cliente:** Veja antecipadamente se o cliente prefere conversar ("Papo"), silêncio ("Zen") ou quer sugestões.

### 📅 Para Clientes
- **App Experience:** Navegação fluida com barra inferior (Dock) estilo app mobile.
- **BarberTok (Feed):** Descubra cortes através de vídeos/fotos e agende diretamente pelo post.
- **Agendamento Personalizado (Modo Zen):** Escolha o serviço, profissional e defina sua "vibe" (Conversa, Silêncio ou Sugestão).
- **Avaliação:** Avalie o atendimento (1 a 5 estrelas) após a conclusão.
- **Gestão de Perfil:** Atualize sua foto e dados de contato.
- **Pagamento Online:** Pague via PIX ou Cartão para confirmar.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end:** React.js (Vite)
- **UI/UX:** Tailwind CSS, Lucide Icons, React Calendar (Customizado).
- **Back-end (BaaS):** Firebase (Firestore, Authentication, Storage, Cloud Functions).
- **Pagamentos:** Mercado Pago SDK.
- **Mídia:** Cloudinary (Upload e otimização de imagens/vídeos).
- **Notificações:** Sonner (Toasts).

---

## ⚙️ Como Rodar Localmente

### Pré-requisitos
- Node.js instalado.
- Conta no Firebase (plano Blaze recomendado para Cloud Functions).
- Conta no Cloudinary (para imagens/vídeos).
- Conta no Mercado Pago (Developers).

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/barber-app-firebase.git](https://github.com/seu-usuario/barber-app-firebase.git)
    cd barber-app-firebase
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente:**
    Crie um arquivo `.env` na raiz e adicione suas chaves:
    ```env
    VITE_FIREBASE_API_KEY="seu_api_key"
    VITE_FIREBASE_AUTH_DOMAIN="seu_projeto.firebaseapp.com"
    VITE_FIREBASE_PROJECT_ID="seu_projeto"
    VITE_FIREBASE_STORAGE_BUCKET="seu_projeto.firebasestorage.app"
    VITE_FIREBASE_MESSAGING_SENDER_ID="seu_sender_id"
    VITE_FIREBASE_APP_ID="seu_app_id"

    VITE_CLOUDINARY_CLOUD_NAME="seu_cloud_name"
    VITE_CLOUDINARY_UPLOAD_PRESET="seu_upload_preset"
    ```

4.  **Rode o Servidor de Desenvolvimento:**
    ```bash
    npm run dev
    ```

### Rodando as Cloud Functions (Back-end)

1.  Entre na pasta de funções:
    ```bash
    cd functions
    npm install
    ```
2.  Configure o segredo do Mercado Pago:
    ```bash
    firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
    ```
3.  Faça o deploy (envio para a nuvem) ou rode o emulador:
    ```bash
    firebase deploy --only functions
    ```

---

## 📝 Status do Projeto

- [x] Autenticação (Cliente/Admin/Profissional)
- [x] Banco de Dados Multi-loja (Firestore)
- [x] Regras de Segurança Avançadas
- [x] Upload de Imagens e Vídeos (Cloudinary)
- [x] Motor de Agendamento (Cálculo de Slots)
- [x] Integração de Pagamento (Mercado Pago)
- [x] Feed Social ("BarberTok")
- [x] Preferências do Cliente (Modo Zen)
- [x] Sistema de Avaliação (Rating)
- [x] Métricas de Performance e CRM Básico
- [ ] Notificações Push/Email (Próximo passo)
- [ ] Geolocalização Avançada (Mapa de Barbearias)

---
raimari jr dev 
