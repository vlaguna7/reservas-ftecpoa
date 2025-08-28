-- Atualizar RLS policies para usar a função ultra-segura
-- Substituir todas as policies que usam is_admin() por is_admin_secure_v2()

-- 1. Atualizar policies da tabela profiles
DROP POLICY IF EXISTS "Admins can view all profiles using function" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

CREATE POLICY "Admins can view all profiles ultra secure" 
ON public.profiles 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can update any profile ultra secure" 
ON public.profiles 
FOR UPDATE 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can delete any profile ultra secure" 
ON public.profiles 
FOR DELETE 
USING (is_admin_secure_v2(auth.uid()));

-- 2. Atualizar policies da tabela reservations
DROP POLICY IF EXISTS "Admins can view all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can delete any reservation" ON public.reservations;

CREATE POLICY "Admins can view all reservations ultra secure" 
ON public.reservations 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can delete any reservation ultra secure" 
ON public.reservations 
FOR DELETE 
USING (is_admin_secure_v2(auth.uid()));

-- 3. Atualizar policies da tabela equipment_settings
DROP POLICY IF EXISTS "Only admins can update equipment settings" ON public.equipment_settings;

CREATE POLICY "Only admins can update equipment settings ultra secure" 
ON public.equipment_settings 
FOR UPDATE 
USING (is_admin_secure_v2(auth.uid()));

-- 4. Atualizar policies da tabela laboratory_settings
DROP POLICY IF EXISTS "Only admins can insert laboratory settings" ON public.laboratory_settings;
DROP POLICY IF EXISTS "Only admins can update laboratory settings" ON public.laboratory_settings;
DROP POLICY IF EXISTS "Only admins can delete laboratory settings" ON public.laboratory_settings;

CREATE POLICY "Only admins can insert laboratory settings ultra secure" 
ON public.laboratory_settings 
FOR INSERT 
WITH CHECK (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Only admins can update laboratory settings ultra secure" 
ON public.laboratory_settings 
FOR UPDATE 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Only admins can delete laboratory settings ultra secure" 
ON public.laboratory_settings 
FOR DELETE 
USING (is_admin_secure_v2(auth.uid()));

-- 5. Atualizar policies da tabela faqs
DROP POLICY IF EXISTS "Admins can view all FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can insert FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can update FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can delete FAQs" ON public.faqs;

CREATE POLICY "Admins can view all FAQs ultra secure" 
ON public.faqs 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can insert FAQs ultra secure" 
ON public.faqs 
FOR INSERT 
WITH CHECK (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can update FAQs ultra secure" 
ON public.faqs 
FOR UPDATE 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can delete FAQs ultra secure" 
ON public.faqs 
FOR DELETE 
USING (is_admin_secure_v2(auth.uid()));

-- 6. Atualizar policies da tabela admin_alerts
DROP POLICY IF EXISTS "Only admins can manage alerts" ON public.admin_alerts;

CREATE POLICY "Only admins can manage alerts ultra secure" 
ON public.admin_alerts 
FOR ALL
USING (is_admin_secure_v2(auth.uid()))
WITH CHECK (is_admin_secure_v2(auth.uid()));

-- 7. Atualizar policies das tabelas de auditoria
DROP POLICY IF EXISTS "Only admins can view admin audit logs" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.security_audit_log;
DROP POLICY IF EXISTS "Only admins can view approval audit" ON public.user_approval_audit;
DROP POLICY IF EXISTS "Only admins can view IP control data" ON public.ip_registration_control;
DROP POLICY IF EXISTS "Admins can view all IP history" ON public.user_ip_history;
DROP POLICY IF EXISTS "Admins can view all viewed alerts" ON public.user_viewed_alerts;

CREATE POLICY "Only admins can view admin audit logs ultra secure" 
ON public.admin_audit_log 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can view security audit logs ultra secure" 
ON public.security_audit_log 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Only admins can view approval audit ultra secure" 
ON public.user_approval_audit 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Only admins can view IP control data ultra secure" 
ON public.ip_registration_control 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can view all IP history ultra secure" 
ON public.user_ip_history 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));

CREATE POLICY "Admins can view all viewed alerts ultra secure" 
ON public.user_viewed_alerts 
FOR SELECT 
USING (is_admin_secure_v2(auth.uid()));