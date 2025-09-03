-- Limpar duplicatas existentes antes de aplicar constraints

-- 1. Identificar e remover duplicatas mantendo apenas a mais recente
WITH duplicate_reservations AS (
  SELECT 
    id,
    equipment_type,
    reservation_date,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY equipment_type, reservation_date 
      ORDER BY created_at DESC
    ) as rn
  FROM public.reservations
  WHERE equipment_type LIKE 'laboratory_%' 
    OR equipment_type IN ('projector', 'speaker', 'auditorium')
)
DELETE FROM public.reservations 
WHERE id IN (
  SELECT id 
  FROM duplicate_reservations 
  WHERE rn > 1
);

-- 2. Log das duplicatas removidas para auditoria
INSERT INTO security_audit_log (
  user_id,
  action,
  details
) VALUES (
  NULL,
  'cleanup_duplicate_reservations',
  jsonb_build_object(
    'cleanup_date', now(),
    'reason', 'Preparing for unique constraint implementation'
  )
);