import { useEffect, useMemo } from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from './stores/themeStore.js'
import OrderView from './views/OrderView.js'
import BaristaView from './views/BaristaView.js'
import CounterView from './views/CounterView.js'
import PickupView from './views/PickupView.js'
import ManagementView from './views/ManagementView.js'

// Fetches the shop-wide language from the DB on startup and syncs i18next to it.
// i18next-browser-languagedetector serves the localStorage-cached language for the
// initial render (no flash), then this effect overrides it with the authoritative DB value.
function LanguageSync() {
  const { i18n } = useTranslation()
  useEffect(() => {
    fetch('/api/v1/auth/language')
      .then((r) => r.json())
      .then((json: { data?: { language: string } }) => {
        const lang = json.data?.language
        if (lang && lang !== i18n.language) {
          void i18n.changeLanguage(lang)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// Fetches the shop-wide dark mode flag from the DB on startup and syncs the theme store.
// localStorage provides the fast initial value (no flash); this effect overrides with the
// authoritative DB value on first load so all shop screens stay in sync.
function ThemeSync() {
  const setDarkMode = useThemeStore((s) => s.setDarkMode)
  useEffect(() => {
    fetch('/api/v1/auth/dark-mode')
      .then((r) => r.json())
      .then((json: { data?: { darkMode: boolean } }) => {
        if (typeof json.data?.darkMode === 'boolean') {
          setDarkMode(json.data.darkMode)
        }
      })
      .catch(() => {})
  }, [setDarkMode])
  return null
}

export default function App() {
  const darkMode = useThemeStore((s) => s.darkMode)
  const theme = useMemo(() => createTheme({ palette: { mode: darkMode ? 'dark' : 'light' } }), [darkMode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageSync />
      <ThemeSync />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/order" element={<OrderView />} />
          <Route path="/barista" element={<BaristaView />} />
          <Route path="/counter" element={<CounterView />} />
          <Route path="/pickup" element={<PickupView />} />
          <Route path="/management" element={<ManagementView />} />
          <Route path="/" element={<Navigate to="/order" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
