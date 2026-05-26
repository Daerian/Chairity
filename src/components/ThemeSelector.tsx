'use client'

import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { THEMES, useTheme } from '@/lib/theme'

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Choose theme"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-event-border hover:border-gold-400 hover:bg-gold-50 transition-all text-gray-600"
      >
        <Palette size={14} />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-event-border shadow-xl p-3 w-44">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Theme</p>
            <div className="space-y-0.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gold-50 transition-colors text-left"
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                    style={{ background: t.swatch }}
                  />
                  <span className="text-sm text-gray-700 flex-1">{t.label}</span>
                  {theme === t.id && <Check size={13} className="text-gold-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
