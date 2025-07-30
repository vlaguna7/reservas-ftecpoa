-- Atualizar o tipo enum equipment_type para incluir 'laboratory'
DO $$
BEGIN
    -- Verificar se 'laboratory' já existe no enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'laboratory' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'equipment_type')
    ) THEN
        -- Adicionar 'laboratory' ao enum se não existir
        ALTER TYPE equipment_type ADD VALUE 'laboratory';
    END IF;
END$$;