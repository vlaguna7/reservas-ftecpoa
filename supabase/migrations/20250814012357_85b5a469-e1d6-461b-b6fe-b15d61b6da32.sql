-- Criar função para verificar login sem problemas de RLS
CREATE OR REPLACE FUNCTION public.verify_user_login(p_institutional_user text, p_pin text)
RETURNS TABLE(
  user_id uuid,
  institutional_user text,
  display_name text,
  is_admin boolean,
  pin_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Busca o perfil do usuário de forma case-insensitive
  RETURN QUERY
  SELECT 
    p.user_id,
    p.institutional_user,
    p.display_name,
    p.is_admin,
    p.pin_hash
  FROM profiles p
  WHERE LOWER(TRIM(p.institutional_user)) = LOWER(TRIM(p_institutional_user))
  LIMIT 1;
END;
$$;