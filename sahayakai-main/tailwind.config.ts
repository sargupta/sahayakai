
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  // Scan ALL of src/. The old list (pages/components/app only) silently
  // dropped every class written elsewhere (src/features, src/data,
  // src/types, ...) from the shipped CSS: GeneratorPage spinner and sticky
  // mobile CTA, instant-answer prose-lg, quick-template colours. Tests and
  // mocks are excluded: they only repeat classes from the code they test.
  // Gate: src/__tests__/design/tailwind-content-coverage.test.ts.
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '!./src/**/__tests__/**',
    '!./src/**/__mocks__/**',
    '!./src/**/*.test.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Phase 0 (2026-07-03): all families are SELF-HOSTED via next/font
        // in src/app/layout.tsx and exposed as CSS custom properties on
        // <html>. Indic script families listed after Inter/Outfit so the
        // browser picks the right glyphs per Unicode block automatically
        // (browsers fetch a family's woff2 lazily, only when text uses it).
        // Order matters: Inter/Outfit first so Latin characters still use
        // them when mixed with Indic script (code-switching Hinglish).
        body: [
          'var(--font-ui)',
          'var(--font-noto-devanagari)',
          'var(--font-noto-tamil)',
          'var(--font-noto-kannada)',
          'var(--font-noto-telugu)',
          'var(--font-noto-bengali)',
          'var(--font-noto-gujarati)',
          'var(--font-noto-gurmukhi)',
          'var(--font-noto-malayalam)',
          'var(--font-noto-oriya)',
          'sans-serif',
        ],
        headline: [
          'var(--font-display)',
          'var(--font-noto-devanagari)',
          'var(--font-noto-tamil)',
          'var(--font-noto-kannada)',
          'var(--font-noto-telugu)',
          'var(--font-noto-bengali)',
          'var(--font-noto-gujarati)',
          'var(--font-noto-gurmukhi)',
          'var(--font-noto-malayalam)',
          'var(--font-noto-oriya)',
          'sans-serif',
        ],
        // Design system aliases: font-display / font-ui.
        display: [
          'var(--font-display)',
          'var(--font-noto-devanagari)',
          'var(--font-noto-tamil)',
          'var(--font-noto-kannada)',
          'var(--font-noto-telugu)',
          'var(--font-noto-bengali)',
          'var(--font-noto-gujarati)',
          'var(--font-noto-gurmukhi)',
          'var(--font-noto-malayalam)',
          'var(--font-noto-oriya)',
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
        // Saffron scale — same hue as --primary but across the lightness
        // spectrum. Used by the landing page (hero CTAs, pillar-strip active
        // card, animated-headline). DEFAULT and 500 both map to --primary so
        // `bg-saffron` stays consistent with `bg-primary` elsewhere in the app.
        saffron: {
          DEFAULT: 'hsl(var(--saffron-500))',
          50: 'hsl(var(--saffron-50))',
          100: 'hsl(var(--saffron-100))',
          200: 'hsl(var(--saffron-200))',
          300: 'hsl(var(--saffron-300))',
          400: 'hsl(var(--saffron-400))',
          500: 'hsl(var(--saffron-500))',
          600: 'hsl(var(--saffron-600))',
          700: 'hsl(var(--saffron-700))',
          800: 'hsl(var(--saffron-800))',
        },
        // Design-system families (Oct 2026). Names match the system's
        // tokens: --milk-200 is bg-milk-200, --ink-900 is text-ink-900.
        milk: {
          50: 'hsl(var(--milk-50))',
          100: 'hsl(var(--milk-100))',
          200: 'hsl(var(--milk-200))',
          300: 'hsl(var(--milk-300))',
          400: 'hsl(var(--milk-400))',
          500: 'hsl(var(--milk-500))',
        },
        ink: {
          400: 'hsl(var(--ink-400))',
          500: 'hsl(var(--ink-500))',
          600: 'hsl(var(--ink-600))',
          800: 'hsl(var(--ink-800))',
          900: 'hsl(var(--ink-900))',
        },
        stone: {
          100: 'hsl(var(--stone-100))',
          500: 'hsl(var(--stone-500))',
        },
        leaf: {
          100: 'hsl(var(--leaf-100))',
          300: 'hsl(var(--leaf-300))',
          500: 'hsl(var(--leaf-500))',
          700: 'hsl(var(--leaf-700))',
        },
        indigo: {
          100: 'hsl(var(--indigo-100))',
          500: 'hsl(var(--indigo-500))',
        },
        surface: {
          glass: 'var(--surface-glass)',
          'glass-soft': 'var(--surface-glass-soft)',
          'glass-strong': 'var(--surface-glass-strong)',
          chrome: 'var(--surface-chrome)',
          capsule: 'var(--surface-capsule)',
          float: 'var(--surface-float)',
          segment: 'var(--surface-segment)',
        },
        line: {
          glass: 'var(--border-glass)',
          hairline: 'var(--border-hairline)',
          row: 'var(--border-row)',
          control: 'var(--border-control)',
        },
        tint: {
          accent: 'var(--accent-tint)',
          'accent-strong': 'var(--accent-tint-strong)',
          'accent-border': 'var(--accent-tint-border)',
          'accent-soft': 'var(--accent-tint-soft)',
          success: 'var(--success-tint)',
          'success-border': 'var(--leaf-tint-border)',
          info: 'var(--info-tint)',
          'info-border': 'var(--info-tint-border)',
          danger: 'var(--red-tint)',
          warning: 'var(--amber-tint)',
          quiet: 'var(--fill-quiet)',
          subtle: 'var(--fill-subtle)',
          mark: 'var(--fill-mark)',
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
        // Status tokens (Gate 11 prereq): success/warning/info give status
        // UI a tokenised alternative to raw green/amber/blue palette
        // classes, which the widened Gate 11 now bans.
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
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
        glow: '0 0 0 3px hsl(24 65% 47% / 0.12), 0 4px 12px -2px rgb(0 0 0 / 0.08)',
        'inner-soft': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)',
        // Phase 1 (2026-04-24): floating shadow for modals/sheets/menus
        floating: 'var(--shadow-floating)',
        // Design system (Oct 2026): warm, low, rare.
        float: 'var(--shadow-float)',
        card: 'var(--shadow-card)',
        cta: 'var(--shadow-cta)',
        orb: 'var(--shadow-orb)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Phase 1 (2026-04-24): namespaced surface radii — write
        // `rounded-surface-md`, `rounded-surface-lg`, `rounded-pill`.
        // Existing `rounded-lg/md/sm` left untouched for back-compat.
        'surface-sm': 'var(--radius-sm)',
        'surface-md': 'var(--radius-md)',
        'surface-lg': 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
        // Design system container radii: they step up as containers grow.
        xs: '6px',
        mark: '8px',
        row: '12px',
        field: '14px',
        tile: '16px',
        card: '18px',
        panel: '20px',
        sheet: '26px',
        'web-metric': '24px',
        band: '36px',
      },
      transitionTimingFunction: {
        // Phase 1 (2026-04-24): single canonical easing curve
        'out-quart': 'cubic-bezier(0.16, 1, 0.3, 1)',
        // Design system: one curve, gentle and never bouncy.
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      // Design-system type scale (Oct 2026). App sizes never go under 12px.
      fontSize: {
        brand: ['17px', { lineHeight: '1' }],
        tile: ['13px', { lineHeight: '1.3' }],
        value: ['14px', { lineHeight: '1.3' }],
        'card-title': ['15px', { lineHeight: '1.3' }],
        'output-title': ['20px', { lineHeight: '1.22' }],
        'page-title': ['22px', { lineHeight: '1.2' }],
        metric: ['26px', { lineHeight: '1.05' }],
        'web-body': ['14px', { lineHeight: '1.6' }],
        'web-lead': ['18px', { lineHeight: '1.62' }],
        'web-h3': ['21px', { lineHeight: '1.2' }],
        'web-h2': ['clamp(30px, 4vw, 44px)', { lineHeight: '1.06' }],
        'web-h1': ['clamp(40px, 6vw, 68px)', { lineHeight: '1.02' }],
      },
      maxWidth: {
        web: '1220px',
      },
      width: {
        sidebar: 'var(--sidebar-w)',
        rail: 'var(--sidebar-w-rail)',
      },
      height: {
        topbar: 'var(--topbar-h)',
      },
      transitionDuration: {
        // Phase 1 (2026-04-24): durations match --motion-* CSS vars
        micro: '150ms',
        small: '250ms',
        medium: '350ms',
        // Design system: .4s for sheets, cards and panel widths.
        sheet: '400ms',
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
