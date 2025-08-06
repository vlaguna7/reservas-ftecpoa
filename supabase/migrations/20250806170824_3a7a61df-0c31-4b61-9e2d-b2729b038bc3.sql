-- Adicionar coluna has_green_tag na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN has_green_tag BOOLEAN NOT NULL DEFAULT false;

-- Criar índice para melhor performance
CREATE INDEX idx_profiles_has_green_tag ON public.profiles(has_green_tag);

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.has_green_tag IS 'Indica se o usuário deve exibir tag verde nas reservas (visível apenas para admins)';