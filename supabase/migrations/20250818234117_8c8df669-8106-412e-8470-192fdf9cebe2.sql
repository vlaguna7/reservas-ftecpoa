-- Add notification preference columns to admin_notification_emails table
ALTER TABLE admin_notification_emails 
ADD COLUMN notify_projector BOOLEAN DEFAULT true,
ADD COLUMN notify_speaker BOOLEAN DEFAULT true,
ADD COLUMN notify_laboratory BOOLEAN DEFAULT true,
ADD COLUMN notify_auditorium BOOLEAN DEFAULT true;