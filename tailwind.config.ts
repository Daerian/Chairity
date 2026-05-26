import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // All gold-* shades are CSS variables — swapping the variables changes the whole theme
        gold: {
          50:  'rgb(var(--gold-50)  / <alpha-value>)',
          100: 'rgb(var(--gold-100) / <alpha-value>)',
          200: 'rgb(var(--gold-200) / <alpha-value>)',
          300: 'rgb(var(--gold-300) / <alpha-value>)',
          400: 'rgb(var(--gold-400) / <alpha-value>)',
          500: 'rgb(var(--gold-500) / <alpha-value>)',
          600: 'rgb(var(--gold-600) / <alpha-value>)',
          700: 'rgb(var(--gold-700) / <alpha-value>)',
          800: 'rgb(var(--gold-800) / <alpha-value>)',
          900: 'rgb(var(--gold-900) / <alpha-value>)',
        },
        event: {
          bg:      'rgb(var(--event-bg)      / <alpha-value>)',
          surface: 'rgb(var(--event-surface) / <alpha-value>)',
          border:  'rgb(var(--event-border)  / <alpha-value>)',
          muted:   'rgb(var(--event-muted)   / <alpha-value>)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card:         'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
    },
  },
  plugins: [],
}
export default config
