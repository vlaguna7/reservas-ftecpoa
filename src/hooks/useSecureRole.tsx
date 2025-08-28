import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'visitor' | 'user' | 'admin';

interface SecureRoleResult {
  role: UserRole;
  isLoading: boolean;
  canMakeReservations: boolean;
  canAccessAdmin: boolean;
  isVerified: boolean;
  refreshRole: () => Promise<void>;
}

export const useSecureRole = (): SecureRoleResult => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [role, setRole] = useState<UserRole>('visitor');
  const [isLoading, setIsLoading] = useState(true);
  const [canMakeReservations, setCanMakeReservations] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [lastVerification, setLastVerification] = useState<number>(0);

  // Verificação contínua a cada 30 segundos
  const VERIFICATION_INTERVAL = 30 * 1000;
  const VERIFICATION_THRESHOLD = 5 * 60 * 1000; // Re-verificar a cada 5 minutos

  const verifyRole = useCallback(async () => {
    if (!user || !session) {
      setRole('visitor');
      setCanMakeReservations(false);
      setCanAccessAdmin(false);
      setIsVerified(true);
      setIsLoading(false);
      return;
    }

    try {
      // Verificação tripla: função segura + profile direto + função de reservas
      const [roleResult, profileResult, reservationResult] = await Promise.all([
        supabase.rpc('get_user_role_secure', { p_user_id: user.id }),
        supabase
          .from('profiles')
          .select('role, status, is_admin')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.rpc('can_make_reservations_secure', { p_user_id: user.id })
      ]);

      if (roleResult.error) {
        console.error('Error getting secure role:', roleResult.error);
        throw new Error('Falha na verificação de permissões');
      }

      if (profileResult.error) {
        console.error('Error getting profile:', profileResult.error);
        throw new Error('Falha ao carregar perfil');
      }

      if (reservationResult.error) {
        console.error('Error checking reservations:', reservationResult.error);
      }

      const secureRole = roleResult.data as UserRole;
      const profile = profileResult.data;
      const canReserve = Boolean(reservationResult.data);

      // Validação cruzada - as informações devem ser consistentes
      if (profile) {
        const expectedRole: UserRole = profile.is_admin ? 'admin' : 
                                      profile.status === 'approved' ? 'user' : 'visitor';
        
        if (secureRole !== expectedRole) {
          console.error('Role mismatch detected:', { secureRole, expectedRole, profile });
          toast({
            title: "Erro de Segurança",
            description: "Inconsistência detectada nas permissões. Faça login novamente.",
            variant: "destructive"
          });
          
          // Auto-logout em caso de inconsistência
          setTimeout(() => {
            supabase.auth.signOut();
          }, 2000);
          return;
        }
      }

      // Verificação adicional para acesso admin
      let adminAccess = false;
      if (secureRole === 'admin') {
        const { data: adminCheck } = await supabase.functions.invoke('admin-dashboard-access', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        adminAccess = adminCheck?.canAccess || false;
      }

      setRole(secureRole);
      setCanMakeReservations(canReserve);
      setCanAccessAdmin(adminAccess);
      setIsVerified(true);
      setLastVerification(Date.now());

    } catch (error) {
      console.error('Role verification failed:', error);
      setRole('visitor');
      setCanMakeReservations(false);
      setCanAccessAdmin(false);
      setIsVerified(false);
      
      toast({
        title: "Erro de Verificação",
        description: "Falha na verificação de permissões. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, session, toast]);

  const refreshRole = useCallback(async () => {
    setIsLoading(true);
    await verifyRole();
  }, [verifyRole]);

  // Verificação inicial e periódica
  useEffect(() => {
    verifyRole();

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastVerification > VERIFICATION_THRESHOLD) {
        verifyRole();
      }
    }, VERIFICATION_INTERVAL);

    return () => clearInterval(interval);
  }, [verifyRole, lastVerification]);

  // Detecção de manipulação do contexto React
  useEffect(() => {
    const detectManipulation = () => {
      // Verificar se React DevTools estão abertos
      if (typeof window !== 'undefined') {
        const devtools = /./;
        devtools.toString = function() {
          toast({
            title: "Atividade Suspeita",
            description: "Ferramentas de desenvolvimento detectadas.",
            variant: "destructive"
          });
          return 'DevTools Detected';
        };
        console.log('%c', devtools);
        
        // Verificar manipulação de variáveis globais
        if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          console.warn('React DevTools detected - security monitoring active');
        }
      }
    };

    const timer = setTimeout(detectManipulation, 1000);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    role,
    isLoading,
    canMakeReservations,
    canAccessAdmin,
    isVerified,
    refreshRole
  };
};