-- ============================================================
-- Chairity — canonical schema
-- Consolidated from migrations 001-006.
-- Run the full contents of this file in the Supabase SQL Editor
-- to create (or recreate) the complete database from scratch.
-- ============================================================


-- ============================================================
-- SECTION 1 — Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name              TEXT        NOT NULL,
  description       TEXT,
  event_date        DATE,
  invite_token      UUID        NOT NULL DEFAULT gen_random_uuid(),
  floor_layout      JSONB       DEFAULT '{"room_width":1200,"room_height":800,"snap_grid":40}'::jsonb,
  show_seat_numbers BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS events_invite_token_idx ON events(invite_token);

CREATE TABLE IF NOT EXISTS guests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name       TEXT        NOT NULL,
  notes      TEXT,
  group_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seating_tables (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name       TEXT        NOT NULL,
  capacity   INTEGER     NOT NULL CHECK (capacity > 0 AND capacity <= 100),
  sort_order INTEGER     NOT NULL DEFAULT 0,
  pos_x      FLOAT,
  pos_y      FLOAT,
  shape      TEXT        NOT NULL DEFAULT 'rectangle' CHECK (shape IN ('rectangle', 'round')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seat_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID        REFERENCES seating_tables(id) ON DELETE CASCADE NOT NULL,
  guest_id    UUID        REFERENCES guests(id) ON DELETE CASCADE NOT NULL,
  seat_number INTEGER     NOT NULL CHECK (seat_number > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_id, seat_number),
  UNIQUE (guest_id)
);

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_collaborators (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);


-- ============================================================
-- SECTION 2 — Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_guests_event_id    ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_tables_event_id    ON seating_tables(event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_table  ON seat_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_assignments_guest  ON seat_assignments(guest_id);


-- ============================================================
-- SECTION 3 — Row Level Security (enable)
-- ============================================================

ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests              ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_collaborators ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECTION 4 — Functions
-- ============================================================

-- Auto-update events.updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Populate profile row when a new user signs up via OAuth.
-- SET search_path avoids "table not found" in SECURITY DEFINER context.
-- EXCEPTION block ensures a profile failure never blocks user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user: could not create profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Returns true if the current user is the owner OR a collaborator of the event.
-- Used by RLS policies on every event-related table.
CREATE OR REPLACE FUNCTION public.is_event_member(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
$$;

-- Accept an invite token: adds the caller as a collaborator and returns
-- the event id + name so the client can redirect to the editor.
-- DROP first because PostgreSQL won't allow changing a function's return type
-- with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.accept_event_invite(uuid);

CREATE OR REPLACE FUNCTION public.accept_event_invite(p_token UUID)
RETURNS TABLE(evt_id UUID, evt_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_event_name TEXT;
BEGIN
  SELECT id, name
  INTO v_event_id, v_event_name
  FROM public.events
  WHERE invite_token = p_token;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite link.';
  END IF;

  -- Owner already has full access — skip inserting a collaborator row
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = v_event_id AND user_id = auth.uid()
  ) THEN
    INSERT INTO public.event_collaborators (event_id, user_id)
    VALUES (v_event_id, auth.uid())
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_event_id, v_event_name;
END;
$$;

-- Duplicate an event: copies tables and guests but not seat assignments.
CREATE OR REPLACE FUNCTION public.duplicate_event(p_event_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.events (user_id, name, description, event_date, floor_layout)
  SELECT auth.uid(), name || ' (copy)', description, event_date, floor_layout
  FROM public.events WHERE id = p_event_id
  RETURNING id INTO v_new_id;

  INSERT INTO public.seating_tables (event_id, name, capacity, sort_order, pos_x, pos_y, shape)
  SELECT v_new_id, name, capacity, sort_order, pos_x, pos_y, shape
  FROM public.seating_tables WHERE event_id = p_event_id;

  INSERT INTO public.guests (event_id, name, notes, group_name)
  SELECT v_new_id, name, notes, group_name
  FROM public.guests WHERE event_id = p_event_id;

  RETURN v_new_id;
END;
$$;


-- ============================================================
-- SECTION 5 — Triggers
-- ============================================================

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SECTION 6 — RLS Policies
-- ============================================================

-- Events
DROP POLICY IF EXISTS "events_owner"  ON events;
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (is_event_member(id));

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (is_event_member(id));

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (auth.uid() = user_id);

-- Guests
DROP POLICY IF EXISTS "guests_owner"  ON guests;
DROP POLICY IF EXISTS "guests_access" ON guests;

CREATE POLICY "guests_access" ON guests
  FOR ALL USING (is_event_member(event_id));

-- Seating tables
DROP POLICY IF EXISTS "tables_owner"  ON seating_tables;
DROP POLICY IF EXISTS "tables_access" ON seating_tables;

CREATE POLICY "tables_access" ON seating_tables
  FOR ALL USING (is_event_member(event_id));

-- Seat assignments
DROP POLICY IF EXISTS "assignments_owner"  ON seat_assignments;
DROP POLICY IF EXISTS "assignments_access" ON seat_assignments;

CREATE POLICY "assignments_access" ON seat_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.seating_tables st
      WHERE st.id = seat_assignments.table_id AND is_event_member(st.event_id)
    )
  );

-- Profiles
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_own"  ON profiles;

CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Event collaborators
DROP POLICY IF EXISTS "collab_select" ON event_collaborators;
DROP POLICY IF EXISTS "collab_insert" ON event_collaborators;
DROP POLICY IF EXISTS "collab_delete" ON event_collaborators;

CREATE POLICY "collab_select" ON event_collaborators
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_collaborators.event_id AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "collab_insert" ON event_collaborators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collab_delete" ON event_collaborators
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_collaborators.event_id AND events.user_id = auth.uid()
    )
  );


-- ============================================================
-- SECTION 7 — EXECUTE grants
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_event_member(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_event_invite(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_event(uuid)        TO authenticated;


-- ============================================================
-- SECTION 8 — Realtime publications
-- Wrapped in DO blocks so re-running is safe when a table is
-- already a member of the publication.
-- ============================================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE seat_assignments;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE guests;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE seating_tables;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE event_collaborators; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- SECTION 9 — Backfill existing auth users into profiles
-- (safe to re-run; ON CONFLICT is a no-op for existing rows)
-- ============================================================

INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- Drop stale policies and recreate cleanly
DROP POLICY IF EXISTS "events_owner"  ON events;
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (is_event_member(id));

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (is_event_member(id));

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (auth.uid() = user_id);
