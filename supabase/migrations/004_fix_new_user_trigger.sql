-- ============================================================
-- Fix: "Database error saving new user" on OAuth sign-up
--
-- The handle_new_user trigger was executing without an explicit
-- search_path, so it couldn't locate the public.profiles table
-- and threw an unhandled exception that aborted the entire
-- auth.users INSERT — blocking new OAuth sign-ups.
--
-- Changes:
--   1. SET search_path = public  — table lookup now works
--   2. EXCEPTION block           — any future failure is caught
--      and logged rather than aborting user creation
-- ============================================================

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
  -- Never let a profile-insert failure block user creation.
  -- The profile can be created/backfilled separately if needed.
  RAISE WARNING 'handle_new_user: could not create profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
