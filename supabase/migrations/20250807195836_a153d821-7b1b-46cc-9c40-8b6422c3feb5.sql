-- Configuração de políticas de senha mais restritivas (para ser feito via dashboard)
-- Esta migration documenta as configurações recomendadas que devem ser feitas manualmente

-- Para configurar no Supabase Dashboard:
-- 1. Authentication > Settings > Password Policy
--    - Minimum length: 6 characters  
--    - Require uppercase: false (PINs são numéricos)
--    - Require numbers: true
--    - Password strength: medium

-- 2. Authentication > Settings > Security
--    - Enable CAPTCHA protection
--    - Enable leaked password protection
--    - Set OTP expiry to maximum 300 seconds (5 minutes)

-- 3. Authentication > Settings > Rate Limiting
--    - Enable rate limiting for all authentication endpoints
--    - Set maximum failed attempts to 5 per hour

-- Adicionar função para limpar tentativas de rate limit antigas
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Esta função seria chamada por um cron job para limpar dados antigos
  -- Por agora, apenas um placeholder para documentar a necessidade
  RAISE NOTICE 'Rate limit cleanup would run here';
END;
$$;

-- Criar tabela para audit log de operações sensíveis
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver audit logs
CREATE POLICY "Admins can view security audit logs"
ON public.security_audit_log
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Sistema pode inserir audit logs
CREATE POLICY "System can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (true);

-- Índices para performance do audit log
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON public.security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action ON public.security_audit_log(action);