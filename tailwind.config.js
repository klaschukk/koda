/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        midnight: {
          bg: '#0a0a14',
          surface: '#0e0e1a',
          elevated: '#14141f',
          border: '#1a1a2e',
        },
        cat: {
          code: '#6366f1',
          english: '#22c55e',
          video: '#a855f7',
          sport: '#f97316',
          rest: '#64748b',
          other: '#eab308',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
