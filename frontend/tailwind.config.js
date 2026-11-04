/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#071426', 900: '#0b1b33', 800: '#12294a', 700: '#1b3a63' },
        brand: { 50: '#eef3ff', 100: '#dce7ff', 200: '#c3d5ff', 500: '#2e5bea', 600: '#1d4ed8', 700: '#173fae', 800: '#123386' },
        mist: '#f6f8fb',
        line: '#e2e8f0',
        ink: {
          DEFAULT: '#0f172a', 950: '#06080a', 900: '#0b0f12', 800: '#10161a',
          700: '#1c2430', 600: '#2a3540', 500: '#38424d',
        },
        fog: { 100: '#e8ecef', 200: '#cfd8e3', 300: '#b8c2ca', 400: '#97a3b0', 500: '#7d8a94' },
        steel: { 400: '#00e59b', 500: '#00c87c' },
        vuln: { 400: '#dc2626', 900: '#2b0f13' },
        safe: { 400: '#16a34a', 900: '#0b2318' },
        warn: { 400: '#b45309' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -16px rgba(15, 23, 42, 0.18)',
        'card-hover': '0 2px 4px rgba(15, 23, 42, 0.05), 0 18px 36px -20px rgba(15, 23, 42, 0.25)',
        drawer: '0 24px 48px -12px rgba(2, 8, 23, 0.45)',
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
