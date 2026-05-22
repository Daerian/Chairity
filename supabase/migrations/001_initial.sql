-- ============================================================
-- Chairity — initial schema
-- Run this in your Supabase SQL editor (or via supabase db push)
-- ============================================================

-- Events
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  event_date  DATE,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Guests imported from CSV
CREATE TABLE IF NOT EXISTS guests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tables within an event
CREATE TABLE IF NOT EXISTS seating_tables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  capacity   INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seat assignments (one guest per seat, one seat per guest)
CREATE TABLE IF NOT EXISTS seat_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID REFERENCES seating_tables(id) ON DELETE CASCADE NOT NULL,
  guest_id    UUID REFERENCES guests(id) ON DELETE CASCADE NOT NULL,
  seat_number INTEGER NOT NULL CHECK (seat_number > 0),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (table_id, seat_number),
  UNIQUE (guest_id)
);

-- ============================================================
-- Row Level Security — users only see their own data
-- ============================================================

ALTER TABLE events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_tables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_assignments ENABLE ROW LEVEL SECURITY;

-- Events
CREATE POLICY "events_owner" ON events
  FOR ALL USING (auth.uid() = user_id);

-- Guests: accessible if the user owns the parent event
CREATE POLICY "guests_owner" ON guests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = guests.event_id AND events.user_id = auth.uid())
  );

-- Tables: accessible if the user owns the parent event
CREATE POLICY "tables_owner" ON seating_tables
  FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = seating_tables.event_id AND events.user_id = auth.uid())
  );

-- Seat assignments: accessible if the user owns the parent table's event
CREATE POLICY "assignments_owner" ON seat_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM seating_tables st
      JOIN events e ON e.id = st.event_id
      WHERE st.id = seat_assignments.table_id AND e.user_id = auth.uid()
    )
  );

-- ============================================================
-- Auto-update updated_at on events
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Useful indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_guests_event_id     ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_tables_event_id     ON seating_tables(event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_table   ON seat_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_assignments_guest   ON seat_assignments(guest_id);
