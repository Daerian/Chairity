-- ============================================================
-- Chairity — collaboration schema
-- ============================================================

-- Add invite token to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS invite_token UUID DEFAULT gen_random_uuid() NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS events_invite_token_idx ON events(invite_token);

-- Profiles: mirrors basic user info for display in collaborator lists
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Auto-populate profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Collaborators: who has been granted access to an event
CREATE TABLE IF NOT EXISTS event_collaborators (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators can see who else is on the event; owner can see all
CREATE POLICY "collab_select" ON event_collaborators
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM events WHERE events.id = event_collaborators.event_id AND events.user_id = auth.uid())
  );

-- A user inserts themselves when accepting an invite
CREATE POLICY "collab_insert" ON event_collaborators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- A collaborator can remove themselves; owner can remove anyone
CREATE POLICY "collab_delete" ON event_collaborators
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM events WHERE events.id = event_collaborators.event_id AND events.user_id = auth.uid())
  );

-- ============================================================
-- Update RLS on existing tables to allow collaborators
-- ============================================================

-- Helper: is the current user an owner or collaborator of an event?
CREATE OR REPLACE FUNCTION is_event_member(p_event_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM events WHERE id = p_event_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM event_collaborators WHERE event_id = p_event_id AND user_id = auth.uid()
  );
$$;

-- Events: owner can do everything; collaborators can SELECT + UPDATE (not DELETE)
DROP POLICY IF EXISTS "events_owner" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (is_event_member(id));

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (is_event_member(id));

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (auth.uid() = user_id);

-- Guests
DROP POLICY IF EXISTS "guests_owner" ON guests;
CREATE POLICY "guests_access" ON guests
  FOR ALL USING (is_event_member(event_id));

-- Tables
DROP POLICY IF EXISTS "tables_owner" ON seating_tables;
CREATE POLICY "tables_access" ON seating_tables
  FOR ALL USING (
    EXISTS (SELECT 1 FROM seating_tables st WHERE st.id = seating_tables.id AND is_event_member(st.event_id))
  );

-- Seat assignments
DROP POLICY IF EXISTS "assignments_owner" ON seat_assignments;
CREATE POLICY "assignments_access" ON seat_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM seating_tables st
      WHERE st.id = seat_assignments.table_id AND is_event_member(st.event_id)
    )
  );

-- ============================================================
-- RPC: accept an invite by token (runs as SECURITY DEFINER
-- so it can read the invite_token without the caller needing access)
-- ============================================================

CREATE OR REPLACE FUNCTION accept_event_invite(p_token UUID)
RETURNS TABLE(event_id UUID, event_name TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id   UUID;
  v_event_name TEXT;
BEGIN
  SELECT id, name INTO v_event_id, v_event_name
  FROM events WHERE invite_token = p_token;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite link.';
  END IF;

  -- Owner doesn't need a collaborator row
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event_id AND user_id = auth.uid()) THEN
    INSERT INTO event_collaborators (event_id, user_id)
    VALUES (v_event_id, auth.uid())
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_event_id, v_event_name;
END;
$$;

-- ============================================================
-- Enable Realtime for live collaboration
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE seat_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE guests;
ALTER PUBLICATION supabase_realtime ADD TABLE seating_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE event_collaborators;

-- ============================================================
-- Backfill profiles for existing users (run once)
-- ============================================================

INSERT INTO profiles (id, email, full_name, avatar_url)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
