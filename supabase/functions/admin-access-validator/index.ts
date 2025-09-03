import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ios-safari',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Detect iOS Safari
    const userAgent = req.headers.get('User-Agent') || '';
    const isiOSSafari = req.headers.get('X-iOS-Safari') === 'true';
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('❌ No authorization header provided', { 
        isiOSSafari, 
        isIOSDevice, 
        userAgent: userAgent.substring(0, 100) 
      });
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: 'No authorization provided' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '');
    
    if (isIOSDevice) {
      console.log('🍎 iOS device detected, processing admin validation');
    }
    
    // Get user from JWT with retry for iOS devices
    let user = null;
    let authError = null;
    let retryCount = 0;
    const maxRetries = isIOSDevice ? 2 : 0;
    
    do {
      const result = await supabaseClient.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
      
      if (authError && isIOSDevice && retryCount < maxRetries) {
        console.log(`🍎 iOS: Auth attempt ${retryCount + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      retryCount++;
    } while (authError && isIOSDevice && retryCount <= maxRetries);
    
    if (authError || !user) {
      console.log('❌ Invalid token or user not found:', { 
        error: authError?.message,
        isiOSSafari,
        isIOSDevice,
        retryCount 
      });
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: 'Invalid authentication' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 Validating admin access for user:', user.id, { 
      isiOSSafari, 
      isIOSDevice 
    });

    // Log the admin access check separately (without affecting the function result)
    try {
      await supabaseClient
        .from('security_audit_log')
        .insert({
          user_id: user.id,
          action: 'admin_access_check',
          details: { 
            timestamp: new Date().toISOString(), 
            function: 'admin-access-validator',
            isiOSSafari,
            isIOSDevice,
            userAgent: userAgent.substring(0, 200)
          },
          ip_address: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown'
        });
    } catch (logError) {
      console.warn('⚠️ Failed to log admin access check:', logError);
    }

    // Call our ultra-secure admin verification function
    const { data: isAdminSecure, error: adminError } = await supabaseClient
      .rpc('is_admin_secure_v2', { p_user_id: user.id });

    if (adminError) {
      console.error('❌ Error checking admin status:', adminError);
      
      // Log the failed attempt
      try {
        await supabaseClient
          .from('security_audit_log')
          .insert({
            user_id: user.id,
            action: 'admin_access_denied',
            details: { 
              reason: 'admin_verification_error',
              error: adminError.message,
              timestamp: new Date().toISOString()
            },
            ip_address: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown'
          });
      } catch (logError) {
        console.warn('⚠️ Failed to log admin access denial:', logError);
      }
      
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: 'Admin verification failed' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for privilege escalation attempts
    const { data: riskAnalysis, error: riskError } = await supabaseClient
      .rpc('detect_privilege_escalation', { p_user_id: user.id });

    if (riskError) {
      console.error('❌ Error in risk analysis:', riskError);
    }

    const shouldBlock = riskAnalysis?.should_block || false;
    const isSuspicious = riskAnalysis?.is_suspicious || false;

    // Only block if user is NOT a valid admin AND has suspicious activity
    // Valid admins should never be blocked regardless of risk score
    if (!isAdminSecure && shouldBlock) {
      console.log('🚨 Blocking suspicious admin access attempt from user:', user.id);
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: 'Access blocked due to suspicious activity',
        blocked: true
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = {
      isValid: isAdminSecure === true,
      userId: user.id,
      timestamp: new Date().toISOString(),
      riskScore: riskAnalysis?.risk_score || 0,
      isSuspicious,
      // Generate a temporary validation token (valid for 5 minutes)
      validationToken: isAdminSecure ? btoa(`${user.id}:${Date.now()}:${Math.random()}`) : null
    };

    console.log('✅ Admin validation result:', { 
      userId: user.id, 
      isValid: result.isValid,
      riskScore: result.riskScore 
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in admin-access-validator:', error);
    return new Response(JSON.stringify({ 
      isValid: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});