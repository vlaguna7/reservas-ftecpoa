-- Remove the old constraint that doesn't include 'auditorium'
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_equipment_type_check;