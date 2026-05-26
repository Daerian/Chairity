-- ============================================================
-- Chairity — floor plan layout + guest groups + duplicate event
-- ============================================================

-- Table positions and shape
ALTER TABLE seating_tables ADD COLUMN IF NOT EXISTS pos_x FLOAT;
ALTER TABLE seating_tables ADD COLUMN IF NOT EXISTS pos_y FLOAT;
ALTER TABLE seating_tables ADD COLUMN IF NOT EXISTS shape TEXT NOT NULL DEFAULT 'rectangle'
  CHECK (shape IN ('rectangle', 'round'));

-- Room layout stored per event
ALTER TABLE events ADD COLUMN IF NOT EXISTS floor_layout JSONB
  DEFAULT '{"room_width":1200,"room_height":800,"snap_grid":40}'::jsonb;

-- Guest group for colour-coding
ALTER TABLE guests ADD COLUMN IF NOT EXISTS group_name TEXT;

-- ============================================================
-- RPC: duplicate an event (copies tables + guests, no assignments)
-- ============================================================
CREATE OR REPLACE FUNCTION duplicate_event(p_event_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO events (user_id, name, description, event_date, floor_layout)
  SELECT auth.uid(), name || ' (copy)', description, event_date, floor_layout
  FROM events WHERE id = p_event_id
  RETURNING id INTO v_new_id;

  INSERT INTO seating_tables (event_id, name, capacity, sort_order, pos_x, pos_y, shape)
  SELECT v_new_id, name, capacity, sort_order, pos_x, pos_y, shape
  FROM seating_tables WHERE event_id = p_event_id;

  INSERT INTO guests (event_id, name, notes, group_name)
  SELECT v_new_id, name, notes, group_name
  FROM guests WHERE event_id = p_event_id;

  RETURN v_new_id;
END;
$$;
