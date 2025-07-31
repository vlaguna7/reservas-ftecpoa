-- Adicionar coluna para horários do auditório
ALTER TABLE public.reservations 
ADD COLUMN time_slots text[];

-- Adicionar índice para melhor performance nas consultas de horários
CREATE INDEX idx_reservations_time_slots ON public.reservations USING GIN(time_slots);

-- Comentário para documentar a estrutura
COMMENT ON COLUMN public.reservations.time_slots IS 'Array de horários selecionados para reservas de auditório: morning, afternoon, evening';