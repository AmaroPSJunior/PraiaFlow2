import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-sky-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 transition-all hover:scale-110 active:scale-95"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
