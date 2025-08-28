import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        canAccess: false,
        message: 'Token de autorização necessário'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        success: false,
        canAccess: false,
        message: 'Token inválido ou expirado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    console.log(`Admin dashboard access check for user: ${user.id}`);

    // Triple validation for admin access
    const { data: canAccess, error: accessError } = await supabase
      .rpc('can_access_admin_dashboard', { p_user_id: user.id });

    if (accessError) {
      console.error('Error checking admin access:', accessError);
      return new Response(JSON.stringify({
        success: false,
        canAccess: false,
        message: 'Erro ao verificar permissões'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Get user profile for additional validation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_admin, status, display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({
        success: false,
        canAccess: false,
        message: 'Erro ao carregar perfil do usuário'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Log admin dashboard access attempt
    await supabase
      .from('admin_audit_log')
      .insert({
        user_id: user.id,
        admin_user_id: user.id,
        action: 'admin_dashboard_access_attempt',
        details: {
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
          user_agent: req.headers.get('user-agent'),
          access_granted: canAccess,
          profile_role: profile?.role,
          profile_admin: profile?.is_admin
        },
        severity: canAccess ? 'medium' : 'high'
      });

    const response = {
      success: true,
      canAccess: Boolean(canAccess),
      message: canAccess ? 'Acesso autorizado' : 'Acesso negado - privilégios insuficientes',
      userProfile: canAccess ? {
        role: profile?.role,
        displayName: profile?.display_name,
        isAdmin: profile?.is_admin
      } : null
    };

    console.log(`Admin access result for ${user.id}: ${canAccess}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin dashboard access error:', error);
    return new Response(JSON.stringify({
      success: false,
      canAccess: false,
      message: 'Erro interno do servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});