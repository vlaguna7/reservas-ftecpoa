-- Função segura para verificar disponibilidade sem expor user_id
CREATE OR REPLACE FUNCTION public.check_reservation_availability_secure(
  p_equipment_type text, 
  p_date date
)
RETURNS TABLE(
  reservation_date date,
  equipment_type text,
  time_slots text[],
  is_available boolean,
  reserved_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.reservation_date,
    r.equipment_type,
    r.time_slots,
    false as is_available,
    COUNT(*) as reserved_count
  FROM reservations r
  WHERE r.equipment_type = p_equipment_type
    AND r.reservation_date = p_date
  GROUP BY r.reservation_date, r.equipment_type, r.time_slots;
END;
$$;

-- Função segura para obter reservas com display_name (sem expor user_id)
CREATE OR REPLACE FUNCTION public.get_reservations_with_display_name(
  p_equipment_type text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  reservation_date date,
  equipment_type text,
  time_slots text[],
  observation text,
  created_at timestamptz,
  display_name text,
  is_own_reservation boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se usuário está aprovado
  IF NOT is_user_approved(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    r.reservation_date,
    r.equipment_type,
    r.time_slots,
    r.observation,
    r.created_at,
    p.display_name,
    (r.user_id = auth.uid()) as is_own_reservation
  FROM reservations r
  JOIN profiles p ON r.user_id = p.user_id
  WHERE (p_equipment_type IS NULL OR r.equipment_type = p_equipment_type)
    AND p.status = 'approved'
  ORDER BY r.created_at DESC;
END;
$$;

-- Atualizar política de reservas para ser mais restritiva
DROP POLICY IF EXISTS "Approved users can view availability data" ON reservations;

CREATE POLICY "Users can check availability without user_id exposure"
ON reservations
FOR SELECT
USING (
  -- Permite ver apenas dados necessários para verificação de disponibilidade
  -- através das funções seguras criadas acima
  false -- Esta política não deve ser usada diretamente
);