import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledEmail {
  id: string;
  name: string;
  subject: string;
  content: string;
  target_emails: any;
  schedule_type: string;
  schedule_time: string;
  schedule_days: number[];
  last_sent: string | null;
}

function shouldSendToday(email: ScheduledEmail): boolean {
  // Use Brazil timezone for proper time comparison
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
  const today = brazilTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = brazilTime.toTimeString().substring(0, 5); // HH:MM format
  
  console.log(`🕐 [CHECK] Email "${email.name}" - Current SP time: ${currentTime}, Scheduled: ${email.schedule_time}, Today: ${today}`);

  // Check if current time matches scheduled time (within 1 minute tolerance)
  const [schedHour, schedMin] = email.schedule_time.split(':').map(Number);
  const [currHour, currMin] = currentTime.split(':').map(Number);
  
  const schedMinutes = schedHour * 60 + schedMin;
  const currMinutes = currHour * 60 + currMin;
  
  // Allow 1 minute tolerance
  if (Math.abs(currMinutes - schedMinutes) > 1) {
    console.log(`⏭️ [SKIP] Time mismatch for "${email.name}"`);
    return false;
  }

  // Check if already sent today (using Brazil timezone)
  if (email.last_sent) {
    const lastSent = new Date(email.last_sent);
    const lastSentBrazil = new Date(lastSent.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const today_start = new Date(brazilTime.getFullYear(), brazilTime.getMonth(), brazilTime.getDate());
    
    if (lastSentBrazil >= today_start) {
      console.log(`⏭️ [SKIP] Already sent today for "${email.name}"`);
      return false;
    }
  }

  // Check schedule type
  switch (email.schedule_type) {
    case 'daily':
      console.log(`✅ [DAILY] Will send "${email.name}"`);
      return true;
      
    case 'weekly':
      if (email.schedule_days && email.schedule_days.includes(today)) {
        console.log(`✅ [WEEKLY] Will send "${email.name}" (day ${today})`);
        return true;
      }
      break;
      
    case 'monthly':
      const dayOfMonth = brazilTime.getDate();
      if (email.schedule_days && email.schedule_days.includes(dayOfMonth)) {
        console.log(`✅ [MONTHLY] Will send "${email.name}" (day ${dayOfMonth})`);
        return true;
      }
      break;
      
    case 'custom':
      // Custom logic could be implemented here
      console.log(`⚠️ [CUSTOM] Custom schedule not implemented for "${email.name}"`);
      return false;
  }

  console.log(`⏭️ [SKIP] Schedule criteria not met for "${email.name}"`);
  return false;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`🔍 [SCHEDULER] Checking for scheduled emails to send...`);

    // Fetch active scheduled emails
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("is_active", true);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled emails: ${fetchError.message}`);
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      console.log(`📭 [SCHEDULER] No active scheduled emails found`);
      return new Response(
        JSON.stringify({ message: "No active scheduled emails found", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 [SCHEDULER] Found ${scheduledEmails.length} active scheduled emails`);

    let processedCount = 0;
    const results: any[] = [];

    for (const email of scheduledEmails) {
      try {
        if (shouldSendToday(email)) {
          console.log(`🚀 [SENDING] Triggering bulk send for "${email.name}"`);

          // Call the bulk email function
          const response = await supabase.functions.invoke('send-bulk-email', {
            body: {
              subject: email.subject,
              content: email.content,
              sendToAll: email.target_emails === "all" || !email.target_emails,
              recipientIds: email.target_emails !== "all" ? email.target_emails : undefined,
              isManual: false,
              scheduledEmailId: email.id
            }
          });

          if (response.error) {
            throw new Error(`Bulk email function error: ${response.error.message}`);
          }

          // Update last_sent timestamp
          const { error: updateError } = await supabase
            .from("scheduled_emails")
            .update({ last_sent: new Date().toISOString() })
            .eq("id", email.id);

          if (updateError) {
            console.error(`❌ [ERROR] Failed to update last_sent for "${email.name}":`, updateError);
          }

          processedCount++;
          results.push({
            id: email.id,
            name: email.name,
            status: 'sent',
            response: response.data
          });

          console.log(`✅ [SUCCESS] Scheduled email "${email.name}" sent successfully`);
        } else {
          results.push({
            id: email.id,
            name: email.name,
            status: 'skipped',
            reason: 'Schedule criteria not met'
          });
        }
      } catch (error: any) {
        console.error(`❌ [ERROR] Failed to process scheduled email "${email.name}":`, error);
        results.push({
          id: email.id,
          name: email.name,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`📈 [COMPLETED] Processed ${processedCount} scheduled emails`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total: scheduledEmails.length,
        results: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("❌ [ERROR] Schedule processor failed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
};

serve(handler);