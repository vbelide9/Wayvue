/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['"Playfair Display"', 'serif'],
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                'on-surface': '#2b2620',
                'on-surface-variant': '#6b625a',
                outline: '#b8afa0',
                'outline-variant': '#e8e2d8',
            },
            backdropBlur: {
                '2xl': '40px',
                '3xl': '60px',
            },
            boxShadow: {
                'orange-glow': '0 12px 30px -8px rgba(232, 106, 42, 0.35)',
                'amber-soft': '0 10px 30px -12px rgba(232, 106, 42, 0.18)',
                'soft': '0 12px 40px -12px rgba(60, 44, 24, 0.12)',
                'soft-lg': '0 24px 60px -16px rgba(60, 44, 24, 0.18)',
                'inner-glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
            },
            animation: {
                'glass-shimmer': 'shimmer 10s linear infinite',
            },
            keyframes: {
                shimmer: {
                    '0%': { transform: 'translateX(-5%) translateY(-5%)' },
                    '100%': { transform: 'translateX(5%) translateY(5%)' },
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            }
        }
    },
    plugins: [],
}
