'use client';

import { useTheme } from './ThemeProvider';

export function ThemeToggle(): React.ReactElement {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = (): void => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    if (nextTheme) {
      setTheme(nextTheme);
    }
  };

  const getIcon = (): string => {
    if (theme === 'system') return '💻';
    return resolvedTheme === 'dark' ? '🌙' : '☀️';
  };

  const getLabel = (): string => {
    if (theme === 'system') return 'Авто';
    return theme === 'dark' ? 'Тёмная' : 'Светлая';
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors
                 bg-white text-gray-700 border-gray-300 hover:border-blue-400
                 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-blue-400"
      title={`Тема: ${getLabel()}`}
    >
      <span>{getIcon()}</span>
      <span className="hidden sm:inline">{getLabel()}</span>
    </button>
  );
}
