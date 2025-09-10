import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isIOSSafari, forceTokenRefreshIfNeeded, logIOS } from '@/lib/iosUtils';

/**
 * Hook especializado para gerenciar sessões no iOS Safari
 * Implementa heartbeat de sessão e retry logic para iOS
 */
export const useIOSSessionManager = () => {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!isIOSSafari()) return;
    
    logIOS('Inicializando gerenciador de sessão iOS');
    
    // Heartbeat de sessão - verifica e renova token a cada 4 minutos
    const startHeartbeat = () => {
      heartbeatRef.current = setInterval(async () => {
        try {
          logIOS('Heartbeat de sessão - verificando token');
          await forceTokenRefreshIfNeeded(supabase);
          
          // Verificar se sessão ainda está válida
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error || !session) {
            logIOS('Sessão inválida detectada no heartbeat');
            clearHeartbeat();
          }
        } catch (error) {
          logIOS('Erro no heartbeat de sessão:', error);
        }
      }, 240000); // 4 minutos
    };
    
    const clearHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
    
    // Retry logic para reconectar sessão perdida
    const handleSessionLoss = async () => {
      try {
        logIOS('Tentando recuperar sessão perdida');
        
        // Tentar refresh da sessão atual
        const { error } = await supabase.auth.refreshSession();
        if (!error) {
          logIOS('Sessão recuperada com sucesso');
          startHeartbeat(); // Reiniciar heartbeat
          return true;
        }
        
        // Se refresh falhou, verificar se há dados de sessão no storage
        const storedSession = localStorage.getItem('supabase.auth.token') || 
                             sessionStorage.getItem('supabase.auth.token');
        
        if (storedSession) {
          logIOS('Tentando restaurar sessão do storage');
          // Tentar getSession novamente
          await supabase.auth.getSession();
          startHeartbeat();
          return true;
        }
        
        return false;
      } catch (error) {
        logIOS('Falha na recuperação de sessão:', error);
        return false;
      }
    };
    
    // Listener para detectar perda de sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' && session === null) {
        logIOS('Logout detectado - tentando recuperar sessão');
        
        // Delay antes de tentar recuperar (evitar loops)
        retryTimeoutRef.current = setTimeout(async () => {
          const recovered = await handleSessionLoss();
          if (!recovered) {
            logIOS('Não foi possível recuperar sessão - redirecionando para login');
          }
        }, 1000);
        
        clearHeartbeat();
      } else if (event === 'SIGNED_IN' && session) {
        logIOS('Login detectado - iniciando heartbeat');
        startHeartbeat();
      }
    });
    
    // Iniciar heartbeat se já estiver logado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        startHeartbeat();
      }
    });
    
    // Cleanup
    return () => {
      clearHeartbeat();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      subscription.unsubscribe();
      logIOS('Gerenciador de sessão iOS finalizado');
    };
  }, []);
  
  return null; // Hook não retorna nada, apenas gerencia sessão
};