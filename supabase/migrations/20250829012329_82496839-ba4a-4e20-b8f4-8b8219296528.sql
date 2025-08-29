-- Fix get_user_role_secure function to properly return user roles
-- The function was returning null instead of the actual role
CREATE OR REPLACE FUNCTION public.get_user_role_secure(p_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(role, 'visitor'::user_role)
  FROM profiles 
  WHERE user_id = p_user_id 
    AND status = 'approved'
  LIMIT 1;
$function$;