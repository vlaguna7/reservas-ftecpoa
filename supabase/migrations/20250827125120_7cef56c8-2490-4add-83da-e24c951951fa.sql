-- Create enum for user status
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected');

-- Add approval columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN status user_status NOT NULL DEFAULT 'pending',
ADD COLUMN approved_by uuid,
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN rejection_reason text;

-- Update existing users to be approved automatically
UPDATE public.profiles SET status = 'approved', approved_at = now() WHERE status = 'pending';

-- Update RLS policies to block pending users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view their own profile data" ON public.profiles;

-- Only approved users can access their own profile
CREATE POLICY "Approved users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id AND status = 'approved');

-- Only approved users can update their profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Approved users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'approved');

-- Update reservations policies to only allow approved users
DROP POLICY IF EXISTS "Users can view their own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can create their own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can delete their own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can view reservation availability data" ON public.reservations;

CREATE POLICY "Approved users can view their own reservations" 
ON public.reservations 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.status = 'approved'
  )
);

CREATE POLICY "Approved users can create reservations" 
ON public.reservations 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.status = 'approved'
  )
);

CREATE POLICY "Approved users can delete their reservations" 
ON public.reservations 
FOR DELETE 
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.status = 'approved'
  )
);

CREATE POLICY "Approved users can view availability data" 
ON public.reservations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.status = 'approved'
  )
);

-- Create function to get user approval status
CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT status::text FROM profiles WHERE user_id = p_user_id;
$function$;

-- Create audit log for approval changes
CREATE TABLE IF NOT EXISTS public.user_approval_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_status user_status,
  new_status user_status NOT NULL,
  approved_by uuid,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.user_approval_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view approval audit" 
ON public.user_approval_audit 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.user_approval_audit (
      user_id, 
      old_status, 
      new_status, 
      approved_by,
      reason
    ) VALUES (
      NEW.user_id,
      OLD.status,
      NEW.status,
      NEW.approved_by,
      NEW.rejection_reason
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for status change logging
DROP TRIGGER IF EXISTS user_status_change_audit ON public.profiles;
CREATE TRIGGER user_status_change_audit
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();