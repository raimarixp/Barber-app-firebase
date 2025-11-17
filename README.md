# Barber App - Plataforma de Agendamento Multi-loja (SaaS)

Uma plataforma completa para barbearias, permitindo gestão de serviços, profissionais e agendamentos online com pagamentos integrados.

## 🚀 Funcionalidades

### 🏢 Para Donos de Barbearia (Admin)
- **Cadastro de Loja:** Crie sua barbearia na plataforma.
- **Gestão de Perfil:** Edite nome, endereço, descrição e faça upload da logo.
- **Gestão de Serviços:** Adicione e remova serviços (ex: Corte, Barba) com preços e duração.
- **Gestão de Equipe:** Convide profissionais por e-mail e gerencie sua equipe.
- **Pagamentos:** Configure sua conta Mercado Pago (Access Token) para receber pagamentos direto na sua conta.

### ✂️ Para Profissionais (Barbeiros)
- **Gestão de Horários:** Defina seus dias e horários de trabalho.
- **Leque de Serviços:** Escolha quais serviços da loja você realiza.
- **Bloqueios de Agenda:** Adicione pausas recorrentes (almoço) ou bloqueios de dia único.
- **Agenda em Tempo Real:** Visualize seus agendamentos do dia e faça check-in/conclusão de serviços.

### 📅 Para Clientes
- **Catálogo de Barbearias:** Busque barbearias por cidade.
- **Agendamento Inteligente:** Escolha serviço, profissional e veja apenas os horários livres (calculados automaticamente).
- **Pagamento Online:** Pague via PIX ou Cartão (Mercado Pago) para confirmar o agendamento.
- **Meus Agendamentos:** Visualize seus próximos horários.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end:** React.js (Vite)
- **Estilização:** CSS Modules
- **Back-end (BaaS):** Firebase (Firestore, Authentication, Storage, Cloud Functions)
- **Pagamentos:** Mercado Pago SDK (Checkout Pro)
- **Mídia:** Cloudinary (Upload de imagens)

---

## ⚙️ Como Rodar Localmente

### Pré-requisitos
- Node.js instalado.
- Conta no Firebase (plano Blaze para funções de pagamento).
- Conta no Cloudinary (para imagens).
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
3.  Faça o deploy (envio para a nuvem):
    ```bash
    firebase deploy --only functions
    ```

---

## 📝 Status do Projeto

- [x] Autenticação (Cliente/Admin/Profissional)
- [x] Banco de Dados Multi-loja (Firestore)
- [x] Regras de Segurança Avançadas
- [x] Upload de Imagens (Cloudinary)
- [x] Motor de Agendamento (Cálculo de Slots)
- [x] Integração de Pagamento (Mercado Pago)
- [ ] Métricas e Faturamento (Próximo passo)
- [ ] Notificações por E-mail (Próximo passo)

---
Desenvolvido com ❤️ e muita cafeína.