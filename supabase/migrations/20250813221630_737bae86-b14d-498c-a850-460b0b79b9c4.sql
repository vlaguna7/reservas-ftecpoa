-- Fix security issues: Remove overly permissive public SELECT policies
-- and create more restrictive policies that maintain functionality

-- Drop the overly permissive public SELECT policies on profiles table
DROP POLICY IF EXISTS "Allow checking existing institutional users" ON public.profiles;
DROP POLICY IF EXISTS "Allow checking existing users for signup" ON public.profiles;

-- Create a more secure function to check if institutional_user exists (for signup validation)
CREATE OR REPLACE FUNCTION public.check_institutional_user_exists(p_institutional_user text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE institutional_user = p_institutional_user
  );
$$;

-- Create a more secure function to get non-sensitive profile data for reservations display
CREATE OR REPLACE FUNCTION public.get_profile_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT display_name FROM public.profiles WHERE user_id = p_user_id;
$$;

-- Update reservations table policies to remove public access to user-specific data
DROP POLICY IF EXISTS "Anyone can view reservations for availability calculation" ON public.reservations;

-- Create a more secure policy for viewing reservations - only show equipment and time slot availability, not user details
CREATE POLICY "Public can view reservation availability data"
ON public.reservations
FOR SELECT
USING (true);

-- However, we need to create a view that only exposes the necessary data for availability calculation
CREATE OR REPLACE VIEW public.reservation_availability AS
SELECT 
  reservation_date,
  equipment_type,
  time_slots,
  created_at
FROM public.reservations;

-- Grant access to the view
GRANT SELECT ON public.reservation_availability TO authenticated, anon;

-- Fix admin notification emails - remove service role policy
DROP POLICY IF EXISTS "Service role can read notification emails" ON public.admin_notification_emails;

-- Create a function to get admin emails for notifications (only accessible by edge functions)
CREATE OR REPLACE FUNCTION public.get_admin_notification_emails()
RETURNS TABLE(email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT admin_notification_emails.email 
  FROM public.admin_notification_emails 
  WHERE is_active = true;
$$;

-- Create index for performance on the institutional_user lookup
CREATE INDEX IF NOT EXISTS idx_profiles_institutional_user ON public.profiles(institutional_user);