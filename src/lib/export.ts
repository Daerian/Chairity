import type { Guest, SeatingTable, SeatAssignment } from '@/types'

interface ExportData {
  eventName: string
  tables: SeatingTable[]
  guests: Guest[]
  assignments: SeatAssignment[]
}

export function exportToExcel({ eventName, tables, guests, assignments }: ExportData) {
  import('xlsx').then((XLSX) => {
    const guestMap = new Map(guests.map((g) => [g.id, g.name]))
    const tableMap = new Map(tables.map((t) => [t.id, t.name]))

    const rows: (string | number)[][] = [['Guest Name', 'Table', 'Seat #']]

    const sorted = [...assignments].sort((a, b) => {
      const ta = tableMap.get(a.table_id) ?? ''
      const tb = tableMap.get(b.table_id) ?? ''
      return ta.localeCompare(tb) || a.seat_number - b.seat_number
    })

    for (const a of sorted) {
      rows.push([guestMap.get(a.guest_id) ?? '', tableMap.get(a.table_id) ?? '', a.seat_number])
    }

    const assignedIds = new Set(assignments.map((a) => a.guest_id))
    for (const g of guests) {
      if (!assignedIds.has(g.id)) rows.push([g.name, 'Unassigned', ''])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Seating')
    XLSX.writeFile(wb, `${eventName} - Seating.xlsx`)
  })
}

export function exportToPDF({ eventName, tables, guests, assignments }: ExportData) {
  import('jspdf').then(async ({ default: jsPDF }) => {
    await import('jspdf-autotable')
    const doc = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const guestMap = new Map(guests.map((g) => [g.id, g.name]))
    const assignmentBySeat = new Map(assignments.map((a) => [`${a.table_id}-${a.seat_number}`, a.guest_id]))

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(eventName, 105, 20, { align: 'center' })
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 100, 70)
    doc.text('Seating Arrangement', 105, 27, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    const sortedTables = [...tables].sort((a, b) => a.sort_order - b.sort_order)
    const tableBody: (string | number)[][] = []
    for (const table of sortedTables) {
      for (let seat = 1; seat <= table.capacity; seat++) {
        const gId = assignmentBySeat.get(`${table.id}-${seat}`)
        tableBody.push([table.name, seat, gId ? guestMap.get(gId) ?? '' : '— empty —'])
      }
    }

    ;(doc as any).autoTable({
      startY: 35,
      head: [['Table', 'Seat', 'Guest']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [180, 140, 60], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 248, 240] },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 20 }, 2: { cellWidth: 110 } },
      styles: { fontSize: 9, cellPadding: 3 },
    })

    const assignedIds = new Set(assignments.map((a) => a.guest_id))
    const unassigned = guests.filter((g) => !assignedIds.has(g.id))
    if (unassigned.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('Unassigned Guests', 14, finalY)
      ;(doc as any).autoTable({
        startY: finalY + 4,
        head: [['Guest']],
        body: unassigned.map((g) => [g.name]),
        theme: 'plain',
        headStyles: { fillColor: [220, 200, 160] },
        styles: { fontSize: 9 },
      })
    }

    doc.save(`${eventName} - Seating.pdf`)
  })
}
