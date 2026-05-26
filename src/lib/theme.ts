import { useState, useEffect } from 'react'

export interface Theme {
  id: string
  label: string
  swatch: string
}

export const THEMES: Theme[] = [
  { id: 'gold',     label: 'Gold',     swatch: '#d49a22' },
  { id: 'dark',     label: 'Dark',     swatch: '#1c1812' },
  { id: 'lavender', label: 'Lavender', swatch: '#a855f7' },
  { id: 'sky',      label: 'Sky',      swatch: '#0ea5e9' },
  { id: 'rose',     label: 'Rose',     swatch: '#f43f5e' },
]

const KEY = 'chairity-theme'

export function useTheme() {
  const [theme, setThemeState] = useState('gold')

  useEffect(() => {
    const saved = localStorage.getItem(KEY) ?? 'gold'
    setThemeState(saved)
  }, [])

  function setTheme(id: string) {
    localStorage.setItem(KEY, id)
    document.documentElement.dataset.theme = id
    setThemeState(id)
  }

  return { theme, setTheme }
}
