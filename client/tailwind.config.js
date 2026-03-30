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
                'on-surface': '#dae2fd',
                'on-surface-variant': '#c2c6d6',
                outline: '#8c909f',
                'outline-variant': '#424754',
            },
            backdropBlur: {
                '2xl': '40px',
                '3xl': '60px',
            },
            boxShadow: {
                'orange-glow': '0 0 25px 5px rgba(249, 115, 22, 0.4)',
                'amber-soft': '0 0 15px 2px rgba(251, 191, 36, 0.15)',
                'inner-glass': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4)',
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
