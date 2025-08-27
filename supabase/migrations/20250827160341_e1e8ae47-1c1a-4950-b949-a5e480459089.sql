-- Aprovar todos os usuários existentes que estão pendentes
-- Isso é necessário após a implementação do sistema de aprovação
-- para não bloquear usuários que já estavam usando o sistema

UPDATE profiles 
SET 
  status = 'approved',
  approved_at = now(),
  approved_by = (
    SELECT user_id 
    FROM profiles 
    WHERE is_admin = true 
    ORDER BY created_at ASC 
    LIMIT 1
  )
WHERE status = 'pending';