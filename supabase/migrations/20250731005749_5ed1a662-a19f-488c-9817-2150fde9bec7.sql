-- Adicionar política DELETE para permitir que admins excluam laboratórios
CREATE POLICY "Only admins can delete laboratory settings" 
ON public.laboratory_settings 
FOR DELETE 
USING (is_admin(auth.uid()));