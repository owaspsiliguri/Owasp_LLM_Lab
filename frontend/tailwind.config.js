/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#05090d', 900: '#0b1b33', 800: '#12294a', 700: '#1b3a63' },
        // The accent keeps the original phosphor-green terminal identity.
        brand: {
          50: '#071a14', 100: '#0a241b', 200: '#1c5a3c', 300: '#2e8f68',
          400: '#5cffc4', 500: '#00e59b', 600: '#00c87c', 700: '#5cffc4', 800: '#8affd9',
        },
        mist: '#06080a',
        line: '#1c2430',
        ink: {
          DEFAULT: '#e8ecef', 950: '#06080a', 900: '#0b0f12', 800: '#10161a',
          700: '#1c2430', 600: '#2a3540', 500: '#38424d',
        },
        // Neutral scale is inverted for the dark-only interface, so surface,
        // border and text utilities keep their intended contrast everywhere.
        slate: {
          50: '#10161a', 100: '#17212b', 200: '#1c2430', 300: '#2a3540', 400: '#7d8a94',
          500: '#97a3b0', 600: '#b8c2ca', 700: '#cfd8e3', 800: '#e8ecef', 900: '#f8fafc', 950: '#06080a',
        },
        emerald: { 50: '#0b2318', 100: '#0f2e20', 200: '#1c5a3c', 700: '#4ade80', 800: '#86efac', 900: '#bbf7d0' },
        red: { 50: '#2b0f13', 100: '#3a141a', 200: '#6b2029', 600: '#f87171', 700: '#ff8a95', 800: '#ffb3ba', 900: '#ffd0d5' },
        amber: { 50: '#2a1f0a', 100: '#3a2a0c', 200: '#6b4a12', 600: '#fbbf24', 700: '#ffc857', 800: '#ffd88a', 900: '#ffe9b8' },
        fog: { 100: '#e8ecef', 200: '#cfd8e3', 300: '#b8c2ca', 400: '#97a3b0', 500: '#7d8a94' },
        steel: { 400: '#00e59b', 500: '#00c87c' },
        vuln: { 400: '#ff4d5e', 900: '#2b0f13' },
        safe: { 400: '#4ade80', 900: '#0b2318' },
        warn: { 400: '#ffc857' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        card: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 12px 32px -22px rgba(0,0,0,0.95)',
        'card-hover': 'inset 0 1px 0 rgba(255,255,255,0.03), 0 18px 42px -22px rgba(0,0,0,1)',
        drawer: '0 24px 48px -12px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        'toast-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out both',
        'slide-in': 'slide-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-in': 'toast-in 180ms ease-out both',
      },
    },
  },
  plugins: [],
}
