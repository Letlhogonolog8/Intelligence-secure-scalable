import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

 

type Theme = 'light' | 'dark';

interface ThemeToggleProps {
  defaultTheme?: Theme;
  onChange?: (theme: Theme) => void;
}

/**
 * Theme Toggle Component
 * - Light/dark mode support
 * - Role-specific color themes
 * - Reduces motion option for trauma-informed UX
 * - Persistent preference in localStorage
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ defaultTheme = 'dark', onChange }) => {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Load theme from localStorage
    const saved = localStorage.getItem('aegis-theme') as Theme | null;
    const motionPreference = localStorage.getItem('reduce-motion') === 'true';

    if (saved) {
      setTheme(saved);
    }
    setReduceMotion(motionPreference);

    applyTheme(saved || defaultTheme, motionPreference);
  }, [defaultTheme]);

  const handleToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    applyTheme(newTheme, reduceMotion);
    localStorage.setItem('aegis-theme', newTheme);
    onChange?.(newTheme);
  };

  const handleMotionToggle = () => {
    const newValue = !reduceMotion;
    setReduceMotion(newValue);
    localStorage.setItem('reduce-motion', String(newValue));
    applyMotionPreference(newValue);
  };

  return (
    <div className="flex items-center gap-4">
      {/* Theme Toggle */}
      <button
        onClick={handleToggle}
        className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5 text-yellow-500" />
        ) : (
          <Moon className="h-5 w-5 text-slate-700" />
        )}
      </button>

      {/* Reduce Motion Toggle */}
      <button
        onClick={handleMotionToggle}
        className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
        aria-label={reduceMotion ? 'Enable animations' : 'Disable animations'}
        title="Reduce motion for accessibility"
      >
        <span className="text-lg">{reduceMotion ? '🎬' : '⏸️'}</span>
      </button>
    </div>
  );
};

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme, reduceMotion: boolean): void {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Apply CSS variables based on theme
  if (theme === 'dark') {
    root.style.setProperty('--bg-primary', '#050810');
    root.style.setProperty('--bg-secondary', '#0f172a');
    root.style.setProperty('--text-primary', '#f8fafc');
    root.style.setProperty('--text-secondary', '#cbd5e1');
    root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
  } else {
    root.style.setProperty('--bg-primary', '#ffffff');
    root.style.setProperty('--bg-secondary', '#f8fafc');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#475569');
    root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
  }

  applyMotionPreference(reduceMotion);
}

/**
 * Apply motion preferences
 */
function applyMotionPreference(reduceMotion: boolean): void {
  const root = document.documentElement;

  if (reduceMotion) {
    root.style.setProperty('--animation-duration', '0.01ms');
    // Disable animations via CSS
    const style = document.getElementById('reduce-motion-styles') || document.createElement('style');
    style.id = 'reduce-motion-styles';
    style.innerHTML = `
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    if (!document.head.contains(style)) {
      document.head.appendChild(style);
    }
  } else {
    root.style.setProperty('--animation-duration', '300ms');
    const style = document.getElementById('reduce-motion-styles');
    if (style) {
      style.remove();
    }
  }
}

/**
 * Hook: Use theme
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('aegis-theme') as Theme | null;
    return saved || 'dark';
  });

  return { theme, setTheme };
};
