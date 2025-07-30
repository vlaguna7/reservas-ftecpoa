-- Remove the check constraint that's causing the error
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS check_equipment_type;

-- Add a new check constraint that allows any valid equipment type including projector, speaker, and auditorium
ALTER TABLE public.reservations ADD CONSTRAINT check_equipment_type_new 
CHECK (equipment_type IN ('projector', 'speaker', 'auditorium'));