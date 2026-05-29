'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Tag, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getGroupColor } from '@/lib/groups'
import type { Guest } from '@/types'

interface Props {
  guest: Guest
  onDelete?: (guestId: string) => void
}

export default function GuestItem({ guest, onDelete }: Props) {
  const supabase = createClient()
  const [editingGroup, setEditingGroup] = useState(false)
  const [groupDraft, setGroupDraft] = useState(guest.group_name ?? '')
  const [groupName, setGroupName] = useState(guest.group_name)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `guest-${guest.id}`,
    data: { type: 'guest', guestId: guest.id },
  })

  async function commitGroup() {
    const trimmed = groupDraft.trim() || null
    if (trimmed !== groupName) {
      setGroupName(trimmed)
      await supabase.from('guests').update({ group_name: trimmed }).eq('id', guest.id)
    }
    setEditingGroup(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={`group flex items-start gap-1.5 px-2.5 py-2 text-sm rounded-lg border transition-all select-none ${
        isDragging
          ? 'opacity-40 border-gold-300 bg-gold-50'
          : 'bg-white border-gold-200 hover:border-gold-400 hover:shadow-sm cursor-grab active:cursor-grabbing'
      }`}
    >
      <GripVertical size={12} className="text-gray-300 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {groupName && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: getGroupColor(groupName) }}
            />
          )}
          <span className="truncate font-medium text-gray-700">{guest.name}</span>
        </div>
        {guest.notes && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">{guest.notes}</p>
        )}
        {editingGroup ? (
          <input
            autoFocus
            value={groupDraft}
            onChange={(e) => setGroupDraft(e.target.value)}
            onBlur={commitGroup}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitGroup()
              if (e.key === 'Escape') setEditingGroup(false)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Group name…"
            className="mt-1 w-full text-[10px] px-1.5 py-0.5 border border-gold-300 rounded outline-none bg-white"
          />
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setGroupDraft(groupName ?? '')
              setEditingGroup(true)
            }}
            className={`mt-0.5 flex items-center gap-0.5 text-[10px] transition-colors ${
              groupName ? 'text-gray-500 hover:text-gold-600' : 'text-gray-300 hover:text-gray-500'
            }`}
          >
            <Tag size={9} />
            {groupName ?? 'Add group'}
          </button>
        )}
      </div>
      {onDelete && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(guest.id) }}
          className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
          title="Remove guest"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
