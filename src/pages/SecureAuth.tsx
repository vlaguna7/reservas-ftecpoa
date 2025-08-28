import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSecureRole } from '@/hooks/useSecureRole';
import { toast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';

export default function SecureAuth() {
  const { signIn, signUp, user } = useAuth();
  const { role, isVerified } = useSecureRole();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  // Easter egg para o console
  useEffect(() => {
    console.log("🔐 Inicializando sistema de autenticação segura...");
    console.log("🛡️ Verificação de IP e controle anti-fraude ativo");
    console.log("⚡ Conectando com: https://usuarios-ftec.unidadepoazn.app");
    console.info("✅ Sistema de roles implementado com sucesso");
    console.debug("🔒 Todas as validações são executadas no backend");
  }, []);

  const [loginData, setLoginData] = useState({
    institutional_user: '',
    pin: ''
  });

  const [signupData, setSignupData] = useState({
    display_name: '',
    institutional_user: '',
    pin: '',
    confirm_pin: ''
  });

  // Redirecionar usuários já autenticados
  useEffect(() => {
    if (user && isVerified && role !== 'visitor') {
      navigate('/dashboard');
    }
  }, [user, isVerified, role, navigate]);

  // Validação de PIN
  const validatePin = (pin: string): boolean => {
    return /^\d{6}$/.test(pin);
  };

  // Handler de login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePin(loginData.pin)) {
      toast({
        title: "PIN Inválido",
        description: "O PIN deve conter exatamente 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(loginData.institutional_user, loginData.pin);
      
      if (error) {
        toast({
          title: "Erro no Login",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando para o dashboard...",
        });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: "Erro interno",
        description: "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler de cadastro
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePin(signupData.pin)) {
      toast({
        title: "PIN Inválido",
        description: "O PIN deve conter exatamente 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    if (signupData.pin !== signupData.confirm_pin) {
      toast({
        title: "PINs não coincidem",
        description: "Verifique se os PINs estão idênticos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setValidationMessage('');
    
    try {
      const { error } = await signUp(
        signupData.display_name,
        signupData.institutional_user,
        signupData.pin
      );

      if (error) {
        if (error.message.includes('IP')) {
          setValidationMessage(error.message);
          toast({
            title: "Limite de IP",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro no Cadastro",
            description: error.message,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Sua conta foi criada e está aguardando aprovação.",
        });
        setActiveTab('login');
        setSignupData({ display_name: '', institutional_user: '', pin: '', confirm_pin: '' });
      }
    } catch (error) {
      toast({
        title: "Erro interno",
        description: "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Sistema Seguro de Reservas</h1>
          <p className="mt-2 text-muted-foreground">
            Proteção anti-fraude e controle de IP ativo
          </p>
        </div>

        {/* Área de visitantes - mostra informações antes do login */}
        <RoleGuard 
          allowedRoles={['visitor']} 
          showVisitorMessage={false}
          fallback={<div></div>}
        >
          <Card className="border-muted">
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Acesso como Visitante</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-center text-sm text-muted-foreground">
                <p>• Visualização limitada do sistema</p>
                <p>• Faça login para acessar todas as funcionalidades</p>
                <p>• Cadastros limitados por IP para segurança</p>
              </div>
            </CardContent>
          </Card>
        </RoleGuard>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Autenticação</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Cadastro</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-user">Usuário Institucional</Label>
                    <Input
                      id="login-user"
                      type="text"
                      placeholder="seu.usuario"
                      value={loginData.institutional_user}
                      onChange={(e) => setLoginData({
                        ...loginData,
                        institutional_user: e.target.value
                      })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-pin">PIN (6 dígitos)</Label>
                    <Input
                      id="login-pin"
                      type="password"
                      placeholder="123456"
                      maxLength={6}
                      value={loginData.pin}
                      onChange={(e) => setLoginData({
                        ...loginData,
                        pin: e.target.value.replace(/\D/g, '').slice(0, 6)
                      })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>

                <div className="text-center">
                  <button className="text-sm text-muted-foreground hover:text-primary">
                    Esqueci meu PIN
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                {validationMessage && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">{validationMessage}</span>
                  </div>
                )}

                {requiresCaptcha && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700">
                      Validação adicional necessária para este IP
                    </span>
                  </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome Completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="João da Silva"
                      value={signupData.display_name}
                      onChange={(e) => setSignupData({
                        ...signupData,
                        display_name: e.target.value
                      })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-user">Usuário Institucional</Label>
                    <Input
                      id="signup-user"
                      type="text"
                      placeholder="seu.usuario"
                      value={signupData.institutional_user}
                      onChange={(e) => setSignupData({
                        ...signupData,
                        institutional_user: e.target.value
                      })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-pin">PIN (6 dígitos)</Label>
                    <Input
                      id="signup-pin"
                      type="password"
                      placeholder="123456"
                      maxLength={6}
                      value={signupData.pin}
                      onChange={(e) => setSignupData({
                        ...signupData,
                        pin: e.target.value.replace(/\D/g, '').slice(0, 6)
                      })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-pin">Confirmar PIN</Label>
                    <Input
                      id="confirm-pin"
                      type="password"
                      placeholder="123456"
                      maxLength={6}
                      value={signupData.confirm_pin}
                      onChange={(e) => setSignupData({
                        ...signupData,
                        confirm_pin: e.target.value.replace(/\D/g, '').slice(0, 6)
                      })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Cadastrando..." : "Criar Conta"}
                  </Button>
                </form>

                <div className="space-y-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    <span>Máximo 3 cadastros por IP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    <span>Proteção anti-fraude ativa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Aprovação necessária para acesso completo</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <p>Sistema desenvolvido com segurança avançada</p>
          <p>Todos os acessos são monitorados e auditados</p>
        </div>
      </div>
    </div>
  );
}