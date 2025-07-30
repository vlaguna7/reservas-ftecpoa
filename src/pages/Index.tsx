import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Speaker, Calendar, Users } from 'lucide-react';


const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Usuários autenticados podem acessar a página inicial normalmente
  // O redirecionamento para dashboard só acontece quando clicam no botão

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden clean-bg">
      {/* Subtle moving dots */}
      <div className="subtle-dots">
        <div className="moving-dot"></div>
        <div className="moving-dot"></div>
        <div className="moving-dot"></div>
        <div className="moving-dot"></div>
        <div className="moving-dot"></div>
      </div>
      
      {/* Subtle moving lines */}
      <div className="subtle-lines">
        <div className="moving-line"></div>
        <div className="moving-line"></div>
        <div className="moving-line"></div>
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/lovable-uploads/50a7b433-bce7-4dc2-8818-e0d903409823.png" 
            alt="FTEC Logo" 
            className="mx-auto h-20 md:h-24 object-contain animate-fade-in"
          />
        </div>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground animate-fade-in">
            Sistema de Reservas de Equipamentos
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Plataforma para professores reservarem projetores e caixas de som na unidade FTEC POA.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          <Card className="text-center card-hover animate-fade-in">
            <CardHeader>
              <Monitor className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Projetores</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Reserve projetores para suas aulas e apresentações
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center card-hover animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <Speaker className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Caixas de Som</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Reserva caixas de som para sua aula
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center card-hover animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <Calendar className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Agendamento</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Sistema simples de reservas de projetores
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="inline-block p-8 card-hover animate-fade-in border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg hover:shadow-xl ring-2 ring-primary/10" style={{ animationDelay: '0.3s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center text-primary">
                <Users className="h-7 w-7 text-primary" />
                Acesso para Professores
              </CardTitle>
              <CardDescription className="mb-6 text-base">
                Faça login com seu usuário institucional e PIN para acessar o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                onClick={() => {
                  // Add a small delay for mobile to ensure smooth transition
                  const isMobile = window.innerWidth < 768;
                  if (isMobile && !user) {
                    setTimeout(() => {
                      navigate('/auth', { replace: true });
                    }, 10);
                  } else {
                    navigate(user ? '/dashboard' : '/auth', { replace: true });
                  }
                }}
                className="px-8 py-3 text-lg font-semibold transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg"
              >
                {user ? 'Acessar Sistema' : 'Entrar no Sistema'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <footer className="mt-12 py-8 text-center text-sm text-muted-foreground bg-background/80 backdrop-blur-sm border-t">
        Desenvolvido por: Vitor Souza - DTI POA ZN 🚀
      </footer>
    </div>
  );
};

export default Index;
