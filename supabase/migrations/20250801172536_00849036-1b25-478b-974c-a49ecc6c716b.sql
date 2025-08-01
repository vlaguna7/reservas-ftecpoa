-- Create user_viewed_alerts table to track which alerts each user has seen
CREATE TABLE public.user_viewed_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_id UUID NOT NULL REFERENCES public.admin_alerts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, alert_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_viewed_alerts ENABLE ROW LEVEL SECURITY;

-- Users can only see and create their own viewed alert records
CREATE POLICY "Users can view their own viewed alerts" 
ON public.user_viewed_alerts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own viewed alerts" 
ON public.user_viewed_alerts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can view all viewed alerts (for analytics if needed)
CREATE POLICY "Admins can view all viewed alerts" 
ON public.user_viewed_alerts 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create index for better performance on user queries
CREATE INDEX idx_user_viewed_alerts_user_id ON public.user_viewed_alerts(user_id);
CREATE INDEX idx_user_viewed_alerts_alert_id ON public.user_viewed_alerts(alert_id);