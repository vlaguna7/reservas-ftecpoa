// Secure logging utility that sanitizes sensitive data
export class SecureLogger {
  private static sensitiveFields = [
    'password', 'pin', 'pin_hash', 'access_token', 'refresh_token', 
    'authorization', 'secret', 'key', 'api_key', 'private'
  ];

  private static sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Check if string contains sensitive information
      const lowerData = data.toLowerCase();
      if (this.sensitiveFields.some(field => lowerData.includes(field))) {
        return '[SANITIZED]';
      }
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.sanitizeData(item));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
          sanitized[key] = '[SANITIZED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  static log(message: string, data?: any) {
    if (data) {
      console.log(message, this.sanitizeData(data));
    } else {
      console.log(message);
    }
  }

  static error(message: string, error?: any) {
    if (error) {
      console.error(message, this.sanitizeData(error));
    } else {
      console.error(message);
    }
  }

  static warn(message: string, data?: any) {
    if (data) {
      console.warn(message, this.sanitizeData(data));
    } else {
      console.warn(message);
    }
  }
}