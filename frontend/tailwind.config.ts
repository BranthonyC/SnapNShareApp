import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          green: '#22C55E',
          'green-dark': '#16A34A',
          'green-light': '#DCFCE7',
          coral: '#F87171',
          'coral-dark': '#DC2626',
          gold: '#F59E0B',
        },
        page: '#F9FAFB',
        card: '#FFFFFF',
        muted: '#F3F4F6',
        primary: '#111827',
        secondary: '#6B7280',
        tertiary: '#9CA3AF',
        'border-subtle': '#E5E7EB',
        'border-strong': '#D1D5DB',
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
