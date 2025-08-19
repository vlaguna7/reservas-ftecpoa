-- Fix foreign key constraint to allow deletion of scheduled emails
-- Drop the existing foreign key constraint
ALTER TABLE email_logs 
DROP CONSTRAINT IF EXISTS email_logs_scheduled_email_id_fkey;

-- Recreate the constraint with CASCADE delete
ALTER TABLE email_logs 
ADD CONSTRAINT email_logs_scheduled_email_id_fkey 
FOREIGN KEY (scheduled_email_id) 
REFERENCES scheduled_emails(id) 
ON DELETE SET NULL;