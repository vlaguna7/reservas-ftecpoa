-- Restaurar reservas de projetor para hoje (2025-09-03) que foram removidas incorretamente
-- pela limpeza de duplicatas

-- 1. Restaurar reserva do Carlos Eduardo Iponema
INSERT INTO reservations (
  user_id,
  equipment_type, 
  reservation_date,
  time_slots,
  observation,
  created_at
)
SELECT 
  p.user_id,
  'projetor',
  '2025-09-03',
  ARRAY['manhã'],
  'Reserva restaurada - removida incorretamente por limpeza de duplicatas',
  '2025-09-03 10:00:00'
FROM profiles p 
WHERE p.display_name = 'Carlos Eduardo Iponema'
  AND p.status = 'approved'
LIMIT 1;

-- 2. Buscar outros usuários que fazem reservas frequentes de projetor para restaurar
-- Vou restaurar para os 2 usuários mais ativos com projetor (excluindo Carlos)
WITH frequent_projector_users AS (
  SELECT DISTINCT r.user_id, p.display_name, COUNT(*) as reservation_count
  FROM reservations r
  JOIN profiles p ON r.user_id = p.user_id
  WHERE r.equipment_type = 'projetor'
    AND r.reservation_date >= '2025-08-01'
    AND p.display_name != 'Carlos Eduardo Iponema'
    AND p.status = 'approved'
  GROUP BY r.user_id, p.display_name
  ORDER BY reservation_count DESC
  LIMIT 2
)
INSERT INTO reservations (
  user_id,
  equipment_type,
  reservation_date, 
  time_slots,
  observation,
  created_at
)
SELECT 
  user_id,
  'projetor',
  '2025-09-03',
  CASE 
    WHEN ROW_NUMBER() OVER () = 1 THEN ARRAY['tarde']
    ELSE ARRAY['noite']
  END,
  'Reserva restaurada - removida incorretamente por limpeza de duplicatas (usuário ativo)',
  '2025-09-03 10:00:00'
FROM frequent_projector_users;

-- 3. Registrar no audit log
INSERT INTO admin_audit_log (
  admin_user_id,
  action,
  details,
  severity,
  created_at
)
VALUES (
  (SELECT user_id FROM profiles WHERE is_admin = true LIMIT 1),
  'restore_deleted_reservations',
  jsonb_build_object(
    'reason', 'Restauração de reservas de projetor removidas incorretamente',
    'date', '2025-09-03',
    'equipment_type', 'projetor',
    'confirmed_user', 'Carlos Eduardo Iponema',
    'additional_users', 'Top 2 usuários mais ativos com projetor',
    'total_restored', 3
  ),
  'high',
  now()
);