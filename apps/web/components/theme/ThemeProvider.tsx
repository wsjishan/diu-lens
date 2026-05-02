'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'theme-preference';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const themeListeners = new Set<() => void>();

let currentTheme: Theme = 'system';
let currentResolvedTheme: ResolvedTheme = 'light';
let themeSnapshot: { theme: Theme; resolvedTheme: ResolvedTheme } = {
  theme: currentTheme,
  resolvedTheme: currentResolvedTheme,
};

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  // Keep mobile onboarding in dark mode by default until the user explicitly picks a theme.
  if (window.matchMedia('(max-width: 639px)').matches) {
    return 'dark';
  }

  return 'system';
}

function emitThemeChange() {
  for (const listener of themeListeners) {
    listener();
  }
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function getThemeSnapshot() {
  return themeSnapshot;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;

  currentTheme = theme;
  currentResolvedTheme = resolvedTheme;
  themeSnapshot = {
    theme: currentTheme,
    resolvedTheme: currentResolvedTheme,
  };
  emitThemeChange();
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setTheme = useCallback((nextTheme: Theme) => {
    if (nextTheme === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    }

    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(currentResolvedTheme === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  useEffect(() => {
    applyTheme(getStoredTheme());

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = () => {
      if (currentTheme !== 'system') return;
      applyTheme('system');
    };

    mediaQuery.addEventListener('change', onSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  const value = useMemo(
    () => ({ setTheme, toggleTheme }),
    [setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  const snapshot = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeSnapshot
  );

  return {
    theme: snapshot.theme,
    resolvedTheme: snapshot.resolvedTheme,
    setTheme: context.setTheme,
    toggleTheme: context.toggleTheme,
  };
}
