-- Fix the security definer view issue by removing SECURITY DEFINER and ensuring proper RLS
DROP VIEW IF EXISTS public.reservation_availability;

-- Create a regular view without SECURITY DEFINER - RLS policies will apply normally
CREATE VIEW public.reservation_availability AS
SELECT 
  reservation_date,
  equipment_type,
  time_slots,
  created_at
FROM public.reservations;

-- Grant access to the view
GRANT SELECT ON public.reservation_availability TO authenticated, anon;

-- Fix remaining functions to have proper search_path
CREATE OR REPLACE FUNCTION public.check_institutional_user_exists(p_institutional_user text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE institutional_user = p_institutional_user
  );
$$;

CREATE OR REPLACE FUNCTION public.get_profile_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT display_name FROM profiles WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_notification_emails()
RETURNS TABLE(email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT admin_notification_emails.email 
  FROM admin_notification_emails 
  WHERE is_active = true;
$$;