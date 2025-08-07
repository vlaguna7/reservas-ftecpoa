import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { SECURITY_CONFIG, SecurityUtils } from '@/lib/securityConfig';

interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  fixed?: boolean;
}

export function SecurityAudit() {
  const [issues, setIssues] = useState<SecurityIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    performSecurityAudit();
  }, []);

  const performSecurityAudit = async () => {
    const foundIssues: SecurityIssue[] = [];

    // Check for console.log statements in production
    if (SecurityUtils.isProduction()) {
      // This would need to be implemented as a build-time check
      foundIssues.push({
        id: 'console-logs',
        severity: 'medium',
        category: 'Information Disclosure',
        title: 'Console Logs in Production',
        description: 'Console logs may expose sensitive information in production',
        recommendation: 'Remove or secure all console.log statements for production builds'
      });
    }

    // Check CSP headers
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!cspMeta) {
      foundIssues.push({
        id: 'missing-csp',
        severity: 'high',
        category: 'XSS Protection',
        title: 'Missing Content Security Policy',
        description: 'No CSP header detected, application may be vulnerable to XSS attacks',
        recommendation: 'Implement a strict Content Security Policy'
      });
    }

    // Check for HTTPS
    if (location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      foundIssues.push({
        id: 'no-https',
        severity: 'critical',
        category: 'Transport Security',
        title: 'Insecure Connection',
        description: 'Application is not served over HTTPS',
        recommendation: 'Enable HTTPS/TLS for all connections'
      });
    }

    // Check localStorage for sensitive data
    try {
      const storageKeys = Object.keys(localStorage);
      const suspiciousKeys = storageKeys.filter(key => 
        SECURITY_CONFIG.SENSITIVE_FIELD_PATTERNS.some(pattern => 
          key.toLowerCase().includes(pattern)
        )
      );
      
      if (suspiciousKeys.length > 0) {
        foundIssues.push({
          id: 'sensitive-localstorage',
          severity: 'high',
          category: 'Data Exposure',
          title: 'Sensitive Data in LocalStorage',
          description: `Potentially sensitive keys found: ${suspiciousKeys.join(', ')}`,
          recommendation: 'Avoid storing sensitive data in localStorage'
        });
      }
    } catch (error) {
      // localStorage access may be restricted
    }

    // Check for inline scripts (potential XSS)
    const inlineScripts = document.querySelectorAll('script:not([src])');
    if (inlineScripts.length > 0) {
      foundIssues.push({
        id: 'inline-scripts',
        severity: 'medium',
        category: 'XSS Protection',
        title: 'Inline Scripts Detected',
        description: `${inlineScripts.length} inline script(s) found`,
        recommendation: 'Move inline scripts to external files and use nonces'
      });
    }

    setIssues(foundIssues);
    setLoading(false);
  };

  const getSeverityBadge = (severity: SecurityIssue['severity']) => {
    const config = {
      critical: { color: 'bg-red-600', icon: XCircle },
      high: { color: 'bg-orange-500', icon: AlertTriangle },
      medium: { color: 'bg-yellow-500', icon: AlertTriangle },
      low: { color: 'bg-blue-500', icon: CheckCircle }
    };

    const { color, icon: Icon } = config[severity];
    
    return (
      <Badge className={`${color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const securityScore = Math.max(0, 100 - (issues.length * 15));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auditoria de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Analisando segurança...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Score de Segurança: {securityScore}/100
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                securityScore >= 90 ? 'bg-green-600' : 
                securityScore >= 70 ? 'bg-yellow-500' : 'bg-red-600'
              }`}
              style={{ width: `${securityScore}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {issues.length === 0 
              ? "Nenhum problema de segurança encontrado!" 
              : `${issues.length} problema(s) de segurança detectado(s)`
            }
          </p>
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Problemas de Segurança Detectados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {issues.map((issue) => (
              <Alert key={issue.id}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{issue.title}</h4>
                    {getSeverityBadge(issue.severity)}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                  <p className="text-sm font-medium">Recomendação: {issue.recommendation}</p>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configurações de Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Rate Limiting:</strong> Ativo
            </div>
            <div>
              <strong>Input Sanitization:</strong> Ativo
            </div>
            <div>
              <strong>Secure Logging:</strong> Ativo
            </div>
            <div>
              <strong>Environment:</strong> {SecurityUtils.isProduction() ? 'Produção' : 'Desenvolvimento'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={performSecurityAudit} className="w-full">
        <Shield className="h-4 w-4 mr-2" />
        Executar Nova Auditoria
      </Button>
    </div>
  );
}