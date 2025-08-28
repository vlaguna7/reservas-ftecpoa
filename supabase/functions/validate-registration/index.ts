import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationRequest {
  institutional_user: string;
  display_name: string;
  pin: string;
  user_agent?: string;
  ip_address?: string;
}

interface ValidationResponse {
  success: boolean;
  canRegister: boolean;
  requiresCaptcha: boolean;
  message: string;
  reason?: string;
  blockedUntil?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract IP address from various headers
    const getClientIP = (request: Request): string => {
      const xForwardedFor = request.headers.get('x-forwarded-for');
      const xRealIP = request.headers.get('x-real-ip');
      const cfConnectingIP = request.headers.get('cf-connecting-ip');
      
      if (xForwardedFor) {
        // Get first IP from comma-separated list
        return xForwardedFor.split(',')[0].trim();
      }
      if (xRealIP) return xRealIP;
      if (cfConnectingIP) return cfConnectingIP;
      
      // Fallback - should not happen in production
      return '127.0.0.1';
    };

    const { institutional_user, display_name, pin, user_agent }: RegistrationRequest = await req.json();
    const clientIP = getClientIP(req);
    const userAgent = user_agent || req.headers.get('user-agent') || '';

    console.log(`Registration validation for IP: ${clientIP}, User: ${institutional_user}`);

    // 1. Validar dados básicos
    if (!institutional_user || !display_name || !pin) {
      return new Response(JSON.stringify({
        success: false,
        canRegister: false,
        requiresCaptcha: false,
        message: 'Dados obrigatórios não fornecidos'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // 2. Verificar se usuário já existe
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('institutional_user')
      .eq('institutional_user', institutional_user.toLowerCase().trim())
      .maybeSingle();

    if (userCheckError) {
      console.error('Error checking existing user:', userCheckError);
      return new Response(JSON.stringify({
        success: false,
        canRegister: false,
        requiresCaptcha: false,
        message: 'Erro interno do sistema'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }

    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        canRegister: false,
        requiresCaptcha: false,
        message: 'Usuário institucional já cadastrado'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 3. Verificar limite por IP
    const { data: ipCheck, error: ipError } = await supabase
      .rpc('check_ip_registration_limit', { p_ip_address: clientIP });

    if (ipError) {
      console.error('Error checking IP limit:', ipError);
      return new Response(JSON.stringify({
        success: false,
        canRegister: false,
        requiresCaptcha: false,
        message: 'Erro interno do sistema'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }

    const ipData = ipCheck as any;
    console.log('IP check result:', ipData);

    // 4. Verificar padrões de fraude
    const { data: fraudCheck, error: fraudError } = await supabase
      .rpc('detect_ip_fraud_patterns', { p_ip_address: clientIP });

    if (fraudError) {
      console.error('Error checking fraud patterns:', fraudError);
    }

    const fraudData = (fraudCheck as any) || { risk_level: 'low', fraud_score: 0 };
    console.log('Fraud check result:', fraudData);

    // 5. Determinar se pode registrar e se precisa CAPTCHA
    let canRegister = ipData.can_register;
    let requiresCaptcha = false;
    let message = 'Validação concluída';

    if (ipData.is_blocked) {
      canRegister = false;
      message = 'IP temporariamente bloqueado devido a múltiplas tentativas';
    } else if (ipData.reason === 'limit_exceeded') {
      canRegister = false;
      message = 'Limite de cadastros por IP atingido (máximo 3)';
    } else if (ipData.registration_count >= 1 || fraudData.risk_level === 'medium') {
      requiresCaptcha = true;
      message = 'Validação adicional necessária';
    } else if (fraudData.risk_level === 'high') {
      canRegister = false;
      message = 'Atividade suspeita detectada';
    }

    // 6. Log da tentativa (independente do resultado)
    await supabase.rpc('log_registration_attempt', {
      p_ip_address: clientIP,
      p_user_agent: userAgent,
      p_success: false, // Ainda não completou o registro
      p_user_id: null
    });

    const response: ValidationResponse = {
      success: true,
      canRegister,
      requiresCaptcha,
      message,
      reason: ipData.reason,
      blockedUntil: ipData.blocked_until
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(JSON.stringify({
      success: false,
      canRegister: false,
      requiresCaptcha: false,
      message: 'Erro interno do servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});