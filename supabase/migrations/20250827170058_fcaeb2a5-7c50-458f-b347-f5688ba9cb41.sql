-- Remover todas as políticas problemáticas que causam recursão
DROP POLICY IF EXISTS "Users can view display names for reservations" ON public.profiles;
DROP POLICY IF EXISTS "Approved users can view display names of other approved users" ON public.profiles;

-- Criar função security definer para verificar se usuário está aprovado (evita recursão)
CREATE OR REPLACE FUNCTION public.is_user_approved(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT status = 'approved' FROM profiles 
    WHERE profiles.user_id = $1
  ), false);
$function$;

-- Criar política simples e segura que permite usuários aprovados verem display_name de outros usuários aprovados
CREATE POLICY "Approved users can view display names" 
ON public.profiles 
FOR SELECT 
USING (
  -- Permite que usuários aprovados vejam display_name de outros usuários aprovados
  is_user_approved(auth.uid()) AND status = 'approved'
);