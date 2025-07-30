-- Política para permitir que admins deletem profiles de outros usuários
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

CREATE POLICY "Admins can delete any profile" 
ON public.profiles 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile 
    WHERE admin_profile.user_id = auth.uid() 
    AND admin_profile.is_admin = true
  )
);

-- Política para permitir que admins deletem reservas de outros usuários
DROP POLICY IF EXISTS "Admins can delete any reservation" ON public.reservations;

-- Verificar se já existe uma política similar
-- A política "Admins can delete any reservation" pode já existir, então vamos verificar