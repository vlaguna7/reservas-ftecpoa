-- Configurar realtime para a tabela reservations
ALTER TABLE public.reservations REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação realtime se não estiver
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  END IF;
END $$;