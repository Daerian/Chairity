import type { Guest, SeatingTable, SeatAssignment, FloorLayout, FloorArea } from '@/types'

interface ExportData {
  eventName: string
  tables: SeatingTable[]
  guests: Guest[]
  assignments: SeatAssignment[]
}

export interface FloorPlanExportData {
  eventName: string
  tables: SeatingTable[]
  floorLayout: FloorLayout
  floorAreas: FloorArea[]
}

export function exportToExcel({ eventName, tables, guests, assignments }: ExportData) {
  import('exceljs').then(async ({ default: ExcelJS }) => {
    const guestMap = new Map(guests.map((g) => [g.id, g.name]))
    const tableMap = new Map(tables.map((t) => [t.id, t.name]))

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Seating')

    ws.columns = [
      { header: 'Guest Name', key: 'guest', width: 30 },
      { header: 'Table',      key: 'table', width: 20 },
      { header: 'Seat #',     key: 'seat',  width: 10 },
    ]

    ws.getRow(1).font = { bold: true }

    const sorted = [...assignments].sort((a, b) => {
      const ta = tableMap.get(a.table_id) ?? ''
      const tb = tableMap.get(b.table_id) ?? ''
      return ta.localeCompare(tb) || a.seat_number - b.seat_number
    })

    for (const a of sorted) {
      ws.addRow({ guest: guestMap.get(a.guest_id) ?? '', table: tableMap.get(a.table_id) ?? '', seat: a.seat_number })
    }

    const assignedIds = new Set(assignments.map((a) => a.guest_id))
    for (const g of guests) {
      if (!assignedIds.has(g.id)) ws.addRow({ guest: g.name, table: 'Unassigned', seat: '' })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${eventName} - Seating.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  })
}

export function exportToPDF({ eventName, tables, guests, assignments }: ExportData) {
  import('jspdf').then(async ({ jsPDF }) => {
    const { autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

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

    autoTable(doc, {
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
      autoTable(doc, {
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

const ROUND_PX = 130
const RECT_W_PX = 160
const RECT_H_PX = 110

export function exportFloorPlanToPDF({ eventName, tables, floorLayout, floorAreas }: FloorPlanExportData) {
  import('jspdf').then(({ jsPDF }) => {
    const { room_width: roomW, room_height: roomH } = floorLayout

    // Use landscape for wide rooms, portrait for tall ones
    const isLandscape = roomW >= roomH
    const pageW = isLandscape ? 297 : 210   // A4 mm
    const pageH = isLandscape ? 210 : 297
    const margin = 12
    const titleH = 8
    const usableW = pageW - 2 * margin
    const usableH = pageH - 2 * margin - titleH

    // Scale so the entire room fits on one page; split vertically if needed
    const scaleByW = usableW / roomW
    const scaleByH = usableH / roomH
    const scale = Math.min(scaleByW, scaleByH)   // mm per px

    const px = (v: number) => v * scale

    const doc = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(60, 50, 30)
    doc.text(`${eventName} — Floor Plan`, margin, margin + 4)

    const ox = margin              // canvas origin x in mm
    const oy = margin + titleH     // canvas origin y in mm

    // --- Floor areas ---
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    for (const area of floorAreas) {
      const x = ox + px(area.x)
      const y = oy + px(area.y)
      const w = px(area.w)
      const h = px(area.h)

      doc.setFillColor(245, 238, 220)
      doc.setDrawColor(180, 148, 80)
      doc.setLineWidth(0.3)

      if (area.shape === 'round') {
        doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 'FD')
      } else {
        doc.roundedRect(x, y, w, h, 1, 1, 'FD')
      }

      doc.setTextColor(110, 80, 30)
      doc.text(area.label, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
    }

    // --- Tables ---
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    for (const table of tables) {
      if (table.pos_x == null || table.pos_y == null) continue

      const tx = ox + px(table.pos_x)
      const ty = oy + px(table.pos_y)

      doc.setFillColor(255, 253, 248)
      doc.setDrawColor(180, 140, 60)
      doc.setLineWidth(0.5)
      doc.setTextColor(30, 20, 5)

      if (table.shape === 'round') {
        const r = px(ROUND_PX) / 2
        doc.circle(tx + r, ty + r, r, 'FD')
        doc.text(table.name, tx + r, ty + r, { align: 'center', baseline: 'middle' })
      } else {
        const tw = px(RECT_W_PX)
        const th = px(RECT_H_PX)
        doc.rect(tx, ty, tw, th, 'FD')
        doc.text(table.name, tx + tw / 2, ty + th / 2, { align: 'center', baseline: 'middle' })
      }
    }

    doc.save(`${eventName} - Floor Plan.pdf`)
  })
}
