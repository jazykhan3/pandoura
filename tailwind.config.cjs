/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        panda: {
          orange: '#FF6A00',
          surface: '#F9FAFB',
          text: '#1A1A1A',
          border: '#E5E7EB',
        },
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.06)',
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

