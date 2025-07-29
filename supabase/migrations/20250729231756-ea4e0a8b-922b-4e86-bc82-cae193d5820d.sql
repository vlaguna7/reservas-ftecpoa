-- Fix signup process by allowing profile creation even with unconfirmed emails
-- and disable the need for email confirmation in the application flow

-- Create a function to handle user signup and profile creation
CREATE OR REPLACE FUNCTION public.handle_signup_with_profile(
  p_display_name text,
  p_institutional_user text,
  p_pin_hash text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert profile directly
  INSERT INTO public.profiles (
    user_id,
    display_name,
    institutional_user,
    pin_hash
  ) VALUES (
    p_user_id,
    p_display_name,
    p_institutional_user,
    p_pin_hash
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_signup_with_profile TO authenticated;

-- Allow profile insertion for signup process
CREATE POLICY "Allow profile creation during signup"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (true);