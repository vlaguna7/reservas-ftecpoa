// Anti-DevTools Protection System com Alertas Visuais
// Este módulo implementa proteções básicas com alertas discretos

class DevToolsProtection {
  private alertContainer: HTMLElement | null = null;

  // Initialize protection mechanisms
  init() {
    this.createAlertContainer();
    this.disableRightClick();
    this.blockKeyboardShortcuts();
    this.addConsoleWarning();
  }

  // Create container for alerts
  private createAlertContainer() {
    this.alertContainer = document.createElement('div');
    this.alertContainer.id = 'devtools-alerts';
    this.alertContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      pointer-events: none;
    `;
    document.body.appendChild(this.alertContainer);
  }

  // Show small red alert
  private showAlert(message: string) {
    if (!this.alertContainer) return;

    const alert = document.createElement('div');
    alert.style.cssText = `
      background: #ff4444;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
      animation: slideIn 0.3s ease-out;
      opacity: 0.95;
    `;

    // Add animation keyframes if not already added
    if (!document.getElementById('devtools-animations')) {
      const style = document.createElement('style');
      style.id = 'devtools-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 0.95;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 0.95;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    alert.textContent = message;
    this.alertContainer.appendChild(alert);

    // Auto remove after 3 seconds
    setTimeout(() => {
      alert.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (alert.parentNode) {
          alert.parentNode.removeChild(alert);
        }
      }, 300);
    }, 3000);
  }

  // Disable right-click context menu
  private disableRightClick() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showAlert('🚫 Clique direito desabilitado');
      return false;
    });
  }

  // Block keyboard shortcuts
  private blockKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      let blocked = false;
      let shortcut = '';

      // F12 - DevTools
      if (e.key === 'F12') {
        e.preventDefault();
        shortcut = 'F12';
        blocked = true;
      }

      // Ctrl combinations
      if (e.ctrlKey && !blocked) {
        if (e.shiftKey) {
          // DevTools shortcuts
          if (['i', 'I'].includes(e.key)) {
            e.preventDefault();
            shortcut = 'Ctrl+Shift+I';
            blocked = true;
          } else if (['j', 'J'].includes(e.key)) {
            e.preventDefault();
            shortcut = 'Ctrl+Shift+J';
            blocked = true;
          } else if (['c', 'C'].includes(e.key)) {
            e.preventDefault();
            shortcut = 'Ctrl+Shift+C';
            blocked = true;
          }
        } else {
          // Other shortcuts
          if (['u', 'U'].includes(e.key)) {
            e.preventDefault();
            shortcut = 'Ctrl+U';
            blocked = true;
          } else if (['s', 'S'].includes(e.key)) {
            e.preventDefault();
            shortcut = 'Ctrl+S';
            blocked = true;
          }
        }
      }

      if (blocked) {
        this.showAlert(`🚫 ${shortcut} bloqueado`);
        return false;
      }
    });
  }

  // Add console warning
  private addConsoleWarning() {
    console.log('%c🚫 PARE!', 'color: red; font-size: 50px; font-weight: bold;');
    console.log('%cEsta é uma funcionalidade do navegador destinada a desenvolvedores. Se alguém disse para você copiar e colar algo aqui para habilitar um recurso ou "hackear" a conta de alguém, trata-se de uma fraude e dará a essa pessoa acesso à sua conta.', 'color: red; font-size: 16px;');
  }

  // Cleanup method
  destroy() {
    if (this.alertContainer && this.alertContainer.parentNode) {
      this.alertContainer.parentNode.removeChild(this.alertContainer);
    }
    
    const animations = document.getElementById('devtools-animations');
    if (animations && animations.parentNode) {
      animations.parentNode.removeChild(animations);
    }
  }
}

// Export singleton instance
export const devToolsProtection = new DevToolsProtection();

// Auto-initialize
devToolsProtection.init();
