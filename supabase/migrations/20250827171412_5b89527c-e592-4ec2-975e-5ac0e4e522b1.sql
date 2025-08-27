-- Corrigir vulnerabilidade de segurança na tabela laboratory_settings
-- Remover política que permite acesso público
DROP POLICY IF EXISTS "Everyone can view laboratory settings" ON public.laboratory_settings;

-- Criar política segura que permite apenas usuários autenticados e aprovados
CREATE POLICY "Approved users can view laboratory settings" 
ON public.laboratory_settings 
FOR SELECT 
USING (is_user_approved(auth.uid()));