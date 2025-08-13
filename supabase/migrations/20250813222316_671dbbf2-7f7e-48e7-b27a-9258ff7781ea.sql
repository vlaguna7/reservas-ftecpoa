-- Fix remaining security issues

-- Remove the public policy on reservations that's still exposing user data
DROP POLICY IF EXISTS "Public can view reservation availability data" ON public.reservations;

-- Create a more restrictive view that only shows what's needed for availability calculation
-- without exposing user-specific data like observations and user_ids
CREATE OR REPLACE VIEW public.reservation_availability AS
SELECT 
  reservation_date,
  equipment_type,
  time_slots,
  created_at,
  'reserved'::text as status -- Generic status instead of user-specific info
FROM public.reservations;

-- Grant access to the view for availability checks
GRANT SELECT ON public.reservation_availability TO authenticated, anon;

-- Fix search path for the remaining function  
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Esta função seria chamada por um cron job para limpar dados antigos
  -- Por agora, apenas um placeholder para documentar a necessidade
  RAISE NOTICE 'Rate limit cleanup would run here';
END;
$$;