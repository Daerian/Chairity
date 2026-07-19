import {
  Music, Wine, Cake, Mic, Heart, DoorOpen, LogOut,
  Footprints, Trees, Gift, DoorClosed, Shapes,
  Headphones, Camera, Utensils, Shirt, BookOpen,
  type LucideIcon,
} from 'lucide-react'
import type { FloorArea, FloorAreaType } from '@/types'

export interface AreaPreset {
  label: string
  icon: LucideIcon
  /** Colours are applied via inline styles (see groups.ts convention) so they
   *  survive Tailwind purging regardless of the content globs. */
  bg: string
  border: string
  text: string
  defaultW: number
  defaultH: number
  shape: 'rectangle' | 'round'
}

export const AREA_PRESETS: Record<FloorAreaType, AreaPreset> = {
  dance_floor: { label: 'Dance Floor', icon: Music,     bg: 'rgba(147,51,234,0.10)', border: '#c084fc', text: '#7e22ce', defaultW: 240, defaultH: 200, shape: 'rectangle' },
  bar:         { label: 'Bar',         icon: Wine,      bg: 'rgba(217,119,6,0.10)',  border: '#fcd34d', text: '#b45309', defaultW: 200, defaultH: 70,  shape: 'rectangle' },
  cake_table:  { label: 'Cake Table',  icon: Cake,      bg: 'rgba(236,72,153,0.10)', border: '#f9a8d4', text: '#be185d', defaultW: 120, defaultH: 90,  shape: 'rectangle' },
  stage:       { label: 'Stage',       icon: Mic,       bg: 'rgba(79,70,229,0.10)',  border: '#a5b4fc', text: '#4338ca', defaultW: 240, defaultH: 110, shape: 'rectangle' },
  head_table:  { label: 'Head Table',  icon: Heart,     bg: 'rgba(225,29,72,0.10)',  border: '#fda4af', text: '#be123c', defaultW: 260, defaultH: 90,  shape: 'rectangle' },
  entrance:    { label: 'Entrance',    icon: DoorOpen,  bg: 'rgba(22,163,74,0.10)',  border: '#86efac', text: '#15803d', defaultW: 110, defaultH: 50,  shape: 'rectangle' },
  exit:        { label: 'Exit',        icon: LogOut,    bg: 'rgba(220,38,38,0.10)',  border: '#fca5a5', text: '#b91c1c', defaultW: 110, defaultH: 50,  shape: 'rectangle' },
  staircase:   { label: 'Staircase',   icon: Footprints, bg: 'rgba(100,116,139,0.10)', border: '#cbd5e1', text: '#475569', defaultW: 90,  defaultH: 150, shape: 'rectangle' },
  patio:       { label: 'Patio',       icon: Trees,     bg: 'rgba(5,150,105,0.10)',  border: '#6ee7b7', text: '#047857', defaultW: 220, defaultH: 160, shape: 'rectangle' },
  gift_table:  { label: 'Gift Table',  icon: Gift,      bg: 'rgba(13,148,136,0.10)', border: '#5eead4', text: '#0f766e', defaultW: 130, defaultH: 90,  shape: 'rectangle' },
  restroom:    { label: 'Restroom',    icon: DoorClosed, bg: 'rgba(8,145,178,0.10)', border: '#67e8f9', text: '#0e7490', defaultW: 110, defaultH: 90,  shape: 'rectangle' },
  dj_booth:    { label: 'DJ Booth',    icon: Headphones, bg: 'rgba(124,58,237,0.10)', border: '#c4b5fd', text: '#6d28d9', defaultW: 140, defaultH: 90,  shape: 'rectangle' },
  photo_booth: { label: 'Photo Booth', icon: Camera,    bg: 'rgba(2,132,199,0.10)',  border: '#7dd3fc', text: '#0369a1', defaultW: 130, defaultH: 130, shape: 'rectangle' },
  buffet:      { label: 'Buffet',      icon: Utensils,  bg: 'rgba(202,138,4,0.10)',  border: '#fde047', text: '#a16207', defaultW: 240, defaultH: 80,  shape: 'rectangle' },
  coat_check:  { label: 'Coat Check',  icon: Shirt,     bg: 'rgba(71,85,105,0.10)',  border: '#cbd5e1', text: '#334155', defaultW: 120, defaultH: 80,  shape: 'rectangle' },
  guestbook:   { label: 'Guestbook',   icon: BookOpen,  bg: 'rgba(180,83,9,0.10)',   border: '#fdba74', text: '#9a3412', defaultW: 110, defaultH: 80,  shape: 'rectangle' },
  custom:      { label: 'Area',        icon: Shapes,    bg: 'rgba(107,114,128,0.10)', border: '#d1d5db', text: '#4b5563', defaultW: 160, defaultH: 120, shape: 'rectangle' },
}

/** Order shown in the "Add area" palette. */
export const AREA_TYPE_LIST: FloorAreaType[] = [
  'dance_floor', 'bar', 'head_table', 'stage', 'dj_booth', 'cake_table',
  'buffet', 'gift_table', 'guestbook', 'photo_booth', 'coat_check', 'entrance',
  'exit', 'staircase', 'patio', 'restroom', 'custom',
]

function snap(val: number, grid: number): number {
  return grid > 0 ? Math.round(val / grid) * grid : val
}

/** Build a new area of the given type, centred within the room and snapped. */
export function newArea(
  type: FloorAreaType,
  roomW: number,
  roomH: number,
  snapGrid: number,
): FloorArea {
  const preset = AREA_PRESETS[type]
  const w = Math.min(preset.defaultW, roomW)
  const h = Math.min(preset.defaultH, roomH)
  const x = Math.max(0, Math.min(roomW - w, snap((roomW - w) / 2, snapGrid)))
  const y = Math.max(0, Math.min(roomH - h, snap((roomH - h) / 2, snapGrid)))
  return {
    id: crypto.randomUUID(),
    type,
    label: preset.label,
    x, y, w, h,
    shape: preset.shape,
  }
}
