-- Remover a constraint antiga
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS check_equipment_type_new;

-- Adicionar nova constraint que permite laboratórios
ALTER TABLE public.reservations 
ADD CONSTRAINT check_equipment_type_updated 
CHECK (
  equipment_type = ANY (ARRAY[
    'projector'::text, 
    'speaker'::text, 
    'auditorium'::text,
    'laboratory_08_npj_psico'::text,
    'laboratory_13_lab_informatica'::text,
    'laboratory_15_lab_quimica'::text,
    'laboratory_16_lab_informatica'::text,
    'laboratory_17_lab_projetos'::text,
    'laboratory_18_lab'::text,
    'laboratory_19_lab'::text,
    'laboratory_20_lab_informatica'::text,
    'laboratory_22_lab'::text,
    'laboratory_28_lab_eng'::text,
    'laboratory_103_lab'::text,
    'laboratory_105_lab_hidraulica'::text,
    'laboratory_106_lab_informatica'::text
  ])
);