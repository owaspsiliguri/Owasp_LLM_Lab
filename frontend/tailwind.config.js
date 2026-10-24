export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0a12', 900: '#12101b', 800: '#191626', 700: '#272339', 600: '#3a3554' },
        fog: { 100: '#ece9f4', 300: '#b9b4cc', 500: '#7f7999' },
        steel: { 400: '#a78bfa', 500: '#8b5cf6' },
        vuln: { 400: '#fb7185', 900: '#35121c' },
        safe: { 400: '#34d399', 900: '#122b24' },
        warn: { 400: '#fbbf24' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
