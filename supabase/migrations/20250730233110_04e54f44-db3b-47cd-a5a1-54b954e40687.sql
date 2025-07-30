-- Criar tabela para controle de laboratórios ativos
CREATE TABLE public.laboratory_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  laboratory_code TEXT NOT NULL UNIQUE,
  laboratory_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir todos os laboratórios como ativos por padrão
INSERT INTO public.laboratory_settings (laboratory_code, laboratory_name) VALUES
('laboratory_08_npj_psico', '08 - NPJ/PSICO'),
('laboratory_13_lab_informatica', '13 - LAB INFORMÁTICA'),
('laboratory_15_lab_quimica', '15 - LAB QUÍMICA'),
('laboratory_16_lab_informatica', '16 - LAB INFORMÁTICA'),
('laboratory_17_lab_projetos', '17 - LAB PROJETOS'),
('laboratory_18_lab', '18 - LAB'),
('laboratory_19_lab', '19 - LAB'),
('laboratory_20_lab_informatica', '20 - LAB INFORMÁTICA'),
('laboratory_22_lab', '22 - LAB'),
('laboratory_28_lab_eng', '28 - LAB ENG.'),
('laboratory_103_lab', '103 - LAB'),
('laboratory_105_lab_hidraulica', '105 - LAB HIDRÁULICA'),
('laboratory_106_lab_informatica', '106 - LAB INFORMÁTICA');

-- Ativar RLS
ALTER TABLE public.laboratory_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - todos podem ver, apenas admins podem modificar
CREATE POLICY "Everyone can view laboratory settings" 
ON public.laboratory_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can update laboratory settings" 
ON public.laboratory_settings 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_laboratory_settings_updated_at
BEFORE UPDATE ON public.laboratory_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();