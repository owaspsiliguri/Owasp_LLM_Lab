export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0d1319', 900: '#121a22', 800: '#19232d', 700: '#243241', 600: '#34475a' },
        fog: { 100: '#e6edf3', 300: '#b4c0cc', 500: '#7d8b99' },
        steel: { 400: '#7fb2e5', 500: '#5a9bd8' },
        vuln: { 400: '#f08a7e', 900: '#3a1d1a' },
        safe: { 400: '#6fd0a0', 900: '#15302a' },
        warn: { 400: '#e7c36b' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
