/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0f14',
          900: '#11161d',
          800: '#171d26',
          700: '#1f2733',
          600: '#2a3340',
          500: '#3a4555',
          400: '#5b6878',
          300: '#8593a6',
          200: '#b5c0cf',
          100: '#dde4ee',
        },
        ember: {
          600: '#c97a2b',
          500: '#e8943a',
          400: '#f0a85c',
          300: '#f6c084',
          200: '#fbd9ab',
        },
        gold: {
          500: '#d4a84a',
          400: '#e3bd6b',
          300: '#ecd190',
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"Source Han Serif"', 'Georgia', 'serif'],
        body: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        latin: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 30px -8px rgba(232, 148, 58, 0.45)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.04)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
        riseIn: 'riseIn 0.6s ease-out both',
        sweep: 'sweep 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
