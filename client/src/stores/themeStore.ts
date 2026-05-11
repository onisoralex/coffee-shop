// Shop-wide dark mode store — two-tier pattern mirroring language:
// localStorage is read at module load time (synchronous, no flash), DB is authoritative
// and overrides via ThemeSync in App.tsx on first render.
// applyTheme runs at module load so the data-theme attribute is set before React paints.
import { create } from 'zustand'

interface ThemeState {
  darkMode: boolean
  setDarkMode: (dark: boolean) => void
}

function applyTheme(dark: boolean) {
  localStorage.setItem('coffee-dark-mode', String(dark))
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

const initialDark = localStorage.getItem('coffee-dark-mode') === 'true'
applyTheme(initialDark)

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: initialDark,
  setDarkMode: (dark) => {
    applyTheme(dark)
    set({ darkMode: dark })
  },
}))
