import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#6366F1',   // Indigo-500 — primary accent
          dark: '#4F46E5',      // Indigo-600 — hover/active
          light: '#EEF2FF',     // Indigo-50 — subtle backgrounds
          muted: '#C7D2FE',     // Indigo-200 — tags, badges
          coral: '#F87171',
          'coral-dark': '#DC2626',
          gold: '#F59E0B',
        },
        page: '#FAFAFA',        // Warm off-white
        card: '#FFFFFF',
        muted: '#F4F4F5',       // Zinc-100
        primary: '#09090B',     // Zinc-950 — near black
        secondary: '#52525B',   // Zinc-600
        tertiary: '#A1A1AA',    // Zinc-400
        'border-subtle': '#E4E4E7', // Zinc-200
        'border-strong': '#D4D4D8', // Zinc-300
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
        modal: '12px',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.1)',
        modal: '0 4px 6px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
