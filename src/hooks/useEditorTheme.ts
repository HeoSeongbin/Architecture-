import { useEffect, useState } from 'react';

export type EditorTheme = 'light' | 'dark';
export function useEditorTheme() {
  const [theme, setTheme] = useState<EditorTheme>(() => {
    try {
      const saved = localStorage.getItem('architecture-editor-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* Browser storage may be disabled. */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem('architecture-editor-theme', theme);
    } catch {
      /* In-memory theme still works. */
    }
  }, [theme]);
  return { theme, toggleTheme: () => setTheme((value) => (value === 'light' ? 'dark' : 'light')) };
}
