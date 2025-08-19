import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  recipientIds?: string[];
  subject: string;
  content: string;
  sendToAll?: boolean;
  department?: string;
  isManual?: boolean;
  scheduledEmailId?: string;
}

// Rate limiting configuration
const RATE_LIMITS = {
  // Resend free tier: 100 emails/day, 3000/month
  MAX_EMAILS_PER_BATCH: 10,
  DELAY_BETWEEN_EMAILS: 1000, // 1 second between emails
  MAX_RETRIES: 3,
  BACKOFF_MULTIPLIER: 2,
};

class EmailRateLimiter {
  private emailsSent = 0;
  private startTime = Date.now();

  async waitForRateLimit() {
    // Add progressive delay based on batch size
    const delay = Math.min(
      RATE_LIMITS.DELAY_BETWEEN_EMAILS * (1 + this.emailsSent * 0.1),
      5000 // Max 5 seconds
    );
    
    console.log(`⏱️ [RATE LIMIT] Waiting ${delay}ms before next email (sent: ${this.emailsSent})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  incrementCounter() {
    this.emailsSent++;
  }

  getStats() {
    const elapsed = Date.now() - this.startTime;
    const rate = this.emailsSent / (elapsed / 1000);
    return {
      emailsSent: this.emailsSent,
      elapsedMs: elapsed,
      ratePerSecond: rate.toFixed(2)
    };
  }
}

async function sendSingleEmail(
  resend: Resend,
  email: string,
  subject: string,
  content: string,
  attempt = 1
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await resend.emails.send({
      from: "Sistema de Reservas <noreply@unidadepoazn.app>",
      to: [email],
      subject: subject,
      html: content,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return { success: true, id: response.data?.id };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    
    // Check if it's a rate limit error
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      if (attempt <= RATE_LIMITS.MAX_RETRIES) {
        const delay = RATE_LIMITS.DELAY_BETWEEN_EMAILS * RATE_LIMITS.BACKOFF_MULTIPLIER * attempt;
        console.log(`🔄 [RETRY ${attempt}] Rate limited, waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return sendSingleEmail(resend, email, subject, content, attempt + 1);
      }
    }

    return { success: false, error: errorMessage };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const rateLimiter = new EmailRateLimiter();

    const { recipientIds, subject, content, sendToAll, department, isManual, scheduledEmailId }: EmailRequest = await req.json();

    console.log(`📧 [BULK EMAIL] Starting bulk email send - sendToAll: ${sendToAll}, department: ${department}, manual: ${isManual}`);

    // Fetch recipient emails
    let query = supabase
      .from("teacher_emails")
      .select("id, name, email, department")
      .eq("is_active", true);

    if (!sendToAll) {
      if (recipientIds && recipientIds.length > 0) {
        query = query.in("id", recipientIds);
      } else if (department) {
        query = query.eq("department", department);
      }
    }

    const { data: teachers, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch recipients: ${fetchError.message}`);
    }

    if (!teachers || teachers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active recipients found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 [RECIPIENTS] Found ${teachers.length} active recipients`);

    // Batch processing for large lists
    const batches = [];
    for (let i = 0; i < teachers.length; i += RATE_LIMITS.MAX_EMAILS_PER_BATCH) {
      batches.push(teachers.slice(i, i + RATE_LIMITS.MAX_EMAILS_PER_BATCH));
    }

    console.log(`📦 [BATCHING] Processing ${batches.length} batches of max ${RATE_LIMITS.MAX_EMAILS_PER_BATCH} emails`);

    let successCount = 0;
    let failureCount = 0;
    const results: any[] = [];

    // Process batches sequentially to respect rate limits
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔄 [BATCH ${batchIndex + 1}/${batches.length}] Processing ${batch.length} emails`);

      // Process emails in batch sequentially
      for (let emailIndex = 0; emailIndex < batch.length; emailIndex++) {
        const teacher = batch[emailIndex];
        
        // Apply rate limiting before each email
        if (rateLimiter.emailsSent > 0) {
          await rateLimiter.waitForRateLimit();
        }

        console.log(`📧 [EMAIL ${rateLimiter.emailsSent + 1}] Sending to: ${teacher.email}`);

        const result = await sendSingleEmail(resend, teacher.email, subject, content);
        rateLimiter.incrementCounter();

        // Log the result to database
        const logStatus = result.success ? 'sent' : 'failed';
        await supabase.from("email_logs").insert({
          email: teacher.email,
          subject: subject,
          status: logStatus,
          error_message: result.error || null,
          scheduled_email_id: scheduledEmailId || null,
          is_manual: isManual || false
        });

        if (result.success) {
          successCount++;
          console.log(`✅ [SUCCESS] Email sent to ${teacher.email} - ID: ${result.id}`);
        } else {
          failureCount++;
          console.log(`❌ [FAILED] Email to ${teacher.email} - Error: ${result.error}`);
        }

        results.push({
          email: teacher.email,
          name: teacher.name,
          success: result.success,
          id: result.id,
          error: result.error
        });
      }

      // Add delay between batches
      if (batchIndex < batches.length - 1) {
        const batchDelay = RATE_LIMITS.DELAY_BETWEEN_EMAILS * 2;
        console.log(`⏸️ [BATCH DELAY] Waiting ${batchDelay}ms before next batch`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    const stats = rateLimiter.getStats();
    console.log(`📈 [COMPLETED] Success: ${successCount}, Failed: ${failureCount}, Rate: ${stats.ratePerSecond}/s`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: teachers.length,
          sent: successCount,
          failed: failureCount,
          ratePerSecond: stats.ratePerSecond,
          elapsedMs: stats.elapsedMs
        },
        results: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("❌ [ERROR] Bulk email send failed:", error);
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