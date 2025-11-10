-- Criar função para validar reservas duplicadas de auditório
-- Impede que dois usuários reservem o auditório no mesmo dia e horário

CREATE OR REPLACE FUNCTION check_auditorium_conflict()
RETURNS TRIGGER AS $$
DECLARE
  conflicting_count integer;
BEGIN
  -- Verificar apenas se é uma reserva de auditório
  IF NEW.equipment_type = 'auditorium' THEN
    
    -- Verificar se já existe reserva de auditório na mesma data com time_slots que se sobrepõem
    SELECT COUNT(*) INTO conflicting_count
    FROM reservations
    WHERE equipment_type = 'auditorium'
      AND reservation_date = NEW.reservation_date
      AND time_slots && NEW.time_slots  -- Operador de interseção de arrays
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid); -- Exclui a própria reserva em caso de UPDATE
    
    IF conflicting_count > 0 THEN
      RAISE EXCEPTION 'Conflito de reserva: O auditório já está reservado para este dia e horário.'
        USING ERRCODE = '23505', -- Código de violação de constraint única
              HINT = 'Por favor, escolha outro horário ou data.';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para validar antes de INSERT
CREATE TRIGGER validate_auditorium_before_insert
  BEFORE INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION check_auditorium_conflict();

-- Criar trigger para validar antes de UPDATE
CREATE TRIGGER validate_auditorium_before_update
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION check_auditorium_conflict();

-- Log de auditoria para tentativas de reserva duplicada
CREATE OR REPLACE FUNCTION log_auditorium_conflict_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar tentativa de reserva conflitante no log de segurança
  INSERT INTO security_audit_log (
    user_id,
    action,
    details,
    ip_address
  ) VALUES (
    NEW.user_id,
    'auditorium_conflict_attempt',
    jsonb_build_object(
      'reservation_date', NEW.reservation_date,
      'time_slots', NEW.time_slots,
      'observation', NEW.observation
    ),
    inet_client_addr()
  );
  
  RETURN NULL; -- Não interferir com a operação
EXCEPTION WHEN OTHERS THEN
  RETURN NULL; -- Se houver erro no log, não afetar a operação principal
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;