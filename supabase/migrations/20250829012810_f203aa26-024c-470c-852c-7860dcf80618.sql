-- Backfill roles for approved users so they can insert reservations per RLS
UPDATE public.profiles
SET role = 'user'::user_role
WHERE status = 'approved'
  AND is_admin = false
  AND (role IS NULL OR role = 'visitor');

-- Ensure approved admins have correct role
UPDATE public.profiles
SET role = 'admin'::user_role
WHERE status = 'approved'
  AND is_admin = true
  AND (role IS NULL OR role <> 'admin');

-- Create trigger to auto-assign role when status changes to approved
CREATE OR REPLACE FUNCTION public.profile_auto_assign_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a profile is approved, ensure role is coherent
  IF NEW.status = 'approved' THEN
    IF NEW.is_admin = true THEN
      NEW.role := 'admin';
    ELSE
      IF NEW.role IS NULL OR NEW.role = 'visitor' THEN
        NEW.role := 'user';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_auto_assign_role ON public.profiles;
CREATE TRIGGER trg_profile_auto_assign_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profile_auto_assign_role();