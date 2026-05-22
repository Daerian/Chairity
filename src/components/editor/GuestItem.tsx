'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { Guest } from '@/types'

interface Props {
  guest: Guest
}

export default function GuestItem({ guest }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `guest-${guest.id}`,
    data: { type: 'guest', guestId: guest.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1.5 px-2.5 py-2 text-sm rounded-lg border transition-all select-none ${
        isDragging
          ? 'opacity-40 border-gold-300 bg-gold-50'
          : 'bg-white border-gold-200 hover:border-gold-400 hover:shadow-sm cursor-grab active:cursor-grabbing'
      }`}
    >
      <GripVertical size={12} className="text-gray-300 shrink-0" />
      <span className="truncate font-medium text-gray-700">{guest.name}</span>
    </div>
  )
}
