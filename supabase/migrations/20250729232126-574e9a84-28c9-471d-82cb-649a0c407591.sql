-- Fix infinite recursion in profiles policies
-- Remove the problematic admin policy and create a better approach

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE profiles.user_id = $1), 
    false
  );
$$;

-- Create new admin policy using the security definer function
CREATE POLICY "Admins can view all profiles using function"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Also allow checking for existing institutional users during signup (anonymous access)
CREATE POLICY "Allow checking existing institutional users"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Allow authenticated users to check for existing users during signup verification
CREATE POLICY "Allow checking existing users for signup"
ON public.profiles  
FOR SELECT
TO authenticated
USING (true);