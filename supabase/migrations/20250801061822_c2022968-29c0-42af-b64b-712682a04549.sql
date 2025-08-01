-- Verificar e corrigir as políticas RLS da tabela admin_notification_emails
-- Primeiro, vamos ver as políticas atuais
-- Depois vamos garantir que a edge function tenha acesso

-- Remover políticas existentes que podem estar bloqueando o acesso
DROP POLICY IF EXISTS "Apenas admins podem visualizar emails de notificação" ON admin_notification_emails;
DROP POLICY IF EXISTS "Apenas admins podem inserir emails de notificação" ON admin_notification_emails;
DROP POLICY IF EXISTS "Apenas admins podem atualizar emails de notificação" ON admin_notification_emails;
DROP POLICY IF EXISTS "Apenas admins podem deletar emails de notificação" ON admin_notification_emails;

-- Criar política que permite leitura para service role (edge functions)
CREATE POLICY "Service role can read notification emails"
ON admin_notification_emails
FOR SELECT
TO service_role
USING (true);

-- Criar política que permite admins gerenciarem emails
CREATE POLICY "Admins can manage notification emails"
ON admin_notification_emails
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Garantir que a tabela tenha RLS habilitado
ALTER TABLE admin_notification_emails ENABLE ROW LEVEL SECURITY;