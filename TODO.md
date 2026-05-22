# Chairity — Feature Roadmap

## 1. Table Resizing

Allow users to resize individual tables directly on the canvas without opening the configuration modal.

- [ ] Inline capacity editor on each table card (click the `n/capacity` badge to edit)
- [ ] Persist change to Supabase immediately on blur/enter
- [ ] If capacity is reduced below the current number of seated guests, prompt the user to confirm — unassign guests from removed seats

---

## 2. Drag-to-Reorder Tables

Allow the event owner to reorder tables on the canvas by dragging them.

- [ ] Wrap the table grid in a sortable DnD context (`@dnd-kit/sortable`)
- [ ] Persist the new `sort_order` values to Supabase on drop
- [ ] Keep the guest-to-seat drag-and-drop working independently (two separate DnD contexts or use drag handle to disambiguate)
- [ ] Show a subtle drag handle on each table card header

---

## 3. Custom Floor Layout (Free-form Canvas)

Give organisers a bird's-eye floor plan view where tables can be positioned freely in a room.

### 3a. Data model
- [ ] Add `pos_x FLOAT` and `pos_y FLOAT` columns to `seating_tables`
- [ ] Add a `floor_layout` JSONB column to `events` for room dimensions and background settings
- [ ] Migration: `003_floor_layout.sql`

### 3b. Canvas view
- [ ] Toggle between **Grid view** (current) and **Floor Plan view** in the editor header
- [ ] Floor plan renders tables as draggable cards on a scaled canvas (e.g. 1200×800px room)
- [ ] Tables snap to a grid (configurable: 20px, 40px, or free)
- [ ] Tables remember their position; new tables default to a non-overlapping position

### 3c. Table shapes
- [ ] Support round and rectangular table shapes (stored as `shape` enum on `seating_tables`)
- [ ] Round tables display seats arranged in a circle
- [ ] Rectangular tables display seats in two rows

### 3d. Room customisation
- [ ] Set room dimensions (width × height in metres)
- [ ] Optional background image upload (venue floor plan scan)
- [ ] Add static room elements: stage, dance floor, bar (labelled rectangles, no seats)

### 3e. Real-time sync
- [ ] Position changes broadcast via existing Supabase Realtime channel so collaborators see tables move live

---

## Other Ideas

- [ ] Guest notes / dietary requirements field (visible on hover in the editor)
- [ ] Colour-code guests by group (e.g. family, work colleagues)
- [ ] Print-optimised floor plan view (CSS `@media print`)
- [ ] Duplicate an event (copy tables + guests, clear assignments)
