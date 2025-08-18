import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReservationNotificationRequest {
  reservationData: {
    id: string;
    equipment_type: string;
    reservation_date: string;
    observation?: string;
    time_slots?: string[];
    user_id: string;
  };
  userName: string;
  userEmail: string;
  action: 'created' | 'cancelled';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reservationData, userName, userEmail, action }: ReservationNotificationRequest = await req.json();

    console.log('🔔 [RESERVATION NOTIFICATION] Processing:', { 
      reservationId: reservationData.id, 
      equipmentType: reservationData.equipment_type, 
      action,
      userEmail 
    });

    // Buscar o email correto do usuário dono da reserva
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(reservationData.user_id);
    
    let actualUserEmail = userEmail; // usar o email passado como fallback
    
    if (!userError && user?.email) {
      actualUserEmail = user.email; // usar o email correto do usuário
      console.log('✅ [EMAIL] Using user email from auth:', actualUserEmail);
    } else {
      console.warn('⚠️ [EMAIL] Could not fetch user email from auth, using provided email:', userError);
      console.log('📧 [EMAIL] Using fallback email:', actualUserEmail);
    }

    // Determinar qual tipo de notificação é necessário baseado no equipamento
    const equipmentType = reservationData.equipment_type;
    let notificationColumn = '';
    
    if (equipmentType === 'projector') {
      notificationColumn = 'notify_projector';
    } else if (equipmentType === 'speaker') {
      notificationColumn = 'notify_speaker';
    } else if (equipmentType.startsWith('laboratory_')) {
      notificationColumn = 'notify_laboratory';
    } else if (equipmentType === 'auditorium') {
      notificationColumn = 'notify_auditorium';
    } else {
      notificationColumn = 'notify_projector'; // fallback
    }

    // Buscar emails de notificação ativos para este tipo de equipamento - com logs detalhados
    console.log('🔍 [DATABASE] Fetching active notification emails for equipment:', equipmentType, 'using column:', notificationColumn);
    const { data: emailList, error: emailError } = await supabase
      .from('admin_notification_emails')
      .select(`email, is_active, id, ${notificationColumn}`)
      .eq('is_active', true)
      .eq(notificationColumn, true);

    console.log('📊 [DATABASE] Email query result:', { 
      emailCount: emailList?.length || 0,
      emails: emailList?.map(e => ({ email: e.email, id: e.id })) || [],
      error: emailError 
    });

    if (emailError) {
      console.error('❌ [DATABASE] Error fetching notification emails:', emailError);
      throw new Error('Failed to fetch notification emails');
    }

    if (!emailList || emailList.length === 0) {
      console.log('⚠️ [DATABASE] No active notification emails found');
      return new Response(JSON.stringify({ message: 'No active notification emails' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    console.log(`✅ [DATABASE] Found ${emailList.length} active notification emails`);

    // Formatar tipo de equipamento
    const getEquipmentLabel = (type: string) => {
      switch (type) {
        case 'projector':
          return 'Projetor';
        case 'speaker':
          return 'Caixa de Som';
        case 'auditorium':
          return 'Auditório';
        default:
          if (type.startsWith('laboratory_')) {
            // Extrair o nome do laboratório do código
            const parts = type.split('_');
            if (parts.length >= 3) {
              // Formato: laboratory_XX_nome_do_lab
              const labName = parts.slice(2).join(' ').replace(/_/g, ' ');
              const labNumber = parts[1];
              return `Laboratório ${labNumber} - ${labName.charAt(0).toUpperCase() + labName.slice(1)}`;
            }
            return 'Laboratório';
          }
          return type;
      }
    };

    // Formatar data
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Formatar horários para auditório - mapear valores para labels exatos
    const formatTimeSlots = (slots?: string[]) => {
      if (!slots || slots.length === 0) return '';
      
      const timeSlotLabels: Record<string, string> = {
        'morning': 'Manhã - 09h/12h',
        'afternoon': 'Tarde - 13h/18h', 
        'evening': 'Noite - 19h/22h'
      };
      
      return slots.map(slot => timeSlotLabels[slot] || slot).join(', ');
    };

    const equipmentLabel = getEquipmentLabel(reservationData.equipment_type);
    const formattedDate = formatDate(reservationData.reservation_date);
    const actionText = action === 'created' ? 'CRIADA' : 'CANCELADA';
    const actionColor = action === 'created' ? '#22c55e' : '#ef4444';

    const emailEmoji = action === 'created' ? '✅' : '❌';

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: #1e3a8a; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Sistema de Reservas</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">FTEC - Faculdade de Tecnologia</p>
        </div>
        
        <div style="padding: 40px 30px;">
          <div style="background-color: ${actionColor}; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: bold;">RESERVA ${actionText}</h2>
          </div>
          
          <div style="background-color: #f8fafc; padding: 25px; border-radius: 12px; border-left: 4px solid #667eea;">
            <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px;">Detalhes da Reserva</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Local/Equipamento:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${equipmentLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Data:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${formattedDate}</td>
              </tr>
              ${reservationData.equipment_type === 'auditorium' && reservationData.time_slots && reservationData.time_slots.length > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Horários:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${formatTimeSlots(reservationData.time_slots)}</td>
              </tr>
              ` : ''}
              ${reservationData.observation ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Observação:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${reservationData.observation}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">ID da Reserva:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 500; font-family: monospace;">${reservationData.id.substring(0, 8)}...</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin-top: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">Dados do Usuário</h3>
            <p style="margin: 5px 0; color: #64748b;"><strong>Nome:</strong> ${userName}</p>
            ${actualUserEmail && !actualUserEmail.includes('@temp.com') ? `<p style="margin: 5px 0; color: #64748b;"><strong>Email:</strong> ${actualUserEmail}</p>` : ''}
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Esta é uma notificação automática do Sistema de Reservas FTEC.<br>
              ${new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </div>
    `;

    // Enviar emails para todos os administradores com logs detalhados
    // RESPEITANDO O RATE LIMIT DO RESEND (2 emails/segundo)
    console.log('📨 [EMAIL] Preparing to send emails sequentially...');
    
    const results: any[] = [];
    
    for (let i = 0; i < emailList.length; i++) {
      const { email } = emailList[i];
      console.log(`📧 [EMAIL ${i + 1}/${emailList.length}] Sending to: ${email}`);
      
      try {
        const result = await resend.emails.send({
          from: "Sistema de Reservas FTEC <noreply@unidadepoazn.app>",
          to: [email],
          subject: `${emailEmoji} Reserva ${actionText} - ${equipmentLabel} em ${formattedDate}`,
          html: emailHtml,
        });
        
        results.push({ status: 'fulfilled', value: result });
        console.log(`✅ [EMAIL ${i + 1}] SUCCESS for ${email}`);
        console.log(`📊 [EMAIL ${i + 1}] Response:`, result);
        
        // Aguardar 600ms entre envios para respeitar rate limit (2/segundo)
        if (i < emailList.length - 1) {
          console.log(`⏳ [EMAIL] Waiting 600ms before next email...`);
          await new Promise(resolve => setTimeout(resolve, 600));
        }
        
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
        console.error(`❌ [EMAIL ${i + 1}] FAILED for ${email}:`, error);
      }
    }

    console.log(`🚀 [EMAIL] Completed sending ${emailList.length} emails sequentially`);
    
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    // Log dos resultados detalhados
    results.forEach((result, index) => {
      const emailAddress = emailList[index].email;
      if (result.status === 'rejected') {
        console.error(`❌ [EMAIL ${index + 1}] FAILED for ${emailAddress}:`, result.reason);
      } else {
        console.log(`✅ [EMAIL ${index + 1}] SUCCESS for ${emailAddress}`);
        console.log(`📊 [EMAIL ${index + 1}] Response:`, result.value);
      }
    });

    console.log(`📈 [SUMMARY] Emails sent - Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      emailsSent: successCount,
      emailsFailed: failureCount,
      emailDetails: emailList.map((email, index) => ({
        email: email.email,
        status: results[index].status,
        error: results[index].status === 'rejected' ? results[index].reason : null
      }))
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("❌ [ERROR] In send-reservation-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);