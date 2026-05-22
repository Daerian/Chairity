'use client'

import { useState } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import type { Guest, SeatingTable, SeatAssignment } from '@/types'
import { exportToPDF, exportToExcel } from '@/lib/export'

interface Props {
  eventName: string
  tables: SeatingTable[]
  guests: Guest[]
  assignments: SeatAssignment[]
}

export default function ExportButtons({ eventName, tables, guests, assignments }: Props) {
  const [open, setOpen] = useState(false)

  function doExport(format: 'pdf' | 'xlsx') {
    setOpen(false)
    const data = { eventName, tables, guests, assignments }
    if (format === 'pdf') exportToPDF(data)
    else exportToExcel(data)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gold-500 text-white hover:bg-gold-600 transition-colors"
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
            <button
              onClick={() => doExport('pdf')}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gold-50 hover:text-gold-700 transition-colors"
            >
              Export as PDF
            </button>
            <button
              onClick={() => doExport('xlsx')}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gold-50 hover:text-gold-700 transition-colors border-t border-gray-100"
            >
              Export as Excel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
