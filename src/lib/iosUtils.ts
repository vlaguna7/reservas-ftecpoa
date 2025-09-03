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
    // Desabilitar refresh automático de token no iOS Safari por problemas conhecidos
    autoRefreshToken: !isIOSDevice,
    // Usar sessionStorage como fallback no iOS
    storage: isIOSDevice ? sessionStorage : localStorage,
    // Timeout menor para iOS
    networkTimeout: isIOSDevice ? 8000 : 15000,
    // Retry menos agressivo no iOS
    maxRetries: isIOSDevice ? 2 : 3,
  };
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