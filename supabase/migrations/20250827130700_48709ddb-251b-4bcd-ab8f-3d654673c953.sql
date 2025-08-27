-- Fortify admin checks to require approved status
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT is_admin FROM public.profiles 
    WHERE profiles.user_id = $1 AND profiles.status = 'approved'
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_secure(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT is_admin FROM public.profiles 
    WHERE profiles.user_id = $1 AND profiles.status = 'approved'
  ), false);
$function$;

-- Remove sensitive data exposure and restrict login helper RPC
CREATE OR REPLACE FUNCTION public.verify_user_login(p_institutional_user text, p_pin text)
RETURNS TABLE(user_id uuid, institutional_user text, display_name text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Require authenticated caller; blocks anonymous scraping
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Return only approved users and no pin hash
  RETURN QUERY
  SELECT 
    p.user_id,
    p.institutional_user,
    p.display_name,
    p.is_admin
  FROM profiles p
  WHERE LOWER(TRIM(p.institutional_user)) = LOWER(TRIM(p_institutional_user))
    AND p.status = 'approved'
  LIMIT 1;
END;
$function$;

-- Tighten privileges for RPCs
REVOKE ALL ON FUNCTION public.verify_user_login(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_user_login(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_status(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_status(uuid) TO authenticated;