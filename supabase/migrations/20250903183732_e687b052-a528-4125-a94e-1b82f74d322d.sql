-- Aplicar sistema de prevenção de duplicatas após limpeza

-- 1. Criar constraint única apenas para laboratórios
ALTER TABLE public.reservations 
ADD CONSTRAINT unique_laboratory_per_date 
UNIQUE (equipment_type, reservation_date) 
WHERE equipment_type LIKE 'laboratory_%';

-- 2. Criar função para validar disponibilidade de laboratório
CREATE OR REPLACE FUNCTION public.validate_laboratory_reservation(
  p_equipment_type text,
  p_reservation_date date,
  p_user_id uuid DEFAULT NULL
) 
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_count integer;
  lab_name text;
BEGIN
  -- Verificar se é um laboratório
  IF p_equipment_type NOT LIKE 'laboratory_%' THEN
    RETURN true; -- Não é laboratório, validação passa
  END IF;
  
  -- Verificar se já existe reserva para este laboratório nesta data
  SELECT COUNT(*) INTO existing_count
  FROM reservations
  WHERE equipment_type = p_equipment_type
    AND reservation_date = p_reservation_date
    AND (p_user_id IS NULL OR user_id != p_user_id);
  
  -- Se existe reserva, retornar false
  IF existing_count > 0 THEN
    -- Buscar nome do laboratório para log
    SELECT laboratory_name INTO lab_name
    FROM laboratory_settings 
    WHERE laboratory_code = p_equipment_type;
    
    -- Log da tentativa de reserva duplicada
    INSERT INTO security_audit_log (
      user_id,
      action,
      details,
      ip_address
    ) VALUES (
      COALESCE(p_user_id, auth.uid()),
      'duplicate_laboratory_reservation_attempt',
      jsonb_build_object(
        'equipment_type', p_equipment_type,
        'laboratory_name', lab_name,
        'reservation_date', p_reservation_date,
        'existing_count', existing_count
      ),
      inet_client_addr()
    );
    
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 3. Criar trigger para validação automática antes de inserir
CREATE OR REPLACE FUNCTION public.check_laboratory_availability_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validar se é laboratório e se está disponível
  IF NEW.equipment_type LIKE 'laboratory_%' THEN
    IF NOT validate_laboratory_reservation(NEW.equipment_type, NEW.reservation_date, NEW.user_id) THEN
      RAISE EXCEPTION 'Este laboratório já está reservado para a data selecionada. Por favor, escolha outra data.' 
        USING ERRCODE = '23505'; -- Código de violação de constraint única
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Aplicar trigger
DROP TRIGGER IF EXISTS trg_check_laboratory_availability ON public.reservations;
CREATE TRIGGER trg_check_laboratory_availability
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION check_laboratory_availability_trigger();

-- 5. Função para verificar disponibilidade em tempo real
CREATE OR REPLACE FUNCTION public.check_laboratory_availability_real_time(
  p_equipment_type text,
  p_reservation_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO 'public'
AS $$
DECLARE
  existing_reservation record;
  lab_name text;
  user_display_name text;
BEGIN
  -- Verificar se é um laboratório
  IF p_equipment_type NOT LIKE 'laboratory_%' THEN
    RETURN jsonb_build_object(
      'available', true,
      'is_laboratory', false
    );
  END IF;
  
  -- Buscar reserva existente com informações do usuário
  SELECT r.*, p.display_name INTO existing_reservation, user_display_name
  FROM reservations r
  JOIN profiles p ON r.user_id = p.user_id
  WHERE r.equipment_type = p_equipment_type
    AND r.reservation_date = p_reservation_date
  LIMIT 1;
  
  -- Buscar nome do laboratório
  SELECT laboratory_name INTO lab_name
  FROM laboratory_settings 
  WHERE laboratory_code = p_equipment_type;
  
  -- Se não encontrou reserva, está disponível
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'available', true,
      'is_laboratory', true,
      'laboratory_name', lab_name
    );
  END IF;
  
  -- Se encontrou reserva, retornar informações
  RETURN jsonb_build_object(
    'available', false,
    'is_laboratory', true,
    'laboratory_name', lab_name,
    'reserved_by', user_display_name,
    'reservation_date', existing_reservation.reservation_date,
    'created_at', existing_reservation.created_at
  );
END;
$$;