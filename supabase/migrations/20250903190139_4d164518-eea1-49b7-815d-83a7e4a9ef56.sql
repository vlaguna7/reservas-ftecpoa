-- Corrigir a restauração: ajustar equipment_type para 'projector' e padronizar time_slots como NULL
UPDATE reservations
SET equipment_type = 'projector',
    time_slots = NULL
WHERE reservation_date = current_date
  AND equipment_type = 'projetor'
  AND observation ILIKE 'Reserva restaurada%';

-- Confirmar quais reservas de hoje existem após o ajuste (para auditoria rápida)
-- Nota: Apenas registra no log administrativo o resumo da correção
INSERT INTO admin_audit_log (admin_user_id, action, details, severity, created_at)
VALUES (
  (SELECT user_id FROM profiles WHERE is_admin = true LIMIT 1),
  'restore_reservations_correction',
  jsonb_build_object(
    'date', to_char(current_date, 'YYYY-MM-DD'),
    'equipment_type', 'projector',
    'note', 'Corrigido equipment_type de reservas restauradas de projetor',
    'affected_rows', (SELECT COUNT(*) FROM reservations WHERE reservation_date = current_date AND observation ILIKE 'Reserva restaurada%')
  ),
  'medium',
  now()
);