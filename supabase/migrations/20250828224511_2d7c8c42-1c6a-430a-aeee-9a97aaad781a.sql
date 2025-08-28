-- ===== PLANO CONSOLIDADO - SISTEMA DE ROLES + PROTEÇÃO ANTI-MÚLTIPLAS CONTAS =====

-- 1. CRIAR ENUM PARA ROLES
CREATE TYPE user_role AS ENUM ('visitor', 'user', 'admin');

-- 2. ADICIONAR COLUNA ROLE NA TABELA PROFILES
ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'visitor';

-- 3. MIGRAR DADOS EXISTENTES - USUÁRIOS APROVADOS VIRAM 'user', ADMINS MANTÊM 'admin'
UPDATE profiles 
SET role = CASE 
    WHEN is_admin = true THEN 'admin'::user_role
    WHEN status = 'approved' THEN 'user'::user_role
    ELSE 'visitor'::user_role
END;

-- 4. CRIAR TABELA DE CONTROLE DE IP
CREATE TABLE ip_registration_control (
    ip_address inet PRIMARY KEY,
    registration_count integer DEFAULT 0 NOT NULL,
    first_registration_at timestamp with time zone DEFAULT now(),
    last_registration_at timestamp with time zone DEFAULT now(),
    blocked_until timestamp with time zone,
    suspicious_activity boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. CRIAR TABELA DE HISTÓRICO DE IPs POR USUÁRIO
CREATE TABLE user_ip_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    registration_timestamp timestamp with time zone DEFAULT now(),
    is_signup boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 6. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_ip_registration_control_blocked ON ip_registration_control(blocked_until) WHERE blocked_until IS NOT NULL;
CREATE INDEX idx_user_ip_history_user_id ON user_ip_history(user_id);
CREATE INDEX idx_user_ip_history_ip ON user_ip_history(ip_address);
CREATE INDEX idx_profiles_role ON profiles(role);

-- 7. HABILITAR RLS NAS NOVAS TABELAS
ALTER TABLE ip_registration_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ip_history ENABLE ROW LEVEL SECURITY;

-- 8. POLÍTICAS RLS PARA ip_registration_control
CREATE POLICY "Only admins can view IP control data"
ON ip_registration_control
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "System can manage IP control data"
ON ip_registration_control
FOR ALL
USING (true)
WITH CHECK (true);

-- 9. POLÍTICAS RLS PARA user_ip_history  
CREATE POLICY "Admins can view all IP history"
ON user_ip_history
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own IP history"
ON user_ip_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert IP history"
ON user_ip_history
FOR INSERT
WITH CHECK (true);

-- 10. FUNÇÕES DE SEGURANÇA SECURITY DEFINER

-- Função para verificar role do usuário de forma segura
CREATE OR REPLACE FUNCTION get_user_role_secure(p_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(role, 'visitor'::user_role)
  FROM profiles 
  WHERE user_id = p_user_id 
    AND status = 'approved'
  LIMIT 1;
$$;

-- Função para verificar se usuário pode fazer reservas
CREATE OR REPLACE FUNCTION can_make_reservations_secure(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = p_user_id 
      AND status = 'approved'
      AND role IN ('user', 'admin')
  );
$$;

-- Função para verificar limite de registros por IP
CREATE OR REPLACE FUNCTION check_ip_registration_limit(p_ip_address inet)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ip_data record;
  is_blocked boolean := false;
  can_register boolean := false;
  reason text := '';
BEGIN
  -- Buscar dados do IP
  SELECT * INTO ip_data
  FROM ip_registration_control 
  WHERE ip_address = p_ip_address;
  
  -- Se IP não existe, pode registrar
  IF NOT FOUND THEN
    can_register := true;
    reason := 'new_ip';
  ELSE
    -- Verificar se está bloqueado
    IF ip_data.blocked_until IS NOT NULL AND ip_data.blocked_until > now() THEN
      is_blocked := true;
      can_register := false;
      reason := 'ip_blocked';
    -- Verificar limite de registros (máximo 3)
    ELSIF ip_data.registration_count >= 3 THEN
      can_register := false;
      reason := 'limit_exceeded';
    ELSE
      can_register := true;
      reason := 'within_limit';
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'can_register', can_register,
    'is_blocked', is_blocked,
    'registration_count', COALESCE(ip_data.registration_count, 0),
    'reason', reason,
    'blocked_until', ip_data.blocked_until
  );
END;
$$;

-- Função para registrar tentativa de cadastro
CREATE OR REPLACE FUNCTION log_registration_attempt(p_ip_address inet, p_user_agent text, p_success boolean, p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir ou atualizar controle de IP
  INSERT INTO ip_registration_control (ip_address, registration_count, first_registration_at, last_registration_at)
  VALUES (p_ip_address, CASE WHEN p_success THEN 1 ELSE 0 END, now(), now())
  ON CONFLICT (ip_address) 
  DO UPDATE SET 
    registration_count = CASE 
      WHEN p_success THEN ip_registration_control.registration_count + 1 
      ELSE ip_registration_control.registration_count 
    END,
    last_registration_at = now(),
    blocked_until = CASE 
      WHEN NOT p_success AND ip_registration_control.registration_count >= 2 
      THEN now() + interval '24 hours'
      ELSE ip_registration_control.blocked_until
    END,
    suspicious_activity = CASE 
      WHEN NOT p_success THEN true 
      ELSE ip_registration_control.suspicious_activity 
    END;
  
  -- Registrar histórico se fornecido user_id
  IF p_user_id IS NOT NULL THEN
    INSERT INTO user_ip_history (user_id, ip_address, user_agent, is_signup)
    VALUES (p_user_id, p_ip_address, p_user_agent, p_success);
  END IF;
END;
$$;

-- Função para detectar padrões de fraude por IP
CREATE OR REPLACE FUNCTION detect_ip_fraud_patterns(p_ip_address inet)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_registrations int;
  same_user_agent_count int;
  fraud_score int := 0;
  risk_level text := 'low';
BEGIN
  -- Verificar registros recentes (últimas 24h)
  SELECT COUNT(*) INTO recent_registrations
  FROM user_ip_history 
  WHERE ip_address = p_ip_address 
    AND created_at > now() - interval '24 hours'
    AND is_signup = true;
  
  -- Verificar User-Agents idênticos
  SELECT COUNT(DISTINCT user_agent) INTO same_user_agent_count
  FROM user_ip_history 
  WHERE ip_address = p_ip_address 
    AND is_signup = true;
  
  -- Calcular score de fraude
  fraud_score := recent_registrations * 10;
  IF same_user_agent_count = 1 AND recent_registrations > 1 THEN
    fraud_score := fraud_score + 20;
  END IF;
  
  -- Determinar nível de risco
  IF fraud_score >= 30 THEN
    risk_level := 'high';
  ELSIF fraud_score >= 15 THEN
    risk_level := 'medium';
  END IF;
  
  RETURN jsonb_build_object(
    'fraud_score', fraud_score,
    'risk_level', risk_level,
    'recent_registrations', recent_registrations,
    'unique_user_agents', same_user_agent_count,
    'requires_review', fraud_score >= 20
  );
END;
$$;

-- 11. TRIGGER PARA ATUALIZAR TIMESTAMPS
CREATE OR REPLACE FUNCTION update_ip_control_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ip_control_timestamp
  BEFORE UPDATE ON ip_registration_control
  FOR EACH ROW
  EXECUTE FUNCTION update_ip_control_updated_at();

-- 12. FUNÇÃO PARA ACESSO SEGURO AO DASHBOARD ADMIN
CREATE OR REPLACE FUNCTION can_access_admin_dashboard(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER  
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = p_user_id 
      AND status = 'approved'
      AND role = 'admin'
      AND is_admin = true
  );
$$;

-- 13. ATUALIZAR POLÍTICAS RLS EXISTENTES PARA USAR ROLES

-- Remover políticas antigas e criar novas baseadas em roles
DROP POLICY IF EXISTS "Approved users can view their own reservations" ON reservations;
DROP POLICY IF EXISTS "Approved users can create reservations" ON reservations;
DROP POLICY IF EXISTS "Approved users can delete their reservations" ON reservations;

CREATE POLICY "Users and admins can view their own reservations"
ON reservations
FOR SELECT
USING (
  auth.uid() = user_id AND 
  get_user_role_secure(auth.uid()) IN ('user', 'admin')
);

CREATE POLICY "Users and admins can create reservations"
ON reservations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  get_user_role_secure(auth.uid()) IN ('user', 'admin')
);

CREATE POLICY "Users and admins can delete their reservations"
ON reservations
FOR DELETE
USING (
  auth.uid() = user_id AND 
  get_user_role_secure(auth.uid()) IN ('user', 'admin')
);