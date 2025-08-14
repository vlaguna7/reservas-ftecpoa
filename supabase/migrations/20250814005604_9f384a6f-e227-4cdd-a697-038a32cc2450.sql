-- Recreate the function to be case-insensitive and trim whitespace
CREATE OR REPLACE FUNCTION public.check_institutional_user_exists(p_institutional_user text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE LOWER(TRIM(institutional_user)) = LOWER(TRIM(p_institutional_user))
  );
$function$;