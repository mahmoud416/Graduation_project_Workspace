import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        space: { dark: '#05050d', darker: '#080812' },
        orbit: {
          blue: '#1a6fff',
          blue2: '#00aaff',
          purple: '#8b5cf6',
          green: '#10b981',
          amber: '#f59e0b',
          cyan: '#06b6d4',
          red: '#ef4444',
        },
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      animation: {
        'orbit-8':   'hub-orbit 8s linear infinite',
        'orbit-14':  'hub-orbit 14s linear infinite',
        'orbit-20':  'hub-orbit 20s linear infinite',
        'orbit-28':  'hub-orbit 28s linear infinite',
        'orbit-14r': 'hub-orbit 14s linear infinite reverse',
        'orbit-20r': 'hub-orbit 20s linear infinite reverse',
        'orbit-28r': 'hub-orbit 28s linear infinite reverse',
        float:       'float 6s ease-in-out infinite',
        'pulse-glow':'pulse-glow 3s ease-in-out infinite',
        'blink-cur': 'blink 0.8s step-end infinite',
        shimmer:     'shimmer 2s linear infinite',
      },
      keyframes: {
        'hub-orbit': {
          to: { transform: 'translate(-50%,-50%) rotate(360deg)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        'pulse-glow': {
          '0%,100%': { boxShadow: '0 0 20px rgba(26,111,255,.3)' },
          '50%':     { boxShadow: '0 0 60px rgba(26,111,255,.6)' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-blue':    '0 0 40px rgba(26,111,255,.25)',
        'glow-blue-lg': '0 0 80px rgba(26,111,255,.4)',
        'glow-purple':  '0 0 30px rgba(139,92,246,.3)',
        'glow-green':   '0 0 30px rgba(16,185,129,.3)',
        'glow-amber':   '0 0 30px rgba(245,158,11,.3)',
        'glow-cyan':    '0 0 30px rgba(6,182,212,.3)',
        card:           '0 8px 32px rgba(0,0,0,.35)',
      },
    },
  },
  plugins: [],
};

export default config;
