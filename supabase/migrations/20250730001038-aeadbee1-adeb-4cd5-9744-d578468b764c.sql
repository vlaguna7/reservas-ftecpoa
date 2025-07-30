-- Adicionar policy para permitir que todos vejam as reservas para calcular disponibilidade
CREATE POLICY "Anyone can view reservations for availability calculation"
ON public.reservations
FOR SELECT
USING (true);