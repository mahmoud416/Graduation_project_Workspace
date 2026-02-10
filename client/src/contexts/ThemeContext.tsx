import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext, type ResolvedTheme, type Theme } from './ThemeContextDefinition';

const THEME_STORAGE_KEY = 'theme';

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const readStoredTheme = (): Theme => {
    if (!isBrowser()) {
        return 'light';
    }
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'system' || saved === 'light') {
        return saved as Theme;
    }
    return 'light';
};

const resolveTheme = (theme: Theme, prefersDark: boolean): ResolvedTheme => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return prefersDark ? 'dark' : 'light';
};

const applyThemeToDocument = (theme: Theme, prefersDark: boolean) => {
    if (!isBrowser()) {
        return 'light';
    }

    const resolved = resolveTheme(theme, prefersDark);
    const useDark = resolved === 'dark';
    const targets = [document.documentElement, document.body].filter(Boolean) as HTMLElement[];

    targets.forEach((node) => {
        node.classList.toggle('dark', useDark);
        node.dataset.theme = resolved;
        node.dataset.mode = theme;
    });

    return resolved;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
    const prefersDark = useMemo(() => (isBrowser() ? window.matchMedia('(prefers-color-scheme: dark)').matches : false), []);
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredTheme(), prefersDark));

    useEffect(() => {
        if (!isBrowser()) {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const update = (matches: boolean) => {
            const nextResolved = applyThemeToDocument(theme, matches);
            setResolvedTheme(nextResolved);
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        };

        update(mediaQuery.matches);

        if (theme !== 'system') {
            return;
        }

        const handler = (event: MediaQueryListEvent) => update(event.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, isDark: resolvedTheme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};
