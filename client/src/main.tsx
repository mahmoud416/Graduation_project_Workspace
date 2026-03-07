import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'

// ── Multi-session support ──────────────────────────────────────────────────
// Auth data is stored per browser-tab via sessionStorage so multiple
// accounts can be open simultaneously in different tabs / browser windows.
// Non-auth keys (e.g. "theme") remain in the real localStorage and continue
// to be shared across all tabs as expected.

const AUTH_KEYS = new Set([
  'token', 'userId', 'role',
  'fullName', 'email', 'userName', 'name',
  'jobTitle', 'phone', 'bio',
]);

const _get    = Storage.prototype.getItem;
const _set    = Storage.prototype.setItem;
const _remove = Storage.prototype.removeItem;

const ls = window.localStorage;

(ls as any).getItem = (key: string): string | null =>
  AUTH_KEYS.has(key) ? sessionStorage.getItem(key) : _get.call(ls, key);

(ls as any).setItem = (key: string, value: string): void => {
  if (AUTH_KEYS.has(key)) sessionStorage.setItem(key, value);
  else _set.call(ls, key, value);
};

(ls as any).removeItem = (key: string): void => {
  if (AUTH_KEYS.has(key)) sessionStorage.removeItem(key);
  else _remove.call(ls, key);
};
// ──────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
