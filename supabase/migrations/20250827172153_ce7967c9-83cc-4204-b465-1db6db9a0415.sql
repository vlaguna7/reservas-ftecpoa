-- Fix security definer view vulnerability
-- Drop the current view that bypasses user permissions
DROP VIEW IF EXISTS public.reservation_availability;

-- Recreate the view with SECURITY INVOKER to respect user-level RLS policies
CREATE VIEW public.reservation_availability
WITH (security_invoker = true)
AS
SELECT 
  reservation_date,
  equipment_type,
  time_slots,
  created_at,
  'reserved'::text AS status
FROM public.reservations;