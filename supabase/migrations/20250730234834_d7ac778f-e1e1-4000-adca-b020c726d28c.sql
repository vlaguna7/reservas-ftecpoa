-- Tornar o campo laboratory_code nullable para permitir criação sem código
ALTER TABLE public.laboratory_settings 
ALTER COLUMN laboratory_code DROP NOT NULL;