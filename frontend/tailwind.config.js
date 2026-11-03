export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "steel" is the platform accent: phosphor green, matching the
        // terminal theme declared with --neon in index.css.
        ink: { 950: '#06080a', 900: '#0b0f12', 800: '#10161a', 700: '#1c2430', 600: '#2a3540', 500: '#38424d' },
        fog: { 100: '#e8ecef', 300: '#b8c2ca', 500: '#7d8a94' },
        steel: { 400: '#00e59b', 500: '#00c87c' },
        vuln: { 400: '#ff4d5e', 900: '#2b0f13' },
        safe: { 400: '#4ade80', 900: '#0b2318' },
        warn: { 400: '#ffc857' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
