// ===== UTILITÁRIOS PARA iOS SAFARI =====
// Funções específicas para lidar com problemas conhecidos do iOS Safari

/**
 * Detecta se está rodando no iOS Safari
 */
export const isIOSSafari = (): boolean => {
  const userAgent = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
};

/**
 * Detecta se está rodando no iOS (qualquer browser)
 */
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * Limpa todos os dados de autenticação específicos para iOS
 */
export const clearIOSAuthData = (): void => {
  try {
    // Limpar localStorage
    localStorage.clear();
    
    // Limpar sessionStorage (importante no iOS)
    sessionStorage.clear();
    
    // Remover cookies relacionados à autenticação
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    console.log('🍎 iOS: Dados de autenticação limpos');
  } catch (error) {
    console.log('🍎 iOS: Erro ao limpar dados:', error);
  }
};

/**
 * Configurações específicas para iOS Safari
 */
export const getIOSSafeConfig = () => {
  const isIOSDevice = isIOSSafari();
  
  return {
    // HABILITAR refresh automático de token no iOS Safari - correção crítica
    autoRefreshToken: true,
    // Usar storage híbrido no iOS
    storage: isIOSDevice ? createIOSHybridStorage() : localStorage,
    // Timeout otimizado para iOS
    networkTimeout: isIOSDevice ? 10000 : 15000,
    // Retry mais robusto no iOS
    maxRetries: isIOSDevice ? 3 : 3,
  };
};

/**
 * Storage híbrido para iOS que usa localStorage + sessionStorage
 */
export const createIOSHybridStorage = () => {
  return {
    getItem: (key: string) => {
      try {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
      } catch {
        return sessionStorage.getItem(key);
      }
    },
    setItem: (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
        sessionStorage.setItem(key, value); // Backup
      } catch {
        sessionStorage.setItem(key, value);
      }
    },
    removeItem: (key: string) => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch {
        sessionStorage.removeItem(key);
      }
    }
  };
};

/**
 * Força refresh de token se está próximo do vencimento
 */
export const forceTokenRefreshIfNeeded = async (supabase: any): Promise<void> => {
  if (!isIOSSafari()) return;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Calcular se token expira em menos de 5 minutos
    const expiresAt = session.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry < 300) { // Menos de 5 minutos
      logIOS('Forçando refresh de token preventivo');
      await supabase.auth.refreshSession();
    }
  } catch (error) {
    logIOS('Erro no refresh preventivo de token:', error);
  }
};

/**
 * Log seguro que só aparece em iOS para debug
 */
export const logIOS = (message: string, data?: any): void => {
  if (isIOSSafari()) {
    console.log(`🍎 iOS Safari: ${message}`, data || '');
  }
};

/**
 * Força reload da página de forma segura no iOS
 */
export const safeReloadIOS = (): void => {
  if (isIOSSafari()) {
    // No iOS Safari, usar location.replace é mais confiável
    window.location.replace(window.location.href);
  } else {
    window.location.reload();
  }
};

/**
 * Detecta se está em PWA/standalone no iOS
 */
export const isIOSPWA = (): boolean => {
  return isIOS() && (window.navigator as any).standalone === true;
};