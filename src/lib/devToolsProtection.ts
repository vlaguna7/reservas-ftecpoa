// Anti-DevTools Protection System (Versão Não-Intrusiva)
// Este módulo implementa proteções básicas sem bloquear o sistema

class DevToolsProtection {
  private detectionInterval: NodeJS.Timeout | null = null;

  // Initialize basic protection mechanisms
  init() {
    this.disableRightClick();
    this.blockKeyboardShortcuts();
    this.addConsoleWarning();
  }

  // Disable right-click context menu
  private disableRightClick() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.logAttempt('Right-click blocked');
      return false;
    });
  }

  // Block only essential keyboard shortcuts
  private blockKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // F12 - DevTools
      if (e.key === 'F12') {
        e.preventDefault();
        this.logAttempt('F12 blocked');
        return false;
      }

      // Ctrl combinations
      if (e.ctrlKey) {
        // DevTools shortcuts
        if (e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
          e.preventDefault();
          this.logAttempt(`Ctrl+Shift+${e.key.toUpperCase()} blocked`);
          return false;
        }

        // View source
        if (['u', 'U'].includes(e.key)) {
          e.preventDefault(); 
          this.logAttempt(`Ctrl+${e.key.toUpperCase()} blocked`);
          return false;
        }
      }
    });
  }

  // Add console warning
  private addConsoleWarning() {
    console.log('%c🚫 PARE!', 'color: red; font-size: 50px; font-weight: bold;');
    console.log('%cEsta é uma funcionalidade do navegador destinada a desenvolvedores. Se alguém disse para você copiar e colar algo aqui para habilitar um recurso ou "hackear" a conta de alguém, trata-se de uma fraude e dará a essa pessoa acesso à sua conta.', 'color: red; font-size: 16px;');
  }

  // Log security attempts (apenas para auditoria)
  private logAttempt(action: string) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SECURITY] ${action} - ${new Date().toISOString()}`);
    }
  }

  // Cleanup method
  destroy() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }
  }
}

// Export singleton instance
export const devToolsProtection = new DevToolsProtection();

// Auto-initialize in production only
if (process.env.NODE_ENV === 'production') {
  devToolsProtection.init();
}