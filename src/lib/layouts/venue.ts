import type { FloorArea, FloorLayout } from '@/types'

export const VENUE_LAYOUT: FloorLayout = {
  room_width: 1600,
  room_height: 1000,
  snap_grid: 40,
}

export const VENUE_AREAS: Omit<FloorArea, 'id'>[] = [
  { type: 'buffet',     label: 'Food Area',    x: 480,  y: 40,  w: 480, h: 80,  shape: 'rectangle' },
  { type: 'head_table', label: 'Head Table 1', x: 1080, y: 80,  w: 280, h: 80,  shape: 'rectangle' },
  { type: 'head_table', label: 'Head Table 2', x: 1080, y: 200, w: 280, h: 80,  shape: 'rectangle' },
  { type: 'dj_booth',   label: 'DJ Stage',     x: 40,   y: 360, w: 160, h: 160, shape: 'rectangle' },
  { type: 'stage',      label: 'Stage',        x: 1320, y: 240, w: 240, h: 200, shape: 'rectangle' },
  { type: 'bar',        label: 'Bar',          x: 560,  y: 880, w: 200, h: 80,  shape: 'rectangle' },
  { type: 'bar',        label: 'Bar (Open)',   x: 800,  y: 880, w: 200, h: 80,  shape: 'rectangle' },
  { type: 'cake_table', label: 'Cake Table',   x: 40,   y: 840, w: 120, h: 80,  shape: 'rectangle' },
]

// Ordered list of (x, y) positions for round dinner tables.
// Assigned to tables sorted by sort_order — extras remain unplaced.
export const VENUE_TABLE_POSITIONS: { x: number; y: number }[] = [
  // Row A — top
  { x: 40,   y: 120 }, { x: 200,  y: 120 }, { x: 360,  y: 120 },
  { x: 520,  y: 120 }, { x: 680,  y: 120 }, { x: 840,  y: 120 }, { x: 1000, y: 120 },

  // Upper right (near head tables)
  { x: 1280, y: 40  }, { x: 1440, y: 40  },

  // Row B
  { x: 40,   y: 280 }, { x: 200,  y: 280 }, { x: 360,  y: 280 },
  { x: 520,  y: 280 }, { x: 680,  y: 280 }, { x: 840,  y: 280 },

  // Row C — middle
  { x: 200,  y: 440 }, { x: 360,  y: 440 }, { x: 520,  y: 440 },
  { x: 680,  y: 440 }, { x: 840,  y: 440 }, { x: 1000, y: 440 }, { x: 1160, y: 440 },

  // Bottom-left rows
  { x: 40,   y: 600 }, { x: 200,  y: 600 }, { x: 360,  y: 600 }, { x: 520, y: 600 }, { x: 680, y: 600 },
  { x: 40,   y: 760 }, { x: 200,  y: 760 }, { x: 360,  y: 760 }, { x: 520, y: 760 }, { x: 680, y: 760 },

  // Bottom-right rows
  { x: 840,  y: 600 }, { x: 1000, y: 600 },
  { x: 840,  y: 760 }, { x: 1000, y: 760 },
]
