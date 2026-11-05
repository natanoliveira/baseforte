import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: '#14805a', dark: '#0b4d37', soft: '#e6f5ee' } },
    },
  },
} satisfies Config;
