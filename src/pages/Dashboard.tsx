// ===== IMPORTAÇÕES DO REACT =====
// Hook para estado local
import { useState } from 'react';

// ===== HOOKS CUSTOMIZADOS =====
// Hook para autenticação de usuários
import { useAuth } from '@/hooks/useAuth';
// Hook para detectar dispositivos móveis
import { useIsMobile } from '@/hooks/use-mobile';

// ===== NAVEGAÇÃO =====
// Componente para redirecionamento automático
import { Navigate } from 'react-router-dom';

// ===== COMPONENTES DE UI =====
// Componentes básicos de interface
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ===== ÍCONES =====
// Ícones do Lucide React
import { LogOut, Calendar, List, User, Settings } from 'lucide-react';

// ===== COMPONENTES ESPECÍFICOS DA APLICAÇÃO =====
// Componente para fazer novas reservas
import { MakeReservation } from '@/components/MakeReservation';
// Componente para listar reservas do usuário
import { MyReservations } from '@/components/MyReservations';
// Componente de perfil do usuário
import { Profile } from '@/components/Profile';
// Painel administrativo (apenas para admins)
import { AdminPanel } from '@/components/AdminPanel';
// Componente para mostrar reservas de hoje
import { TodayReservations } from '@/components/TodayReservations';
// Componente para reservas de auditório
import { AuditoriumReservations } from '@/components/AuditoriumReservations';
// Componente para reservas de laboratório
import { LaboratoryReservations } from '@/components/LaboratoryReservations';
// Menu lateral para dispositivos móveis
import { MobileSidebar } from '@/components/MobileSidebar';
// Popup de alertas administrativos
import { AlertPopup } from '@/components/AlertPopup';

// ===== HOOKS PARA ALERTAS =====
// Hook customizado para gerenciar alertas
import { useAlerts } from '@/hooks/useAlerts';

// ===== COMPONENTE PRINCIPAL DO DASHBOARD =====
// Esta é a página principal da aplicação após o login
// Contém toda a interface do sistema de reservas
export default function Dashboard() {
  // ===== ESTADOS E HOOKS =====
  // Dados de autenticação do usuário
  const { user, profile, loading, signOut } = useAuth();
  // Detectar se está em dispositivo móvel
  const isMobile = useIsMobile();
  // Estado para controlar qual aba está ativa
  const [activeTab, setActiveTab] = useState('reservations');
  // Estado para alertas administrativos
  const { currentAlert, closeCurrentAlert } = useAlerts();

  // ===== ESTADO DE CARREGAMENTO =====
  // Mostrar loading enquanto a autenticação está sendo verificada
  // 🔄 ALTERNATIVAS: Skeleton loaders, Suspense boundaries
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ===== REDIRECIONAMENTO PARA LOGIN =====
  // Redireciona apenas se temos certeza que não há usuário (falha na autenticação)
  // 🔄 ADAPTAÇÃO: pode usar outros sistemas de roteamento como Next.js router
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // ===== CARREGAMENTO DO PERFIL =====
  // Mostra loading enquanto o perfil está sendo buscado (usuário existe mas perfil não carregou ainda)
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ===== RENDERIZAÇÃO PRINCIPAL =====
  return (
    <div className="min-h-screen bg-background">
      {/* ===== POPUP DE ALERTAS ===== */}
      {/* Mostra alertas administrativos quando disponíveis */}
      {currentAlert && (
        <AlertPopup alert={currentAlert} onClose={closeCurrentAlert} />
      )}
      
      {/* ===== CABEÇALHO ===== */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          
          {/* ===== LAYOUT MOBILE ===== */}
          {/* Interface adaptada para dispositivos móveis */}
          <div className="md:hidden">
            {/* Cabeçalho alinhado: menu à esquerda, textos no centro, botão sair à direita */}
            <div className="flex items-center justify-between">
              {/* Menu lateral móvel */}
              <MobileSidebar 
                onNavigate={setActiveTab} 
                currentSection={activeTab}
                isAdmin={profile.is_admin}
              />
              
              {/* ===== CONTEÚDO CENTRALIZADO ===== */}
              <div className="flex-1 text-center">
                <h1 className="text-lg font-bold">Sistema de Reservas</h1>
                <p className="text-sm text-muted-foreground">
                  Olá, {profile.display_name}
                  {/* Badge de administrador */}
                  {profile.is_admin && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                      Admin
                    </span>
                  )}
                </p>
              </div>
              
              {/* Botão de logout */}
              <Button variant="outline" onClick={signOut} size="sm">
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            </div>
          </div>

          {/* ===== LAYOUT DESKTOP ===== */}
          {/* Interface para desktop/tablet */}
          <div className="hidden md:block">
            
            {/* ===== CABEÇALHO COMPACTO - LINHA ÚNICA ===== */}
            <div className="flex items-center justify-between mb-3">
              {/* Espaço vazio à esquerda para balanceamento */}
              <div className="flex-1"></div>
              
              {/* Título centralizado */}
              <h1 className="text-2xl font-bold text-foreground">Sistema de Reservas</h1>
              
              {/* ===== SAUDAÇÃO + ADMIN BADGE + BOTÃO SAIR - LADO DIREITO ===== */}
              <div className="flex items-center gap-4 flex-1 justify-end">
                {/* Card com informações do usuário */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2">
                    {/* Avatar do usuário */}
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Olá,</p>
                      <p className="text-sm font-bold text-foreground flex items-center gap-2">
                        {profile.display_name}
                        {/* Badge de administrador */}
                        {profile.is_admin && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                            Admin
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Botão de logout */}
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-3 w-3 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== CONTEÚDO PRINCIPAL ===== */}
      <main className="container mx-auto px-4 py-8">
        {/* ===== SISTEMA DE ABAS ===== */}
        {/* Interface com abas para organizar diferentes funcionalidades */}
        {/* 🔄 ALTERNATIVAS: React Router com sub-rotas, Accordion, Sidebar navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          
          {/* ===== LISTA DE ABAS ===== */}
          {/* Grid responsivo que se adapta ao número de abas baseado no tipo de usuário */}
          <TabsList className={`grid w-full ${isMobile ? (profile.is_admin ? 'grid-cols-3' : 'grid-cols-2') : 'grid-cols-4'} ${isMobile ? 'md:hidden gap-1' : ''}`}>
            
            {/* Aba: Fazer Reserva */}
            <TabsTrigger value="reservations" className={`flex items-center ${isMobile ? 'gap-1 text-xs px-2' : 'gap-2'}`}>
              <Calendar className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              {isMobile ? 'Fazer' : 'Fazer Reserva'}
            </TabsTrigger>
            
            {/* Aba: Minhas Reservas */}
            <TabsTrigger value="my-reservations" className={`flex items-center ${isMobile ? 'gap-1 text-xs px-2' : 'gap-2'}`}>
              <List className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              {isMobile ? 'Minhas' : 'Minhas Reservas'}
            </TabsTrigger>
            
            {/* Aba: Perfil (apenas desktop) */}
            {!isMobile && (
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Meu Perfil
              </TabsTrigger>
            )}
            
            {/* Aba: Admin (apenas para administradores) */}
            {profile.is_admin && (
              <TabsTrigger value="admin" className={`flex items-center ${isMobile ? 'gap-1 text-xs px-2' : 'gap-2'}`}>
                <Settings className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          {/* ===== CONTEÚDO DAS ABAS ===== */}
          
          {/* ===== ABA: FAZER RESERVAS ===== */}
          {/* Contém formulário para novas reservas e visualizações de reservas existentes */}
          <TabsContent value="reservations" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card principal para fazer reservas */}
              <Card>
                <CardHeader>
                  <CardTitle>Fazer uma Reserva</CardTitle>
                </CardHeader>
                <CardContent>
                  <MakeReservation />
                </CardContent>
              </Card>
              
              {/* Componentes para visualizar reservas existentes */}
              <TodayReservations />
              <AuditoriumReservations />
              <LaboratoryReservations />
            </div>
          </TabsContent>

          {/* ===== ABA: MINHAS RESERVAS ===== */}
          {/* Lista todas as reservas do usuário atual */}
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

          {/* ===== ABA: PERFIL ===== */}
          {/* Permite editar informações do perfil do usuário */}
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

          {/* ===== ABA: ADMIN ===== */}
          {/* Painel administrativo - apenas para usuários administradores */}
          {/* 🔄 CONTROLE DE ACESSO: verificação dupla (aqui e no componente) */}
          {profile.is_admin && (
            <TabsContent value="admin" className="space-y-6">
              <AdminPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>
      
      {/* ===== RODAPÉ ===== */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Desenvolvido por: Vitor Souza - DTI POA ZN 🚀
        </div>
      </footer>
    </div>
  );
}