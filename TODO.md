# Chairity — Feature Roadmap

## 1. Table Resizing

Allow users to resize individual tables directly on the canvas without opening the configuration modal.

- [x] Inline capacity editor on each table card (click the `n/capacity` badge to edit)
- [x] Persist change to Supabase immediately on blur/enter
- [x] If capacity is reduced below the current number of seated guests, prompt the user to confirm — unassign guests from removed seats

---

## 2. Drag-to-Reorder Tables

Allow the event owner to reorder tables on the canvas by dragging them.

- [x] Wrap the table grid in a sortable DnD context (`@dnd-kit/sortable`)
- [x] Persist the new `sort_order` values to Supabase on drop
- [x] Keep the guest-to-seat drag-and-drop working independently (two separate DnD contexts or use drag handle to disambiguate)
- [x] Show a subtle drag handle on each table card header

---

## 3. Custom Floor Layout (Free-form Canvas)

Give organisers a bird's-eye floor plan view where tables can be positioned freely in a room.

### 3a. Data model
- [x] Add `pos_x FLOAT` and `pos_y FLOAT` columns to `seating_tables`
- [x] Add a `floor_layout` JSONB column to `events` for room dimensions and background settings
- [x] Migration: `003_floor_layout.sql`

### 3b. Canvas view
- [x] Toggle between **Grid view** (current) and **Floor Plan view** in the editor header
- [x] Floor plan renders tables as draggable cards on a scaled canvas (1200×800px room)
- [x] Tables snap to a grid (configurable: 20px, 40px, or free)
- [x] Tables remember their position; new tables default to a non-overlapping position

### 3c. Table shapes
- [x] Support round and rectangular table shapes (stored as `shape` enum on `seating_tables`)
- [x] Round tables display seats arranged in a circle
- [x] Rectangular tables display seats in two rows

### 3d. Room customisation
- [x] Set room dimensions (width × height in metres)
- [ ] Optional background image upload (venue floor plan scan)
- [ ] Add static room elements: stage, dance floor, bar (labelled rectangles, no seats)

### 3e. Real-time sync
- [x] Position changes broadcast via existing Supabase Realtime channel so collaborators see tables move live

---

## Other Ideas

- [x] Guest notes / dietary requirements field (visible on hover in the editor)
- [x] Colour-code guests by group (coloured dot + inline group tag editor on each guest card)
- [x] Print-optimised floor plan view (CSS `@media print`)
- [x] Duplicate an event (copy tables + guests, clear assignments)
