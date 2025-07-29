-- Add constraint to limit one reservation per equipment type per user per day
-- and remove support for 'both' equipment type

-- First, update any existing 'both' reservations to separate reservations
INSERT INTO public.reservations (user_id, equipment_type, reservation_date, created_at, updated_at)
SELECT 
  user_id, 
  'projector' as equipment_type, 
  reservation_date, 
  created_at, 
  updated_at
FROM public.reservations 
WHERE equipment_type = 'both';

INSERT INTO public.reservations (user_id, equipment_type, reservation_date, created_at, updated_at)
SELECT 
  user_id, 
  'speaker' as equipment_type, 
  reservation_date, 
  created_at, 
  updated_at
FROM public.reservations 
WHERE equipment_type = 'both';

-- Remove the old 'both' reservations
DELETE FROM public.reservations WHERE equipment_type = 'both';

-- Add constraint to ensure equipment_type is only 'projector' or 'speaker'
ALTER TABLE public.reservations 
ADD CONSTRAINT check_equipment_type 
CHECK (equipment_type IN ('projector', 'speaker'));

-- Add unique constraint to prevent multiple reservations of same type per user per day
ALTER TABLE public.reservations 
ADD CONSTRAINT unique_user_equipment_date 
UNIQUE (user_id, equipment_type, reservation_date);