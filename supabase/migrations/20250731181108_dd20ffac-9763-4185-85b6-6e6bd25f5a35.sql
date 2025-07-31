-- Remover constraint única que impede múltiplas reservas de auditório no mesmo dia
-- e permitir que usuários possam reservar múltiplos turnos

-- Primeiro, vamos verificar se existe a constraint
DO $$ 
BEGIN
    -- Tentar remover a constraint se ela existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_user_equipment_date' 
        AND table_name = 'reservations'
    ) THEN
        ALTER TABLE public.reservations DROP CONSTRAINT unique_user_equipment_date;
    END IF;
END $$;

-- Criar uma nova constraint que permite múltiplas reservas de auditório para o mesmo usuário/data
-- mas mantém a restrição para outros equipamentos
CREATE UNIQUE INDEX CONCURRENTLY unique_non_auditorium_reservations 
ON public.reservations (user_id, equipment_type, reservation_date) 
WHERE equipment_type != 'auditorium';

-- Para auditório, permitir múltiplas reservas mas com time_slots únicos
CREATE UNIQUE INDEX CONCURRENTLY unique_auditorium_time_slots 
ON public.reservations (reservation_date, unnest(time_slots)) 
WHERE equipment_type = 'auditorium';