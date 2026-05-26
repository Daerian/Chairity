-- ============================================================
-- Fix 006: ensure accept_event_invite and is_event_member are
-- correctly deployed with proper search_path and EXECUTE grants.
--
-- Run this entire block in the Supabase SQL Editor.
-- ============================================================

-- Re-create accept_event_invite
-- (DROP first because PostgreSQL won't allow changing return type)
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

-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION public.accept_event_invite(uuid) TO authenticated;

-- ============================================================
-- Re-create is_event_member with explicit search_path so it
-- works correctly in all SECURITY DEFINER contexts.
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.is_event_member(uuid) TO authenticated;
