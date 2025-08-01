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

    console.log('Processing reservation notification:', { reservationData, userName, userEmail, action });

    // Buscar emails de notificação ativos
    const { data: emailList, error: emailError } = await supabase
      .from('admin_notification_emails')
      .select('email')
      .eq('is_active', true);

    if (emailError) {
      console.error('Error fetching notification emails:', emailError);
      throw new Error('Failed to fetch notification emails');
    }

    if (!emailList || emailList.length === 0) {
      console.log('No active notification emails found');
      return new Response(JSON.stringify({ message: 'No active notification emails' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

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
          return type.startsWith('laboratory_') ? 'Laboratório' : type;
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

    // Formatar horários para auditório
    const formatTimeSlots = (slots?: string[]) => {
      if (!slots || slots.length === 0) return '';
      return slots.map(slot => {
        const [start, end] = slot.split('-');
        return `${start}h às ${end}h`;
      }).join(', ');
    };

    const equipmentLabel = getEquipmentLabel(reservationData.equipment_type);
    const formattedDate = formatDate(reservationData.reservation_date);
    const actionText = action === 'created' ? 'CRIADA' : 'CANCELADA';
    const actionColor = action === 'created' ? '#22c55e' : '#ef4444';

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
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
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Equipamento:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${equipmentLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Data:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${formattedDate}</td>
              </tr>
              ${reservationData.time_slots && reservationData.time_slots.length > 0 ? `
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
            <p style="margin: 5px 0; color: #64748b;"><strong>Email:</strong> ${userEmail}</p>
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

    // Enviar emails para todos os administradores
    const emailPromises = emailList.map(({ email }) => 
      resend.emails.send({
        from: "Sistema de Reservas FTEC <noreply@resend.dev>",
        to: [email],
        subject: `🔔 Reserva ${actionText} - ${equipmentLabel} em ${formattedDate}`,
        html: emailHtml,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    console.log(`Email notifications sent - Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      emailsSent: successCount,
      emailsFailed: failureCount 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-reservation-notification function:", error);
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