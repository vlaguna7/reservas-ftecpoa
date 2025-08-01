import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Calendar, List, User, Settings } from 'lucide-react';
import { MakeReservation } from '@/components/MakeReservation';
import { MyReservations } from '@/components/MyReservations';
import { Profile } from '@/components/Profile';
import { AdminPanel } from '@/components/AdminPanel';
import { TodayReservations } from '@/components/TodayReservations';
import { AuditoriumReservations } from '@/components/AuditoriumReservations';
import { LaboratoryReservations } from '@/components/LaboratoryReservations';
import { MobileSidebar } from '@/components/MobileSidebar';
import { AlertPopup } from '@/components/AlertPopup';
import { useAlerts } from '@/hooks/useAlerts';

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('reservations');
  const { currentAlert, closeCurrentAlert } = useAlerts();

  // Show loading while authentication is being verified
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect only if we're sure there's no user (authentication failed)
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Show loading while profile is being fetched (user exists but profile not loaded yet)
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Alert Popup */}
      {currentAlert && (
        <AlertPopup alert={currentAlert} onClose={closeCurrentAlert} />
      )}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          {/* Layout Mobile */}
          <div className="md:hidden">
            {/* Cabeçalho alinhado: menu à esquerda, textos no centro, botão sair à direita */}
            <div className="flex items-center justify-between">
              <MobileSidebar 
                onNavigate={setActiveTab} 
                currentSection={activeTab}
                isAdmin={profile.is_admin}
              />
              
              {/* Conteúdo centralizado */}
              <div className="flex-1 text-center">
                <h1 className="text-lg font-bold">Sistema de Reservas</h1>
                <p className="text-sm text-muted-foreground">
                  Olá, {profile.display_name}
                  {profile.is_admin && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                      Admin
                    </span>
                  )}
                </p>
              </div>
              
              <Button variant="outline" onClick={signOut} size="sm">
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            </div>
          </div>

          {/* Layout Desktop */}
          <div className="hidden md:block">
            {/* Logo centralizada */}
            <div className="text-center mb-4">
              <img 
                src="/lovable-uploads/50a7b433-bce7-4dc2-8818-e0d903409823.png" 
                alt="FTEC Logo" 
                className="h-12 object-contain mx-auto"
              />
            </div>
            
            {/* Cabeçalho compacto - linha única */}
            <div className="flex items-center justify-between mb-3">
              {/* Espaço vazio à esquerda */}
              <div className="flex-1"></div>
              
              {/* Título centralizado */}
              <h1 className="text-2xl font-bold text-foreground">Sistema de Reservas</h1>
              
              {/* Saudação + Admin badge + Botão sair - lado direito */}
              <div className="flex items-center gap-4 flex-1 justify-end">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Olá,</p>
                      <p className="text-sm font-bold text-foreground flex items-center gap-2">
                        {profile.display_name}
                        {profile.is_admin && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                            Admin
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-3 w-3 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${isMobile ? (profile.is_admin ? 'grid-cols-3' : 'grid-cols-2') : 'grid-cols-4'} ${isMobile ? 'md:hidden gap-1' : ''}`}>
            <TabsTrigger value="reservations" className={`flex items-center ${isMobile ? 'gap-1 text-xs px-2' : 'gap-2'}`}>
              <Calendar className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              {isMobile ? 'Fazer' : 'Fazer Reserva'}
            </TabsTrigger>
            <TabsTrigger value="my-reservations" className={`flex items-center ${isMobile ? 'gap-1 text-xs px-2' : 'gap-2'}`}>
              <List className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              {isMobile ? 'Minhas' : 'Minhas Reservas'}
            </TabsTrigger>
            {!isMobile && (
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Meu Perfil
              </TabsTrigger>
            )}
            {profile.is_admin && (
              <TabsTrigger value="admin" className={`flex items-center ${isMobile ? 'gap-1 text-xs px-2' : 'gap-2'}`}>
                <Settings className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="reservations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fazer uma Reserva</CardTitle>
                </CardHeader>
                <CardContent>
                  <MakeReservation />
                </CardContent>
              </Card>
              
              <TodayReservations />
              <AuditoriumReservations />
              <LaboratoryReservations />
            </div>
          </TabsContent>

          <TabsContent value="my-reservations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className={`${isMobile ? 'text-center text-lg' : ''}`}>Minhas Reservas</CardTitle>
              </CardHeader>
              <CardContent>
                <MyReservations />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meu Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                <Profile />
              </CardContent>
            </Card>
          </TabsContent>

          {profile.is_admin && (
            <TabsContent value="admin" className="space-y-6">
              <AdminPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>
      
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Desenvolvido por: Vitor Souza - DTI POA ZN 🚀
        </div>
      </footer>
    </div>
  );
}