// Input sanitization utilities for enhanced security
export class InputSanitizer {
  // Sanitize HTML to prevent XSS
  static sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Sanitize SQL-like strings to prevent injection
  static sanitizeSql(input: string): string {
    return input
      .replace(/['";\\]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }

  // Validate institutional user format
  static validateInstitutionalUser(user: string): boolean {
    // Allow letters, numbers, dots, hyphens, underscores
    const pattern = /^[a-zA-Z0-9._-]+$/;
    return pattern.test(user) && user.length <= 50;
  }

  // Validate PIN format (exactly 6 digits)
  static validatePin(pin: string): boolean {
    const pattern = /^\d{6}$/;
    return pattern.test(pin);
  }

  // Validate display name
  static validateDisplayName(name: string): boolean {
    // Allow letters, spaces, common punctuation, accented characters
    const pattern = /^[a-zA-ZÀ-ÿ\u0100-\u017F\s\.\-']+$/;
    return pattern.test(name) && name.length <= 100 && name.trim().length > 0;
  }

  // Validate email format
  static validateEmail(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email) && email.length <= 254;
  }

  // Sanitize and validate general text input
  static sanitizeText(input: string, maxLength: number = 255): string {
    return this.sanitizeHtml(input.trim()).substring(0, maxLength);
  }

  // Rate limiting helper - simple in-memory rate limiter
  private static rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  static checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 300000): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  // Clean up old rate limit entries
  static cleanupRateLimit() {
    const now = Date.now();
    for (const [key, record] of this.rateLimitMap.entries()) {
      if (now > record.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}

// Auto cleanup rate limit entries every 10 minutes
setInterval(() => {
  InputSanitizer.cleanupRateLimit();
}, 600000);