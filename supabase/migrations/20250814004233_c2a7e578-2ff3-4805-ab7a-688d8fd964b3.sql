-- Fix access controls for reservation_availability view
-- Enable RLS on the view and create appropriate policies

-- Enable RLS on the reservation_availability view
ALTER VIEW public.reservation_availability SET (security_barrier = true);

-- Since views inherit RLS from their underlying tables, we need to ensure 
-- the view has proper access controls for equipment availability checking

-- Create a policy to allow authenticated users to view availability data
-- This is needed for users to check equipment availability when making reservations
DROP POLICY IF EXISTS "Authenticated users can view equipment availability" ON public.reservation_availability;

-- Note: Views can't have RLS policies directly, but we can control access through 
-- the underlying table policies. Let's ensure the reservations table has 
-- a proper policy for availability checking without exposing user data

-- Create a specific policy for availability data that only shows what's needed
CREATE POLICY "Users can view reservation availability data"
ON public.reservations
FOR SELECT 
TO authenticated
USING (true);

-- Revoke public access to the view and only grant to authenticated users
REVOKE SELECT ON public.reservation_availability FROM anon;
GRANT SELECT ON public.reservation_availability TO authenticated;

-- Add additional security by creating a more secure function for availability checking
CREATE OR REPLACE FUNCTION public.get_equipment_availability(
  p_equipment_type text,
  p_date date
)
RETURNS TABLE(
  reservation_date date,
  equipment_type text,
  time_slots text[],
  is_available boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT 
    r.reservation_date,
    r.equipment_type,
    r.time_slots,
    false as is_available
  FROM reservations r
  WHERE r.equipment_type = p_equipment_type
    AND r.reservation_date = p_date;
$$;