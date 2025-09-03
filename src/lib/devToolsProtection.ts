// Anti-DevTools Protection System
// This module implements multiple layers of protection against developer tools

class DevToolsProtection {
  private isDevToolsOpen = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private warningCount = 0;
  private isBlocked = false;

  // Initialize all protection mechanisms
  init() {
    this.disableRightClick();
    this.blockKeyboardShortcuts();
    this.startDevToolsDetection();
    this.addConsoleWarning();
  }

  // Disable right-click context menu
  private disableRightClick() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.logAttempt('Right-click blocked');
      return false;
    });

    // Block drag and select
    document.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });

    document.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
  }

  // Block keyboard shortcuts
  private blockKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // F12 - DevTools
      if (e.key === 'F12') {
        e.preventDefault();
        this.handleDevToolsAttempt();
        return false;
      }

      // Ctrl combinations
      if (e.ctrlKey) {
        const blockedKeys = [
          'u', 'U', // View Source
          's', 'S', // Save Page
          'a', 'A', // Select All
          'p', 'P', // Print
          'f', 'F', // Find
        ];

        // DevTools shortcuts
        if (e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
          e.preventDefault();
          this.handleDevToolsAttempt();
          return false;
        }

        if (blockedKeys.includes(e.key)) {
          e.preventDefault();
          this.logAttempt(`Blocked Ctrl+${e.key.toUpperCase()}`);
          return false;
        }
      }

      // Alt+Tab (partial blocking)
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        return false;
      }
    });
  }

  // Multiple DevTools detection techniques
  private startDevToolsDetection() {
    // Method 1: Console log timing detection
    this.detectConsoleLog();
    
    // Method 2: Window size detection
    this.detectWindowSize();
    
    // Method 3: Debugger statement detection
    this.detectDebugger();

    // Continuous monitoring
    this.detectionInterval = setInterval(() => {
      this.detectConsoleLog();
      this.detectWindowSize();
    }, 1000);
  }

  // Console log timing detection
  private detectConsoleLog() {
    const start = performance.now();
    console.log('%c', 'color: transparent');
    const end = performance.now();
    
    // If console is open, logging takes longer
    if (end - start > 10) {
      this.handleDevToolsDetection();
    }
  }

  // Window size vs screen size detection
  private detectWindowSize() {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    
    if (widthDiff > threshold || heightDiff > threshold) {
      this.handleDevToolsDetection();
    }
  }

  // Debugger statement detection
  private detectDebugger() {
    const check = () => {
      if (new Date().getTime() - check.toString().length > 100) {
        this.handleDevToolsDetection();
      }
    };
    
    setInterval(check, 5000);
  }

  // Handle DevTools detection
  private handleDevToolsDetection() {
    if (this.isDevToolsOpen) return;
    
    this.isDevToolsOpen = true;
    this.warningCount++;

    if (this.warningCount === 1) {
      this.showWarning();
    } else if (this.warningCount === 2) {
      this.hideContent();
    } else if (this.warningCount >= 3) {
      this.blockAccess();
    }

    // Reset detection after 3 seconds
    setTimeout(() => {
      this.isDevToolsOpen = false;
    }, 3000);
  }

  // Handle direct DevTools attempt
  private handleDevToolsAttempt() {
    this.warningCount += 2;
    this.showWarning();
    setTimeout(() => this.hideContent(), 1000);
  }

  // Show warning message
  private showWarning() {
    const warning = document.createElement('div');
    warning.id = 'devtools-warning';
    warning.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        color: #ff6b6b;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: monospace;
        font-size: 24px;
        text-align: center;
      ">
        <div>
          <h2>🚫 ACESSO NEGADO</h2>
          <p>Ferramentas de desenvolvedor não são permitidas!</p>
          <p style="font-size: 16px; margin-top: 20px;">Esta ação foi registrada.</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(warning);
    
    setTimeout(() => {
      const el = document.getElementById('devtools-warning');
      if (el) el.remove();
    }, 3000);
  }

  // Hide page content
  private hideContent() {
    const root = document.getElementById('root');
    if (root) {
      root.style.display = 'none';
    }

    const blocker = document.createElement('div');
    blocker.id = 'content-blocker';
    blocker.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        color: #ff6b6b;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: monospace;
      ">
        <div style="text-align: center;">
          <h1>SISTEMA PROTEGIDO</h1>
          <p>Recarregue a página para continuar</p>
          <button onclick="location.reload()" style="
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 10px 20px;
            margin-top: 20px;
            cursor: pointer;
            font-family: monospace;
          ">Recarregar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(blocker);
  }

  // Complete access blocking
  private blockAccess() {
    if (this.isBlocked) return;
    this.isBlocked = true;

    // Clear page content
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        color: #ff0000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 20px;
      ">
        <div style="text-align: center;">
          <h1>🔒 ACESSO BLOQUEADO</h1>
          <p>Muitas tentativas de acesso às ferramentas de desenvolvedor.</p>
          <p>Contate o administrador do sistema.</p>
        </div>
      </div>
    `;

    // Redirect after 5 seconds
    setTimeout(() => {
      window.location.href = '/';
    }, 5000);
  }

  // Add console warning
  private addConsoleWarning() {
    console.log('%c🚫 PARE!', 'color: red; font-size: 50px; font-weight: bold;');
    console.log('%cEsta é uma funcionalidade do navegador destinada a desenvolvedores. Se alguém disse para você copiar e colar algo aqui para habilitar um recurso ou "hackear" a conta de alguém, trata-se de uma fraude e dará a essa pessoa acesso à sua conta.', 'color: red; font-size: 16px;');
  }

  // Log security attempts
  private logAttempt(action: string) {
    console.warn(`[SECURITY] ${action} - ${new Date().toISOString()}`);
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

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  devToolsProtection.init();
}