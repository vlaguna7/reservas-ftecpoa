-- Criar reserva de projetor para Carlos Eduardo Iponema (com user_id correto)
INSERT INTO reservations (
  user_id,
  equipment_type,
  reservation_date,
  time_slots,
  observation,
  created_at
) VALUES (
  '13349adc-ba1a-46f5-b49f-8426ff36dee1', -- Carlos Eduardo Iponema
  'projector',
  '2025-09-03',
  NULL, -- time_slots como NULL (padrão para projetores)
  'Reserva restaurada - removida incorretamente por limpeza de duplicatas',
  '2025-09-03 10:00:00'
);

-- Registrar a correção no audit log
INSERT INTO admin_audit_log (
  admin_user_id,
  action,
  details,
  severity,
  created_at
)
VALUES (
  (SELECT user_id FROM profiles WHERE is_admin = true LIMIT 1),
  'restore_carlos_reservation_fix',
  jsonb_build_object(
    'reason', 'Correção: criar reserva para Carlos Eduardo Iponema com user_id correto',
    'user_id', '13349adc-ba1a-46f5-b49f-8426ff36dee1',
    'display_name', 'Carlos Eduardo Iponema',
    'date', '2025-09-03',
    'equipment_type', 'projector',
    'issue_found', 'Nome tinha espaço extra no banco de dados'
  ),
  'high',
  now()
);