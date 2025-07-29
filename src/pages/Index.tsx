import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Speaker, Calendar, Users } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--gradient-academic)' }}>
      {/* Academic geometric background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-64 h-64 border border-primary rotate-45"></div>
        <div className="absolute top-40 right-20 w-48 h-48 border border-primary/60 rotate-12"></div>
        <div className="absolute bottom-20 left-1/4 w-32 h-32 border border-primary/40 -rotate-12"></div>
        <div className="absolute bottom-40 right-10 w-56 h-56 border border-primary/30 rotate-45"></div>
      </div>
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Sistema de Reservas de Equipamentos
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Plataforma para professores reservarem projetores e caixas de som de forma simples e eficiente.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          <Card className="text-center backdrop-blur-sm" style={{ background: 'var(--gradient-academic-card)', boxShadow: 'var(--shadow-card)' }}>
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

          <Card className="text-center backdrop-blur-sm" style={{ background: 'var(--gradient-academic-card)', boxShadow: 'var(--shadow-card)' }}>
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

          <Card className="text-center backdrop-blur-sm" style={{ background: 'var(--gradient-academic-card)', boxShadow: 'var(--shadow-card)' }}>
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
          <Card className="inline-block p-8 backdrop-blur-sm" style={{ background: 'var(--gradient-academic-card)', boxShadow: 'var(--shadow-academic)' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center">
                <Users className="h-6 w-6 text-primary" />
                Acesso para Professores
              </CardTitle>
              <CardDescription className="mb-6">
                Faça login com seu usuário institucional e PIN para acessar o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="px-8"
              >
                Entrar no Sistema
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
