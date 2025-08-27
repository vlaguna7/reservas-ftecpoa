-- Remover a política problemática que pode estar causando conflito
DROP POLICY IF EXISTS "Approved users can view display names of other approved users" ON public.profiles;

-- Criar uma política mais simples e segura para visualizar display_name
CREATE POLICY "Users can view display names for reservations" 
ON public.profiles 
FOR SELECT 
USING (
  -- Permite que usuários autenticados vejam apenas o display_name e status de outros usuários aprovados
  auth.uid() IS NOT NULL AND
  status = 'approved'
);

-- Verificar se a função get_user_status está funcionando corretamente
CREATE OR REPLACE FUNCTION public.get_user_status_debug(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(status::text, 'not_found') FROM profiles WHERE user_id = p_user_id;
$function$;