-- Fix RLS policy for admin deletion to avoid infinite recursion
-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

-- Create new policy using the existing is_admin function to avoid recursion
CREATE POLICY "Admins can delete any profile" 
ON public.profiles 
FOR DELETE 
USING (public.is_admin(auth.uid()));

-- Also fix the update policy for consistency
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (public.is_admin(auth.uid()));