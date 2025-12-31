import { ref, watchEffect } from 'vue';

const THEME_KEY = 'taskmaster-theme';

export function useTheme() {
  const isDark = ref(true);

  // Initialize theme
  const initTheme = () => {
    const storedTheme = localStorage.getItem(THEME_KEY);
    
    if (storedTheme) {
      isDark.value = storedTheme === 'dark';
    } else {
      // Check system preference
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      isDark.value = systemDark;
    }
  };

  // Toggle theme function
  const toggleTheme = () => {
    isDark.value = !isDark.value;
  };

  // Watch for changes and update DOM/Storage
  watchEffect(() => {
    const root = document.documentElement;
    if (isDark.value) {
      root.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  });

  // Run initialization
  initTheme();

  return {
    isDark,
    toggleTheme
  };
}
