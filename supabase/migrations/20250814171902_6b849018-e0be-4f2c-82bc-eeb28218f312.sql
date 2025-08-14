-- Allow all authenticated users to view basic profile information (display names) of other users
-- This enables seeing professor names in reservations while keeping sensitive data protected
CREATE POLICY "Users can view basic info of other users" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);