-- Tornar vitorsouza como administrador
UPDATE public.profiles 
SET is_admin = true,
    updated_at = now()
WHERE institutional_user = 'vitorsouza';