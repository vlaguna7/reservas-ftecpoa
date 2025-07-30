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
          <Card className="inline-block p-6 md:p-12 animate-fade-in border-2 md:border-4 border-primary bg-gradient-to-br from-primary/20 via-primary/10 to-background shadow-xl md:shadow-2xl hover:shadow-2xl md:hover:shadow-3xl ring-2 md:ring-4 ring-primary/20 hover:ring-primary/40 transition-all duration-500 hover:scale-105 hover:border-primary/80 relative overflow-hidden max-w-sm md:max-w-none mx-auto" style={{ animationDelay: '0.3s' }}>
            {/* Efeito de brilho animado - apenas no desktop */}
            <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 opacity-0 hover:opacity-100 transition-opacity duration-700 transform translate-x-[-100%] hover:translate-x-[200%]"></div>
            
            <CardHeader className="relative z-10 pb-4 md:pb-6">
              <CardTitle className="flex items-center gap-2 md:gap-3 justify-center text-primary text-lg md:text-2xl font-bold mb-2">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                Acesso para Professores
              </CardTitle>
              <CardDescription className="mb-4 md:mb-8 text-base md:text-lg font-medium text-foreground">
                Primeira vez? Crie seu cadastro primeiro!
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="w-full md:w-auto px-8 md:px-12 py-3 md:py-4 text-lg md:text-xl font-bold transition-all duration-300 hover:scale-105 md:hover:scale-110 shadow-lg md:shadow-xl hover:shadow-xl md:hover:shadow-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground border-2 border-primary-foreground/20 hover:border-primary-foreground/40"
              >
                Entrar no Sistema
              </Button>
              <div className="mt-3">
                <a 
                  href="https://wa.me/5551992885496"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground underline hover:text-primary transition-colors"
                >
                  esqueci meu pin
                </a>
              </div>
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
