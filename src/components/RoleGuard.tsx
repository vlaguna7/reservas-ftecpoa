import { useEffect, ReactNode } from 'react';
import { useSecureRole } from '@/hooks/useSecureRole';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type UserRole = 'visitor' | 'user' | 'admin';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
  requireAuth?: boolean;
  showVisitorMessage?: boolean;
}

export const RoleGuard = ({ 
  children, 
  allowedRoles, 
  fallback,
  requireAuth = false,
  showVisitorMessage = true
}: RoleGuardProps) => {
  const { user } = useAuth();
  const { role, isLoading, isVerified, refreshRole } = useSecureRole();

  // Redirect não autenticados se necessário
  useEffect(() => {
    if (requireAuth && !user && !isLoading) {
      window.location.href = '/auth';
    }
  }, [requireAuth, user, isLoading]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Verificação falhou
  if (!isVerified) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <CardTitle className="text-destructive">Erro de Verificação</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Não foi possível verificar suas permissões. Tente novamente.
          </p>
          <Button onClick={refreshRole} variant="outline">
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Verificar se role está permitida
  if (!allowedRoles.includes(role)) {
    // Fallback customizado
    if (fallback) {
      return <>{fallback}</>;
    }

    // Mensagem para visitantes
    if (role === 'visitor' && showVisitorMessage) {
      return (
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
            <CardTitle>Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {!user 
                ? "Você precisa fazer login para acessar esta área."
                : "Sua conta está pendente de aprovação ou você não tem permissão para acessar esta área."
              }
            </p>
            {!user && (
              <Button onClick={() => window.location.href = '/auth'}>
                Fazer Login
              </Button>
            )}
            {user && role === 'visitor' && (
              <div className="text-sm text-muted-foreground">
                <p>Status da conta: Aguardando aprovação</p>
                <p>Entre em contato com um administrador se necessário.</p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // Mensagem genérica de acesso negado
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <CardTitle className="text-destructive">Acesso Negado</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta área.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Acesso permitido
  return <>{children}</>;
};

// Componente específico para área administrativa
export const AdminGuard = ({ children }: { children: ReactNode }) => (
  <RoleGuard 
    allowedRoles={['admin']} 
    requireAuth={true}
    showVisitorMessage={false}
    fallback={
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 mx-auto text-destructive" />
          <CardTitle className="text-destructive">Área Administrativa</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Acesso restrito apenas para administradores.
          </p>
        </CardContent>
      </Card>
    }
  >
    {children}
  </RoleGuard>
);

// Componente específico para usuários aprovados
export const UserGuard = ({ children }: { children: ReactNode }) => (
  <RoleGuard 
    allowedRoles={['user', 'admin']} 
    requireAuth={true}
  >
    {children}
  </RoleGuard>
);