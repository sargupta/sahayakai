
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Indic script families listed after Inter so the browser picks
        // the right glyphs per Unicode block automatically. Noto Sans
        // families are loaded on-demand by LanguageContext when the user
        // picks a non-English language; English-only sessions never fetch
        // them. Order matters: Inter first so Latin characters still use
        // it when mixed with Indic script (code-switching Hinglish).
        body: [
          '"Inter"',
          '"Noto Sans Devanagari"',
          '"Noto Sans Tamil"',
          '"Noto Sans Kannada"',
          '"Noto Sans Telugu"',
          '"Noto Sans Bengali"',
          '"Noto Sans Gujarati"',
          '"Noto Sans Gurmukhi"',
          '"Noto Sans Malayalam"',
          '"Noto Sans Oriya"',
          'sans-serif',
        ],
        headline: [
          '"Outfit"',
          '"Noto Sans Devanagari"',
          '"Noto Sans Tamil"',
          '"Noto Sans Kannada"',
          '"Noto Sans Telugu"',
          '"Noto Sans Bengali"',
          '"Noto Sans Gujarati"',
          '"Noto Sans Gurmukhi"',
          '"Noto Sans Malayalam"',
          '"Noto Sans Oriya"',
          'sans-serif',
        ],
        code: ['monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.03)',
        elevated: '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        glow: '0 0 0 3px hsl(28 70% 59% / 0.12), 0 4px 12px -2px rgb(0 0 0 / 0.08)',
        'inner-soft': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
      },
      typography: ({ theme }: { theme: any }) => ({
        DEFAULT: {
          css: {
            'p': {
              marginTop: theme('spacing.4'),
              marginBottom: theme('spacing.4'),
            },
            'li': {
              marginTop: theme('spacing.2'),
              marginBottom: theme('spacing.2'),
            },
            'h1,h2,h3': {
              fontFamily: theme('fontFamily.headline').join(','),
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
  ],
} satisfies Config;
