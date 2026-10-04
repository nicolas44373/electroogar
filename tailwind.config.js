/** @type {import('tailwindcss').Config} */

// Los valores reales viven en app/globals.css (variables CSS, con modo oscuro)
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

const estado = (name) => ({
  DEFAULT: token(name),
  soft: token(`${name}-soft`),
  text: token(`${name}-text`),
})

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: token('primary'), hover: token('primary-hover') },
        'on-primary': token('on-primary'),
        accent: { DEFAULT: token('accent'), strong: token('accent-strong') },
        'on-accent': token('on-accent'),
        canvas: token('canvas'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        line: token('line'),
        fg: token('fg'),
        muted: token('muted'),
        success: estado('success'),
        warning: estado('warning'),
        danger: estado('danger'),
        info: estado('info'),
        neutral: estado('neutral'),
        reprog: estado('reprog'),
      },
      fontSize: {
        // Escala: 12 / 14 / 16 / 18 / 24 / 32
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['32px', { lineHeight: '40px' }],
        '4xl': ['32px', { lineHeight: '40px' }],
      },
      boxShadow: {
        e1: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.04)',
        e2: '0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
        e3: '0 20px 40px -12px rgb(15 23 42 / 0.25)',
      },
      borderRadius: {
        lg: '8px',
        xl: '12px',
      },
    },
  },
  plugins: [],
};
