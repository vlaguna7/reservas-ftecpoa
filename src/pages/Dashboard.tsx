import { useAuth } from '@/hooks/useAuth';
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

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Sistema de Reservas</h1>
            <p className="text-muted-foreground">
              Olá, {profile.display_name}
              {profile.is_admin && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                  Admin
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="reservations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="reservations" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fazer Reserva
            </TabsTrigger>
            <TabsTrigger value="my-reservations" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Minhas Reservas
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Meu Perfil
            </TabsTrigger>
            {profile.is_admin && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Administração
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
            </div>
          </TabsContent>

          <TabsContent value="my-reservations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Minhas Reservas</CardTitle>
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
    </div>
  );
}