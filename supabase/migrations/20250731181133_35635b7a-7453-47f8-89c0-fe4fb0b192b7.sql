-- Remover constraint única e criar novas regras para auditório
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

-- Permitir múltiplas reservas de auditório para o mesmo usuário/data
-- mas manter restrição para outros equipamentos  
CREATE UNIQUE INDEX unique_non_auditorium_reservations 
ON public.reservations (user_id, equipment_type, reservation_date) 
WHERE equipment_type != 'auditorium';