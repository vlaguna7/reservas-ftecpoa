-- Fix is_admin_secure_v2 to allow INSERT operations for logging
-- Make it VOLATILE instead of STABLE so it can perform INSERT operations

CREATE OR REPLACE FUNCTION public.is_admin_secure_v2(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_count integer;
  session_valid boolean := false;
BEGIN
  -- Log da tentativa de verificação
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    details,
    ip_address
  ) VALUES (
    p_user_id,
    'admin_access_check',
    jsonb_build_object(
      'timestamp', now(),
      'function', 'is_admin_secure_v2'
    ),
    inet_client_addr()
  );

  -- Verificação rigorosa: user existe, está aprovado E é admin
  SELECT COUNT(*) INTO admin_count
  FROM profiles p
  WHERE p.user_id = p_user_id
    AND p.status = 'approved'
    AND p.is_admin = true
    AND p.role = 'admin';

  -- Deve haver exatamente 1 resultado
  IF admin_count = 1 THEN
    -- Verificar se sessão ainda é válida (não foi comprometida)
    SELECT EXISTS(
      SELECT 1 FROM auth.sessions 
      WHERE user_id = p_user_id 
        AND created_at > now() - interval '24 hours'
    ) INTO session_valid;
    
    RETURN session_valid;
  END IF;

  -- Log tentativa suspeita se falhou
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    details,
    ip_address
  ) VALUES (
    p_user_id,
    'admin_access_denied',
    jsonb_build_object(
      'reason', 'failed_admin_verification',
      'admin_count', admin_count,
      'session_valid', session_valid
    ),
    inet_client_addr()
  );

  RETURN false;
END;
$function$;