-- Adicionar política para permitir que admins insiram novos laboratórios
CREATE POLICY "Only admins can insert laboratory settings" 
ON public.laboratory_settings 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

-- Atualizar a constraint de check para ser mais flexível e permitir novos laboratórios
-- Primeiro remover a constraint antiga
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS check_equipment_type_updated;

-- Adicionar nova constraint que permite qualquer laboratory_* além dos tipos básicos
ALTER TABLE public.reservations 
ADD CONSTRAINT check_equipment_type_flexible 
CHECK (
  equipment_type = ANY (ARRAY['projector'::text, 'speaker'::text, 'auditorium'::text]) 
  OR equipment_type LIKE 'laboratory_%'
);