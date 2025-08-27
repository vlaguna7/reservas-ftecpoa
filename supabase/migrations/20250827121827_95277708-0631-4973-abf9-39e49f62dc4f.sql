-- FASE 1: CORREÇÕES DE SEGURANÇA CRÍTICAS
-- Corrigir políticas RLS da tabela profiles para impedir acesso não autorizado

-- 1. Remover política perigosa que expõe dados de perfil a todos usuários autenticados
DROP POLICY IF EXISTS "Users can view basic info of other users" ON public.profiles;

-- 2. Adicionar política restritiva para visualização de perfis
CREATE POLICY "Users can only view their own profile data" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Manter política de admin para visualizar todos os perfis (já existe e é segura)
-- A política "Admins can view all profiles using function" permanece ativa

-- 4. Criar tabela de auditoria de segurança mais robusta
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    admin_user_id UUID REFERENCES auth.users(id),  -- Quem executou a ação
    action TEXT NOT NULL,
    target_user_email TEXT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- 5. Habilitar RLS na tabela de auditoria
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 6. Política para auditoria - somente admins podem ver
CREATE POLICY "Only admins can view admin audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (is_admin(auth.uid()));

-- 7. Permitir inserção de logs de auditoria (sistema)
CREATE POLICY "System can insert admin audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (true);

-- FASE 2: REMOÇÃO COMPLETA DO SISTEMA DE E-MAIL

-- 1. Remover tabelas de e-mail (ordem correta para evitar problemas de FK)
DROP TABLE IF EXISTS public.email_logs CASCADE;
DROP TABLE IF EXISTS public.scheduled_emails CASCADE;
DROP TABLE IF EXISTS public.teacher_emails CASCADE;
DROP TABLE IF EXISTS public.admin_notification_emails CASCADE;

-- 2. Remover funções de banco relacionadas a e-mail (se existirem)
DROP FUNCTION IF EXISTS public.get_admin_notification_emails();

-- 3. Remover jobs de cron relacionados a e-mail
SELECT cron.unschedule('schedule-email-processor') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'schedule-email-processor'
);

-- FASE 3: LIMPEZA E FORTALECIMENTO

-- 1. Atualizar função de verificação de admin para ser mais robusta
CREATE OR REPLACE FUNCTION public.is_admin_secure(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles 
     WHERE profiles.user_id = $1 AND is_admin = true), 
    false
  );
$$;

-- 2. Criar função para log de tentativas de elevação de privilégio
CREATE OR REPLACE FUNCTION public.log_privilege_attempt(
  target_user_id uuid,
  action_attempted text,
  request_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    user_id,
    admin_user_id,
    action,
    details,
    severity,
    created_at
  ) VALUES (
    target_user_id,
    auth.uid(),
    action_attempted,
    COALESCE(request_details, '{}'),
    'critical',
    now()
  );
END;
$$;

-- 3. Criar função para verificar tentativas suspeitas
CREATE OR REPLACE FUNCTION public.check_admin_elevation_attempts()
RETURNS TABLE(
  suspicious_user_id uuid,
  attempt_count bigint,
  last_attempt timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    admin_user_id,
    COUNT(*),
    MAX(created_at)
  FROM public.admin_audit_log 
  WHERE severity = 'critical' 
    AND created_at > now() - interval '24 hours'
    AND action LIKE '%admin%'
  GROUP BY admin_user_id
  HAVING COUNT(*) >= 3;  -- 3 ou mais tentativas em 24h
$$;

-- 4. Criar índices para performance em auditoria
CREATE INDEX IF NOT EXISTS idx_admin_audit_user_id ON public.admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_user_id ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON public.admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_severity ON public.admin_audit_log(severity);

-- 5. Atualizar função de verificação de equipamento para remover referências de e-mail
CREATE OR REPLACE FUNCTION public.get_equipment_availability_secure(p_equipment_type text, p_date date)
RETURNS TABLE(reservation_date date, equipment_type text, time_slots text[], is_available boolean, user_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    r.reservation_date,
    r.equipment_type,
    r.time_slots,
    false as is_available,
    COUNT(*) as user_count
  FROM reservations r
  WHERE r.equipment_type = p_equipment_type
    AND r.reservation_date = p_date
  GROUP BY r.reservation_date, r.equipment_type, r.time_slots;
$$;