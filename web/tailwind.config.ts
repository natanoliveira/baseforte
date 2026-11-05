import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: c('paper'), card: c('card'), ink: c('ink'), mut: c('mut'), soft: c('soft'),
        brand: { DEFAULT: c('brand'), dark: c('brand'), ink: c('brand-ink') },
        accent: c('accent'), ok: c('ok'), cold: c('cold'), off: c('off'), danger: c('danger'), sb: c('sb'),
      },
      borderColor: { DEFAULT: c('line') },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
} satisfies Config;
