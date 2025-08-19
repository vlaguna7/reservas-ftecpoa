-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para processar emails agendados a cada minuto
SELECT cron.schedule(
  'process-scheduled-emails',
  '* * * * *', -- A cada minuto
  $$
  SELECT
    net.http_post(
        url:='https://frkqhvdsrjuxgcfjbtsp.supabase.co/functions/v1/schedule-email-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZya3FodmRzcmp1eGdjZmpidHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4Mjg2NjUsImV4cCI6MjA2OTQwNDY2NX0.SlEZUyfyvPWfFT3fLIT_BljVtHkD1W0TYtvsJn17aR8"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);