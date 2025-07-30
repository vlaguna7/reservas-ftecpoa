-- Verificar e configurar realtime para a tabela reservations
-- Primeiro, garantir que a tabela tenha REPLICA IDENTITY FULL
ALTER TABLE public.reservations REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;