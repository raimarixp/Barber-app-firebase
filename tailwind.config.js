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
          main: '#1A1A1A',      // Fundo principal
          card: '#1C1C1C',      // Superfícies
          surface: '#222222',   // Hover/Cards secundários
          border: '#2a2a2a',    // Bordas sutis
          borderLight: '#3a3a3a',
        },
        gold: {
          main: '#D4AF37',      // Destaque principal
          hover: '#C8A233',     // Hover dourado
          dim: 'rgba(212, 175, 55, 0.1)', // Para fundos de input com foco
        },
        text: {
          primary: '#F5F5F5',   // Branco suave
          secondary: '#BDBDBD', // Cinza texto
        }
      },
      boxShadow: {
        'premium': '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 15px rgba(212, 175, 55, 0.15)', // Brilho dourado sutil
      },
      letterSpacing: {
        premium: '0.25px',
      }
    },
  },
  plugins: [],
}