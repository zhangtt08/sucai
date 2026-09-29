/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        night: 'var(--canvas)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        'surface-muted': 'var(--surface-muted)',
        structure: 'var(--structure)',
        'structure-dark': 'var(--structure)',
      },
    },
  },
  plugins: [],
};
