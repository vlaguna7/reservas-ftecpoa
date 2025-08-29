-- Fix detect_privilege_escalation to only count denied attempts and adjust risk scoring
CREATE OR REPLACE FUNCTION public.detect_privilege_escalation(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recent_denied_attempts integer;
  risk_score integer := 0;
  user_ip inet;
BEGIN
  user_ip := inet_client_addr();
  
  -- Count ONLY denied attempts in the last 5 minutes (not all access checks)
  SELECT COUNT(*) INTO recent_denied_attempts
  FROM security_audit_log
  WHERE user_id = p_user_id
    AND action = 'admin_access_denied'  -- Only count failed attempts
    AND created_at > now() - interval '5 minutes';

  -- Recalibrated risk scoring focused on actual failures
  risk_score := recent_denied_attempts * 15;  -- 15 points per denied attempt
  
  -- Only log suspicious activity when we have actual denied attempts
  IF recent_denied_attempts > 3 THEN
    -- Log suspicious activity only when threshold is exceeded
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      details,
      ip_address
    ) VALUES (
      p_user_id,
      'suspicious_admin_attempts',
      jsonb_build_object(
        'denied_attempts_count', recent_denied_attempts,
        'risk_score', risk_score,
        'time_window_minutes', 5
      ),
      user_ip
    );
  END IF;

  RETURN jsonb_build_object(
    'risk_score', risk_score,
    'recent_denied_attempts', recent_denied_attempts,
    'is_suspicious', recent_denied_attempts > 3,      -- Suspicious after 3 denials
    'should_block', recent_denied_attempts > 5        -- Block after 5 denials
  );
END;
$function$;