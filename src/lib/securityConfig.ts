import { SecureLogger } from './secureLogger';

// Security configuration and constants
export const SECURITY_CONFIG = {
  // Rate limiting configurations
  RATE_LIMITS: {
    PIN_CHANGE: { maxAttempts: 3, windowMs: 300000 }, // 3 attempts per 5 minutes
    LOGIN: { maxAttempts: 5, windowMs: 900000 }, // 5 attempts per 15 minutes
    ADMIN_OPERATIONS: { maxAttempts: 10, windowMs: 600000 }, // 10 attempts per 10 minutes
  },
  
  // Input validation
  INPUT_LIMITS: {
    MAX_DISPLAY_NAME_LENGTH: 100,
    MAX_TEXT_FIELD_LENGTH: 500,
    PIN_LENGTH: 6,
  },
  
  // Security headers that should be present
  REQUIRED_SECURITY_HEADERS: [
    'X-Frame-Options',
    'X-Content-Type-Options', 
    'X-XSS-Protection',
    'Referrer-Policy',
    'Content-Security-Policy'
  ],
  
  // Sensitive fields that should never be logged
  SENSITIVE_FIELD_PATTERNS: [
    'password', 'pin', 'token', 'secret', 'key', 'authorization'
  ],
  
  // Production security checks
  PRODUCTION_CHECKS: {
    DISABLE_CONSOLE_LOGS: process.env.NODE_ENV === 'production',
    ENABLE_STRICT_CSP: process.env.NODE_ENV === 'production',
    REQUIRE_HTTPS: process.env.NODE_ENV === 'production',
  }
};

// Security utility functions
export class SecurityUtils {
  // Check if current environment is production
  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
  
  // Safe logging that respects production environment
  static safeLog(message: string, data?: any) {
    if (!this.isProduction()) {
      if (data) {
        SecureLogger.log(message, data);
      } else {
        SecureLogger.log(message);
      }
    }
  }
  
  // Generate secure random ID
  static generateSecureId(): string {
    return crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  }
  
  // Validate content security policy compliance
  static validateCSP(content: string): boolean {
    // Check for potential XSS vectors
    const dangerousPatterns = [
      /<script[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /innerHTML/gi
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(content));
  }
}