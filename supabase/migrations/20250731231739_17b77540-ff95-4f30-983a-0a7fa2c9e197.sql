-- Criar tabela para perguntas frequentes
CREATE TABLE public.faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Políticas para perguntas frequentes
CREATE POLICY "Everyone can view active FAQs" 
ON public.faqs 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can view all FAQs" 
ON public.faqs 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert FAQs" 
ON public.faqs 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update FAQs" 
ON public.faqs 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete FAQs" 
ON public.faqs 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_faqs_updated_at
BEFORE UPDATE ON public.faqs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir algumas perguntas frequentes iniciais
INSERT INTO public.faqs (question, answer, sort_order) VALUES
('Como fazer uma reserva?', 'Selecione o equipamento desejado, escolha a data disponível e confirme sua reserva. Lembre-se de adicionar observações quando necessário.', 1),
('Posso cancelar minha reserva?', 'Sim, você pode cancelar suas reservas na aba "Minhas Reservas". É recomendado cancelar com antecedência para liberar o equipamento para outros usuários.', 2),
('Quantos equipamentos posso reservar por dia?', 'Você pode reservar um equipamento de cada tipo por dia. Para mais informações sobre limites específicos, consulte as configurações do sistema.', 3);