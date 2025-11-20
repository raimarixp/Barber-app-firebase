// src/components/Layout/Layout.jsx
// Layout principal que engloba a aplicação com o tema Premium Dark

import { LogOut, Scissors, User, Menu } from 'lucide-react';

/**
 * Layout Component
 * @param {Object} props
 * @param {React.ReactNode} props.children - O conteúdo da página (paineis, chats, etc)
 * @param {Object} props.user - Objeto do usuário do Firebase Auth (currentUser)
 * @param {Object} props.userData - Dados do Firestore (incluindo role)
 * @param {Function} props.onLogout - Função para deslogar
 */
const Layout = ({ children, user, userData, onLogout }) => {
  
  // Helper para formatar a Role para exibição
  const getRoleLabel = (role) => {
    switch(role) {
      case 'admin': return 'Proprietário';
      case 'professional': return 'Profissional';
      case 'client': return 'Cliente';
      default: return 'Visitante';
    }
  };

  return (
    <div className="min-h-screen bg-grafite-main text-text-primary font-sans selection:bg-gold-main selection:text-grafite-main flex flex-col">
      
      {/* --- HEADER --- */}
      <header className="border-b border-grafite-border bg-grafite-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 group cursor-default">
            <div className="w-10 h-10 bg-gold-main rounded-xl flex items-center justify-center text-grafite-main shadow-glow group-hover:scale-105 transition-transform duration-300">
              <Scissors size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h1 className="font-heading font-bold text-xl tracking-wide text-white leading-none">
                Barber<span className="text-gold-main">App</span>
              </h1>
              <span className="text-[10px] text-text-secondary uppercase tracking-[0.2em] mt-1">Premium Style</span>
            </div>
          </div>

          {/* User Info & Actions (Só mostra se estiver logado) */}
          {user && userData ? (
            <div className="flex items-center gap-6">
              
              {/* Info do Usuário (Desktop) */}
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-medium text-text-primary">
                  {userData.displayName || user.email.split('@')[0]}
                </span>
                <span className="text-[10px] font-bold text-gold-main uppercase tracking-wider border border-gold-main/20 px-2 py-0.5 rounded-full bg-gold-dim/5">
                  {getRoleLabel(userData.role)}
                </span>
              </div>

              {/* Divisor Vertical */}
              <div className="h-8 w-[1px] bg-grafite-border hidden md:block"></div>

              {/* Botão Sair */}
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-text-secondary hover:text-red-400 transition-all duration-300 p-2 rounded-lg hover:bg-grafite-surface group"
                title="Sair da conta"
              >
                <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden md:inline text-sm font-medium">Sair</span>
              </button>
            </div>
          ) : (
            /* Caso não esteja logado (opcional, ex: link para suporte) */
            <div className="hidden md:block text-sm text-text-secondary">
              Bem-vindo ao novo padrão.
            </div>
          )}
        </div>
      </header>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      {/* flex-grow garante que o footer fique lá embaixo se o conteúdo for curto.
          animate-fade-in dá uma entrada suave na página.
      */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-grafite-border bg-grafite-main py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-text-secondary text-sm">
          <p>&copy; {new Date().getFullYear()} Barber App SaaS.</p>
          <div className="flex gap-6">
            <span className="hover:text-gold-main cursor-pointer transition-colors">Termos</span>
            <span className="hover:text-gold-main cursor-pointer transition-colors">Privacidade</span>
            <span className="hover:text-gold-main cursor-pointer transition-colors">Suporte</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Layout;