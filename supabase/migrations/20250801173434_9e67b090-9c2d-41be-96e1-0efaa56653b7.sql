-- Add expires_at field to admin_alerts table
ALTER TABLE public.admin_alerts 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for better performance when filtering by expiration
CREATE INDEX idx_admin_alerts_expires_at ON public.admin_alerts(expires_at);

-- Add index for combined filtering (active + expiration)
CREATE INDEX idx_admin_alerts_active_expires ON public.admin_alerts(is_active, expires_at);