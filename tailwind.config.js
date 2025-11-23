/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      colors: {
        grafite: {
          main: '#1A1A1A',      
          card: '#1C1C1C',      
          surface: '#222222',   
          border: '#2a2a2a',    
          borderLight: '#3a3a3a',
        },
        gold: {
          // MUDANÇA: Agora usa variáveis CSS para permitir troca dinâmica
          main: 'var(--brand-primary)',      
          hover: 'var(--brand-hover)',     
          dim: 'var(--brand-dim)', 
        },
        text: {
          primary: '#F5F5F5',   
          secondary: '#BDBDBD', 
        }
      },
      boxShadow: {
        'premium': '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 15px var(--brand-dim)', // Glow também será dinâmico
      },
      letterSpacing: {
        premium: '0.25px',
      }
    },
  },
  plugins: [],
}