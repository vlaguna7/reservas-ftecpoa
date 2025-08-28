-- CORREÇÃO DOS WARNINGS DE SEGURANÇA - FUNCTIONS SEARCH PATH

-- Corrigir função update_ip_control_updated_at
CREATE OR REPLACE FUNCTION update_ip_control_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Corrigir função update_updated_at_column se existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;