-- Política para permitir que admins deletem qualquer reserva
CREATE POLICY "Admins can delete any reservation" 
ON public.reservations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile 
    WHERE admin_profile.user_id = auth.uid() 
    AND admin_profile.is_admin = true
  )
);