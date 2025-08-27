-- Adicionar política para permitir que usuários aprovados vejam display_name de outros usuários
CREATE POLICY "Approved users can view display names of other approved users" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND
  status = 'approved' AND
  EXISTS (
    SELECT 1 FROM public.profiles requester
    WHERE requester.user_id = auth.uid() 
    AND requester.status = 'approved'
  )
);