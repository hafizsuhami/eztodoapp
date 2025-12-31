import { ref } from 'vue';
import { supabase } from '../services/supabase';
import type { ThemeName } from '../types';
import { THEME_PRESETS } from '../constants';

const THEME_KEY = 'taskmaster-theme';

export function useTheme(
  userId?: () => string | undefined,
  getUserTheme?: () => ThemeName | undefined
) {
  const isDark = ref(true);
  const activeTheme = ref<ThemeName>('dark');

  const applyTheme = (theme: ThemeName) => {
    const tokens = THEME_PRESETS[theme]?.tokens || THEME_PRESETS.dark.tokens;
    const root = document.documentElement;

    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    if (theme === 'dark' || theme === 'dim' || theme === 'vibrantPurple') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem(THEME_KEY, theme);
    isDark.value = theme === 'dark' || theme === 'dim' || theme === 'vibrantPurple';
    activeTheme.value = theme;
  };

  // Initialize theme
  const initTheme = () => {
    const userTheme = getUserTheme?.();
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemeName | null;

    if (userTheme && THEME_PRESETS[userTheme]) {
      applyTheme(userTheme);
    } else if (storedTheme && THEME_PRESETS[storedTheme]) {
      applyTheme(storedTheme);
    } else {
      applyTheme('light');
    }
  };

  const setTheme = async (theme: ThemeName) => {
    applyTheme(theme);

    const id = userId?.();
    if (!id) return;

    try {
      await supabase.auth.updateUser({
        data: { theme }
      });
    } catch (error) {
      console.error('Failed to update theme preference', error);
    }
  };

  // Toggle cycles light/dark only for quick switch
  const toggleTheme = async () => {
    const nextTheme: ThemeName = activeTheme.value === 'dark' ? 'light' : 'dark';
    await setTheme(nextTheme);
  };

  // Run initialization
  initTheme();

  return {
    isDark,
    activeTheme,
    setTheme,
    toggleTheme
  };
}
