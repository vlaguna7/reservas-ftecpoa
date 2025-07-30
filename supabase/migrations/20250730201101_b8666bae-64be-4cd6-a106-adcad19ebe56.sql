-- Tornar vitor.souza administrador
UPDATE public.profiles 
SET is_admin = true 
WHERE institutional_user = 'vitor.souza';

-- Adicionar nova coluna para observações nas reservas
ALTER TABLE public.reservations 
ADD COLUMN observation text;