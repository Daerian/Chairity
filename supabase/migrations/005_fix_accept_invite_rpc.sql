-- ============================================================
-- Fix: "column reference 'event_id' is ambiguous" in
-- accept_event_invite — the RETURNS TABLE column was named
-- 'event_id', which PostgreSQL conflated with the same-named
-- column inside the INSERT INTO event_collaborators body.
--
-- Changes:
--   1. Rename output columns to evt_id / evt_name
--   2. SET search_path = public  (same fix as handle_new_user)
--   3. Qualify all table refs with public.
-- ============================================================

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
