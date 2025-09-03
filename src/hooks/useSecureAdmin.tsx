import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { isIOSSafari, logIOS } from '@/lib/iosUtils';

interface AdminValidationResult {
  isValid: boolean;
  userId?: string;
  timestamp?: string;
  riskScore?: number;
  isSuspicious?: boolean;
  validationToken?: string;
  blocked?: boolean;
  error?: string;
}

export const useSecureAdmin = () => {
  const { user, signOut } = useAuth();
  const [isValidAdmin, setIsValidAdmin] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [lastValidation, setLastValidation] = useState<number>(0);
  const validationIntervalRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  // Função para validar acesso admin no servidor
  const validateAdminAccess = async (): Promise<AdminValidationResult> => {
    if (!user) {
      logIOS('Admin validation failed: No user session');
      return { isValid: false, error: 'No user session' };
    }

    try {
      console.log('🔐 Validating admin access for user:', user.id);
      logIOS('Starting admin validation', { userId: user.id });
      
      // Para iOS Safari, tentar múltiplas vezes obter o token
      let sessionToken = null;
      let retryCount = 0;
      const maxRetries = isIOSSafari() ? 3 : 1;
      
      while (!sessionToken && retryCount < maxRetries) {
        const sessionResult = await supabase.auth.getSession();
        sessionToken = sessionResult.data.session?.access_token;
        
        if (!sessionToken && isIOSSafari()) {
          logIOS(`Token attempt ${retryCount + 1}/${maxRetries} failed, retrying...`);
          // Pequena pausa para iOS Safari
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        retryCount++;
      }
      
      if (!sessionToken) {
        logIOS('Failed to get session token after retries');
        return { isValid: false, error: 'No access token available' };
      }
      
      logIOS('Got session token, making admin validation request');
      
      const { data, error } = await supabase.functions.invoke('admin-access-validator', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (error) {
        console.error('❌ Admin validation error:', error);
        logIOS('Admin validation error', error);
        return { isValid: false, error: error.message };
      }

      console.log('✅ Admin validation result:', data);
      logIOS('Admin validation successful', data);
      return data as AdminValidationResult;
    } catch (error) {
      console.error('❌ Exception in admin validation:', error);
      logIOS('Exception in admin validation', error);
      return { isValid: false, error: 'Validation failed' };
    }
  };

  // Função para detectar DevTools (opcional - pode ser removida se solicitado)
  const detectDevTools = (): boolean => {
    const start = performance.now();
    debugger; // Esta linha para quando DevTools está aberto
    const end = performance.now();
    
    // Se DevTools estiver aberto, haverá uma pausa significativa
    return (end - start) > 100;
  };

  // Função para logout de segurança
  const securityLogout = async (reason: string) => {
    console.warn('🚨 Security logout triggered:', reason);
    
    // Log da ação de segurança
    try {
      await supabase.from('security_audit_log').insert({
        user_id: user?.id,
        action: 'security_logout',
        details: { reason, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Failed to log security action:', error);
    }

    toast.error(`Sessão encerrada: ${reason}`);
    await signOut();
  };

  // Validação inicial e configuração de intervalos
  useEffect(() => {
    if (!user) {
      setIsValidAdmin(false);
      setIsValidating(false);
      return;
    }

    const runInitialValidation = async () => {
      setIsValidating(true);
      const result = await validateAdminAccess();
      
      if (result.blocked) {
        await securityLogout('Atividade suspeita detectada');
        return;
      }

      if (!result.isValid) {
        await securityLogout('Acesso administrativo negado');
        return;
      }

      setIsValidAdmin(true);
      setLastValidation(Date.now());
      setIsValidating(false);

      // Configurar validação contínua a cada 2 minutos (reduzir logs)
      heartbeatIntervalRef.current = setInterval(async () => {
        const heartbeatResult = await validateAdminAccess();
        
        // Para iOS Safari, ser mais tolerante com falhas temporárias
        if (isIOSSafari() && (!heartbeatResult.isValid && !heartbeatResult.blocked)) {
          logIOS('Heartbeat validation failed, but not blocking on iOS', heartbeatResult);
          // No iOS Safari, não invalidar imediatamente - pode ser problema temporário de rede
          return;
        }
        
        // Só fazer logout se realmente bloqueado por atividade suspeita
        if (heartbeatResult.blocked) {
          await securityLogout('Atividade suspeita detectada');
          return;
        }

        // Se não é válido mas não bloqueado, apenas marcar como inválido
        // O AdminGuard vai mostrar "acesso negado" sem derrubar a sessão
        if (!heartbeatResult.isValid) {
          setIsValidAdmin(false);
          return;
        }

        // Tudo ok, manter válido
        setIsValidAdmin(true);
        setLastValidation(Date.now());
      }, isIOSSafari() ? 180000 : 120000); // 3 minutos para iOS Safari, 2 minutos para outros

      // Opcional: Detecção de DevTools (pode ser removida)
      validationIntervalRef.current = setInterval(() => {
        if (detectDevTools()) {
          console.warn('🔧 DevTools detected - this could be removed if requested');
          // Comentado para não fazer logout automático por DevTools
          // securityLogout('Ferramentas de desenvolvimento detectadas');
        }
      }, 5000);
    };

    runInitialValidation();

    return () => {
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [user]);

  // Função para revalidar manualmente
  const revalidateAccess = async (): Promise<boolean> => {
    const result = await validateAdminAccess();
    
    if (!result.isValid || result.blocked) {
      setIsValidAdmin(false);
      return false;
    }
    
    setIsValidAdmin(true);
    setLastValidation(Date.now());
    return true;
  };

  return {
    isValidAdmin,
    isValidating,
    lastValidation,
    validateAdminAccess,
    revalidateAccess,
    securityLogout,
  };
};