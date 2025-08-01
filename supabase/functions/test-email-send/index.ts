import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🧪 [TEST] Starting email test...');

    // Buscar emails ativos
    const { data: emailList, error: emailError } = await supabase
      .from('admin_notification_emails')
      .select('email, is_active, id')
      .eq('is_active', true);

    console.log('📋 [TEST] Email list:', emailList);

    if (emailError || !emailList || emailList.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No emails found',
        emailError 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Testar envio para cada email
    const testResults = [];

    for (let i = 0; i < emailList.length; i++) {
      const email = emailList[i].email;
      console.log(`📧 [TEST ${i + 1}] Sending test email to: ${email}`);
      
      try {
        const result = await resend.emails.send({
          from: "Teste Sistema FTEC <noreply@resend.dev>",
          to: [email],
          subject: "🧪 Teste de Email - Sistema de Reservas FTEC",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1e3a8a;">Teste de Email</h1>
              <p>Este é um email de teste do Sistema de Reservas FTEC.</p>
              <p><strong>Email de destino:</strong> ${email}</p>
              <p><strong>Horário do teste:</strong> ${new Date().toLocaleString('pt-BR')}</p>
              <p>Se você recebeu este email, a configuração está funcionando corretamente!</p>
            </div>
          `,
        });
        
        console.log(`✅ [TEST ${i + 1}] SUCCESS for ${email}:`, result);
        testResults.push({
          email,
          status: 'success',
          result: result
        });
      } catch (error) {
        console.error(`❌ [TEST ${i + 1}] FAILED for ${email}:`, error);
        testResults.push({
          email,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log('📊 [TEST] Final results:', testResults);

    return new Response(JSON.stringify({ 
      success: true,
      emailsFound: emailList.length,
      testResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [TEST] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);