import { useTheme } from '../contexts/useTheme';

interface HeaderProps {
    title: string;
}

const Header = ({ title }: HeaderProps) => {
    const { setTheme, isDark } = useTheme();

    const toggleTheme = () => {
        const nextTheme = isDark ? 'light' : 'dark';
        setTheme(nextTheme);
    };

    return (
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 fixed top-0 left-[240px] right-0 z-10">
            <div className="h-full px-8 flex items-center justify-between">
                <h1 className="text-sm font-medium text-text-dark dark:text-gray-100">{title}</h1>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-text-gray dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                        aria-pressed={isDark}
                        aria-label="Toggle color theme"
                    >
                        {isDark ? (
                            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        )}
                    </button>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search projects..."
                            className="w-[280px] h-9 pl-9 pr-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-text-dark dark:text-gray-200 placeholder:text-text-gray dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <svg
                            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-gray dark:text-gray-400"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Icons */}
                    <button className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <svg className="w-5 h-5 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </button>

                    <button className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <svg className="w-5 h-5 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                    </button>

                    {/* Profile */}
                    <button className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white font-medium text-sm hover:opacity-90 transition-opacity">
                        A
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
