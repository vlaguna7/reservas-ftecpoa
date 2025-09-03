import { ReactNode } from 'react';
import { useSecureAdmin } from '@/hooks/useSecureAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isIOSSafari } from '@/lib/iosUtils';

interface AdminGuardProps {
  children: ReactNode;
  showLoading?: boolean;
}

export const AdminGuard = ({ children, showLoading = true }: AdminGuardProps) => {
  const { isValidAdmin, isValidating, revalidateAccess, lastValidation } = useSecureAdmin();

  // Mostrar loading durante validação inicial
  if (isValidating && showLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Validando Acesso Administrativo</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Verificando permissões de segurança...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar erro se não é admin válido
  if (!isValidAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-destructive">Acesso Negado</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {isIOSSafari() 
                  ? 'Problemas de conexão detectados no iOS Safari. Tente novamente.'
                  : 'Você não possui privilégios administrativos válidos.'
                }
              </p>
            </div>
            <Button 
              onClick={revalidateAccess}
              variant="outline"
              size="sm"
            >
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar conteúdo protegido se é admin válido
  return (
    <div className="relative">
      {/* Header de segurança */}
      <div className="mb-4 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <Shield className="h-4 w-4" />
          <span>Sessão Administrativa Segura</span>
          <span className="text-xs text-muted-foreground">
            Última validação: {new Date(lastValidation).toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      {children}
    </div>
  );
};