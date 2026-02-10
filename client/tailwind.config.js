/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    // darkMode: 'class', // Removed in favor of CSS @variant in index.css
    theme: {
        extend: {
            colors: {
                primary: '#1D7BF4',
                background: '#F8F9FB',
                'text-dark': '#1A1A1A',
                'text-gray': '#6B7280',
                success: '#10B981',
                warning: '#F59E0B',
                danger: '#EF4444',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
            boxShadow: {
                'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
        },
    },
    plugins: [],
}
