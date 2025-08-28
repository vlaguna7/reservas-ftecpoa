-- Criar função ultra-segura para verificação admin
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

-- Função para detectar tentativas de escalação de privilégio
CREATE OR REPLACE FUNCTION public.detect_privilege_escalation(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_attempts integer;
  risk_score integer := 0;
  user_ip inet;
BEGIN
  user_ip := inet_client_addr();
  
  -- Contar tentativas de acesso admin nas últimas 5 minutos
  SELECT COUNT(*) INTO recent_attempts
  FROM security_audit_log
  WHERE user_id = p_user_id
    AND action = 'admin_access_check'
    AND created_at > now() - interval '5 minutes';

  -- Calcular score de risco
  risk_score := recent_attempts * 10;
  
  -- Se mais de 3 tentativas em 5 minutos = suspeito
  IF recent_attempts > 3 THEN
    risk_score := risk_score + 50;
    
    -- Log da atividade suspeita
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      details,
      ip_address
    ) VALUES (
      p_user_id,
      'suspicious_admin_attempts',
      jsonb_build_object(
        'attempts_count', recent_attempts,
        'risk_score', risk_score,
        'time_window_minutes', 5
      ),
      user_ip
    );
  END IF;

  RETURN jsonb_build_object(
    'risk_score', risk_score,
    'recent_attempts', recent_attempts,
    'is_suspicious', recent_attempts > 3,
    'should_block', risk_score > 60
  );
END;
$function$;