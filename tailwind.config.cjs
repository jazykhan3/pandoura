/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panda: {
          orange: '#FF6A00',
          'orange-dark': '#E55A00',
          'orange-light': '#FF8533',
          surface: '#F9FAFB',
          'surface-dark': '#1A1A1A',
          text: '#1A1A1A',
          'text-dark': '#F9FAFB',
          border: '#E5E7EB',
          'border-dark': '#374151',
          'bg-secondary': '#F3F4F6',
          'bg-secondary-dark': '#111827',
          'card-dark': '#1F2937',
          'hover-dark': '#374151',
        },
        accent: {
          DEFAULT: 'var(--accent-color)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          dark: 'var(--accent-dark)',
          subtle: 'var(--accent-subtle)',
          muted: 'var(--accent-muted)',
        },
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.06)',
        'soft-dark': '0 2px 8px rgba(0,0,0,0.3)',
      },
      borderRadius: {
        md: '8px',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
      },
    },
  },
  plugins: [],
}

