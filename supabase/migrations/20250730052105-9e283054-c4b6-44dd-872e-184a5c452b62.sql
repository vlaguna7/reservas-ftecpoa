-- Verificar e corrigir permissões para admins poderem atualizar outros usuários
-- Primeiro, vamos verificar se há uma política que permite admins atualizarem outros profiles

-- Política para permitir que admins atualizem qualquer profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile 
    WHERE admin_profile.user_id = auth.uid() 
    AND admin_profile.is_admin = true
  )
);