-- Alterar a coluna has_green_tag para green_tag_text
ALTER TABLE public.profiles 
DROP COLUMN has_green_tag;

ALTER TABLE public.profiles 
ADD COLUMN green_tag_text TEXT;