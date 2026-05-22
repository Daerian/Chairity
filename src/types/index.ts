export interface ChairityEvent {
  id: string
  user_id: string
  name: string
  description: string | null
  event_date: string | null
  created_at: string
  updated_at: string
}

export interface Guest {
  id: string
  event_id: string
  name: string
  notes: string | null
  created_at: string
}

export interface SeatingTable {
  id: string
  event_id: string
  name: string
  capacity: number
  sort_order: number
  created_at: string
}

export interface SeatAssignment {
  id: string
  table_id: string
  guest_id: string
  seat_number: number
  created_at: string
}

export interface DragData {
  type: 'guest' | 'seated'
  guestId: string
  tableId?: string
  seatNumber?: number
}

export interface DropData {
  type: 'seat' | 'sidebar'
  tableId?: string
  seatNumber?: number
}
