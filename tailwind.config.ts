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
        gold: {
          50:  '#fdfaf0',
          100: '#faf3d8',
          200: '#f5e4ad',
          300: '#edce78',
          400: '#e3b445',
          500: '#d49a22',
          600: '#b87d18',
          700: '#965e16',
          800: '#7a4b17',
          900: '#633e18',
        },
        event: {
          bg:      '#faf7f2',
          surface: '#ffffff',
          border:  '#e8d9b8',
          muted:   '#8c7b68',
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card:       '0 2px 12px 0 rgba(180,140,60,0.10)',
        'card-hover': '0 4px 20px 0 rgba(180,140,60,0.18)',
      },
    },
  },
  plugins: [],
}
export default config
