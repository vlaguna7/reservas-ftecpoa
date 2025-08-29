-- Restore is_admin_secure_v2 to be side-effect free for use in RLS policies
-- Remove INSERTs and mark as STABLE to avoid read-only transaction violations
CREATE OR REPLACE FUNCTION public.is_admin_secure_v2(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_count integer;
  session_valid boolean := false;
BEGIN
  -- Strict admin verification: user exists, approved, admin flags set
  SELECT COUNT(*) INTO admin_count
  FROM profiles p
  WHERE p.user_id = p_user_id
    AND p.status = 'approved'
    AND p.is_admin = true
    AND p.role = 'admin';

  IF admin_count = 1 THEN
    -- Verify the user has a recent valid session (last 24h)
    SELECT EXISTS(
      SELECT 1 FROM auth.sessions 
      WHERE user_id = p_user_id 
        AND created_at > now() - interval '24 hours'
    ) INTO session_valid;

    RETURN session_valid;
  END IF;

  RETURN false;
END;
$function$;