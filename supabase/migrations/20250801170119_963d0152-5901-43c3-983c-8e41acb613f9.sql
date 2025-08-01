-- Create admin_alerts table for mini pop-up alerts
CREATE TABLE public.admin_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 5, -- duration in seconds
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for admin alerts
CREATE POLICY "Everyone can view active alerts" 
ON public.admin_alerts 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Only admins can manage alerts" 
ON public.admin_alerts 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_admin_alerts_updated_at
BEFORE UPDATE ON public.admin_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();