-- Update PIN for user vitor.souza
DO $$
DECLARE
    user_record RECORD;
    new_pin TEXT := '161903';
    new_pin_hash TEXT;
BEGIN
    -- Find the user
    SELECT * INTO user_record FROM public.profiles WHERE institutional_user = 'vitor.souza';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User vitor.souza not found';
    END IF;
    
    -- Generate new PIN hash using bcrypt (simulated with crypt function)
    -- Note: Using a simple hash here since we can't directly use bcrypt in SQL
    -- The application will handle the proper bcrypt hashing
    new_pin_hash := crypt(new_pin, gen_salt('bf', 10));
    
    -- Update the PIN hash in profiles table
    UPDATE public.profiles 
    SET pin_hash = new_pin_hash,
        updated_at = now()
    WHERE institutional_user = 'vitor.souza';
    
    RAISE NOTICE 'PIN updated for user vitor.souza';
END $$;