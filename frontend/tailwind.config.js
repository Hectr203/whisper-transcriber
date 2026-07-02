/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Permitir dark mode por clase
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        secondary: {
          50: 'var(--secondary-50)',
          100: 'var(--secondary-100)',
          200: 'var(--secondary-200)',
          500: 'var(--secondary-500)',
          800: 'var(--secondary-800)',
          900: 'var(--secondary-900)',
        },
        tertiary: {
          50: 'var(--tertiary-50)',
          100: 'var(--tertiary-100)',
          500: 'var(--tertiary-500)',
          600: 'var(--tertiary-600)',
        },
        accent: {
          orange: 'var(--accent-orange)',
          yellow: 'var(--accent-yellow)',
        },
        surface: {
          light: 'var(--surface-light)',
          dark: 'var(--surface-dark)',
        },
        background: {
          light: 'var(--bg-light)',
          dark: 'var(--bg-dark)',
        },
        textMain: {
          light: '#0f172a',
          dark: '#f1f5f9',
        },
        textMuted: {
          light: '#64748b',
          dark: '#94a3b8',
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 15px rgba(37, 99, 235, 0.3)', // primary glow
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
