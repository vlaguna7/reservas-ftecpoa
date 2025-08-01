-- Criar tabela para emails de notificação de administradores
CREATE TABLE public.admin_notification_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_notification_emails ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso - apenas admins podem gerenciar
CREATE POLICY "Apenas admins podem visualizar emails de notificação" 
ON public.admin_notification_emails 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Apenas admins podem inserir emails de notificação" 
ON public.admin_notification_emails 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Apenas admins podem atualizar emails de notificação" 
ON public.admin_notification_emails 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Apenas admins podem deletar emails de notificação" 
ON public.admin_notification_emails 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_admin_notification_emails_updated_at
BEFORE UPDATE ON public.admin_notification_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();