import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, AlertTriangle, Users, Activity, 
  Globe, Clock, Ban, CheckCircle, X, Eye 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSecureRole } from '@/hooks/useSecureRole';
import { AdminGuard } from '@/components/RoleGuard';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface IPControlData {
  ip_address: string;
  registration_count: number;
  first_registration_at: string;
  last_registration_at: string;
  blocked_until: string | null;
  suspicious_activity: boolean;
}

interface UserIPHistory {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  registration_timestamp: string;
  is_signup: boolean;
  display_name?: string;
  institutional_user?: string;
}

interface AdminAuditLog {
  id: string;
  action: string;
  created_at: string;
  severity: string;
  details: any;
  admin_display_name?: string;
  target_display_name?: string;
}

export default function SecureAdminDashboard() {
  const { session } = useAuth();
  const { canAccessAdmin, isVerified } = useSecureRole();
  const [loading, setLoading] = useState(true);
  const [ipControlData, setIpControlData] = useState<IPControlData[]>([]);
  const [userIpHistory, setUserIpHistory] = useState<UserIPHistory[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const [accessVerified, setAccessVerified] = useState(false);

  // Verificação tripla de acesso admin
  useEffect(() => {
    const verifyAdminAccess = async () => {
      if (!session || !isVerified) {
        setLoading(false);
        return;
      }

      try {
        // Chamada à Edge Function para verificação adicional
        const { data: accessResult, error } = await supabase.functions.invoke('admin-dashboard-access', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (error || !accessResult?.canAccess) {
          toast({
            title: "Acesso Negado",
            description: "Você não tem permissão para acessar o painel administrativo",
            variant: "destructive"
          });
          setAccessVerified(false);
          setLoading(false);
          return;
        }

        setAccessVerified(true);
        await loadDashboardData();
      } catch (error) {
        console.error('Admin access verification failed:', error);
        setAccessVerified(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAdminAccess();
  }, [session, isVerified, canAccessAdmin]);

  // Carregar dados do dashboard
  const loadDashboardData = async () => {
    try {
      const [ipControlResult, ipHistoryResult, auditLogResult] = await Promise.all([
        supabase
          .from('ip_registration_control')
          .select('*')
          .order('registration_count', { ascending: false })
          .limit(50),
        
        supabase
          .from('user_ip_history')
          .select(`
            *,
            profiles:user_id(display_name, institutional_user)
          `)
          .order('created_at', { ascending: false })
          .limit(100),
        
        supabase
          .from('admin_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (ipControlResult.data) setIpControlData(ipControlResult.data as IPControlData[]);
      if (ipHistoryResult.data) {
        const processedHistory = ipHistoryResult.data.map(item => ({
          ...item,
          ip_address: item.ip_address as string,
          display_name: (item as any).profiles?.display_name,
          institutional_user: (item as any).profiles?.institutional_user
        })) as UserIPHistory[];
        setUserIpHistory(processedHistory);
      }
      if (auditLogResult.data) setAdminAuditLogs(auditLogResult.data);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do dashboard",
        variant: "destructive"
      });
    }
  };

  // Bloquear IP
  const blockIP = async (ipAddress: string) => {
    try {
      const { error } = await supabase
        .from('ip_registration_control')
        .update({ 
          blocked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          suspicious_activity: true
        })
        .eq('ip_address', ipAddress);

      if (error) throw error;

      toast({
        title: "IP Bloqueado",
        description: `IP ${ipAddress} foi bloqueado por 24 horas`,
      });

      await loadDashboardData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao bloquear IP",
        variant: "destructive"
      });
    }
  };

  // Desbloquear IP
  const unblockIP = async (ipAddress: string) => {
    try {
      const { error } = await supabase
        .from('ip_registration_control')
        .update({ 
          blocked_until: null,
          suspicious_activity: false
        })
        .eq('ip_address', ipAddress);

      if (error) throw error;

      toast({
        title: "IP Desbloqueado",
        description: `IP ${ipAddress} foi desbloqueado`,
      });

      await loadDashboardData();
    } catch (error) {
      toast({
        title: "Erro", 
        description: "Falha ao desbloquear IP",
        variant: "destructive"
      });
    }
  };

  // Renderização com proteção
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Shield className="h-8 w-8 animate-pulse mx-auto" />
          <p className="text-muted-foreground">Verificando acesso administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard>
      {accessVerified ? (
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Painel Administrativo Seguro</h1>
              <p className="text-muted-foreground">Monitoramento e controle de segurança</p>
            </div>
          </div>

          <Tabs defaultValue="ip-control" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ip-control">Controle de IP</TabsTrigger>
              <TabsTrigger value="ip-history">Histórico de IPs</TabsTrigger>
              <TabsTrigger value="audit-logs">Logs de Auditoria</TabsTrigger>
            </TabsList>

            <TabsContent value="ip-control" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Controle de Registros por IP
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Registros</TableHead>
                          <TableHead>Primeiro Registro</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ipControlData.map((ip) => {
                          const isBlocked = ip.blocked_until && new Date(ip.blocked_until) > new Date();
                          const isOverLimit = ip.registration_count >= 3;
                          
                          return (
                            <TableRow key={ip.ip_address}>
                              <TableCell className="font-mono">{ip.ip_address}</TableCell>
                              <TableCell>
                                <Badge variant={isOverLimit ? "destructive" : ip.registration_count >= 2 ? "secondary" : "outline"}>
                                  {ip.registration_count}/3
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(ip.first_registration_at).toLocaleString()}</TableCell>
                              <TableCell>
                                {isBlocked ? (
                                  <Badge variant="destructive">
                                    <Ban className="h-3 w-3 mr-1" />
                                    Bloqueado
                                  </Badge>
                                ) : ip.suspicious_activity ? (
                                  <Badge variant="secondary">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Suspeito
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Normal
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {isBlocked ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => unblockIP(ip.ip_address)}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Desbloquear
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => blockIP(ip.ip_address)}
                                    >
                                      <Ban className="h-3 w-3 mr-1" />
                                      Bloquear
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ip-history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Histórico de IPs por Usuário
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>User Agent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userIpHistory.map((history) => (
                          <TableRow key={history.id}>
                            <TableCell>{new Date(history.registration_timestamp).toLocaleString()}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{history.display_name || 'N/A'}</div>
                                <div className="text-sm text-muted-foreground">
                                  {history.institutional_user || 'N/A'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">{history.ip_address}</TableCell>
                            <TableCell>
                              <Badge variant={history.is_signup ? "default" : "outline"}>
                                {history.is_signup ? "Cadastro" : "Login"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs">
                              {history.user_agent}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit-logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Logs de Auditoria Administrativa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Severidade</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminAuditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                            <TableCell className="font-medium">{log.action}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  log.severity === 'critical' ? 'destructive' : 
                                  log.severity === 'high' ? 'secondary' : 'outline'
                                }
                              >
                                {log.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <pre className="text-xs truncate">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader className="text-center">
            <X className="h-12 w-12 mx-auto text-destructive" />
            <CardTitle className="text-destructive">Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Verificação de segurança falhou. Você não tem permissão para acessar esta área.
            </p>
          </CardContent>
        </Card>
      )}
    </AdminGuard>
  );
}