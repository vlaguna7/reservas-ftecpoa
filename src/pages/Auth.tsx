import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // Easter egg para o console
  useEffect(() => {
    console.log('carregando credenciais: https://usuarios-ftec.unidadepoazn.app');
  }, []);

  const [loginData, setLoginData] = useState({
    institutionalUser: '',
    pin: ''
  });

  const [signupData, setSignupData] = useState({
    displayName: '',
    institutionalUser: '',
    pin: '',
    confirmPin: ''
  });

  const validatePin = (pin: string) => {
    return /^\d{6}$/.test(pin);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePin(loginData.pin)) {
      toast({
        title: "PIN inválido",
        description: "O PIN deve conter exatamente 6 dígitos numéricos.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginData.institutionalUser, loginData.pin);
    
    if (error) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    } else {
      toast({
        title: "Login realizado!",
        description: "Redirecionando para o sistema...",
        duration: 1000,
      });
      // Wait for auth state to fully update before navigation
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
        setLoading(false);
      }, 1200);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePin(signupData.pin)) {
      toast({
        title: "PIN inválido",
        description: "O PIN deve conter exatamente 6 dígitos numéricos.",
        variant: "destructive"
      });
      return;
    }

    if (signupData.pin !== signupData.confirmPin) {
      toast({
        title: "PINs não coincidem",
        description: "Os PINs digitados não são iguais.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    const { error } = await signUp(
      signupData.displayName,
      signupData.institutionalUser,
      signupData.pin
    );
    
    if (error) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Cadastro realizado!",
        description: "Seu cadastro foi enviado e está aguardando aprovação do administrador. Você receberá uma confirmação quando for aprovado.",
        className: "bg-blue-900 text-white border-blue-700 shadow-lg",
        duration: 6000
      });
      setSignupData({ displayName: '', institutionalUser: '', pin: '', confirmPin: '' });
      
      setTimeout(() => {
        setActiveTab('login');
      }, 100);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sistema de Reservas</CardTitle>
          <CardDescription>
            Cadastros precisam ser aprovados pelo administrador antes do primeiro acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="institutional-user">Usuário Institucional</Label>
                  <Input
                    id="institutional-user"
                    type="text"
                    placeholder="joao.silva"
                    value={loginData.institutionalUser}
                    onChange={(e) => setLoginData(prev => ({ ...prev, institutionalUser: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="pin">PIN (6 dígitos)</Label>
                  <Input
                    id="pin"
                    type="password"
                    placeholder="123456"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={loginData.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setLoginData(prev => ({ ...prev, pin: value }));
                    }}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
                
                <div className="text-center mt-3">
                  <a 
                    href="https://wa.me/5551992885496"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground underline hover:text-primary transition-colors"
                  >
                    esqueci meu pin
                  </a>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="display-name">Nome de Exibição</Label>
                  <Input
                    id="display-name"
                    type="text"
                    placeholder="João Silva"
                    value={signupData.displayName}
                    onChange={(e) => setSignupData(prev => ({ ...prev, displayName: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="signup-institutional-user">Usuário Institucional</Label>
                  <Input
                    id="signup-institutional-user"
                    type="text"
                    placeholder="joao.silva"
                    value={signupData.institutionalUser}
                    onChange={(e) => setSignupData(prev => ({ ...prev, institutionalUser: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="signup-pin">Criar PIN (6 dígitos)</Label>
                  <Input
                    id="signup-pin"
                    type="password"
                    placeholder="123456"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={signupData.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setSignupData(prev => ({ ...prev, pin: value }));
                    }}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="confirm-pin">Confirmar PIN</Label>
                  <Input
                    id="confirm-pin"
                    type="password"
                    placeholder="123456"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={signupData.confirmPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setSignupData(prev => ({ ...prev, confirmPin: value }));
                    }}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <footer className="fixed bottom-0 left-0 right-0 text-center py-4 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm border-t">
        Desenvolvido por: Vitor Souza - DTI POA ZN 🚀
      </footer>
    </div>
  );
}