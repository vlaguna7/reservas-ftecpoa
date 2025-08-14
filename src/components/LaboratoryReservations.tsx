// ===== IMPORTAÇÕES DE BIBLIOTECAS =====
// React hooks para estado e efeitos colaterais
import { useState, useEffect } from 'react';
// Hook customizado para autenticação
import { useAuth } from '@/hooks/useAuth';
// Cliente Supabase para operações de banco de dados
// 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
// - MySQL/PostgreSQL: import mysql2 ou pg
// - MongoDB: import mongoose ou mongodb driver
// - Firebase: import { getFirestore } from 'firebase/firestore'
import { supabase } from '@/integrations/supabase/client';
// Componentes de UI do shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Ícones do Lucide React
import { FlaskConical, Calendar, ChevronDown, ChevronRight, X } from 'lucide-react';
// Biblioteca para formatação de datas
// 🔄 ADAPTAÇÃO: Pode usar moment.js, dayjs ou Date nativo
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// Hook para notificações toast
import { toast } from '@/hooks/use-toast';
// Componentes para expandir/colapsar conteúdo
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
// Componentes para diálogos de confirmação
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
// ===== FUNÇÃO DE NOTIFICAÇÃO POR E-MAIL =====
// Importa função que envia e-mails via Edge Function
// 📧 Esta função chama uma API serverless que usa Resend.com
// 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
// - Node.js: criar endpoint Express que usa nodemailer
// - PHP: criar script PHP que usa PHPMailer
// - Python: criar endpoint FastAPI que usa smtplib
// - .NET: criar controller que usa System.Net.Mail
import { sendReservationNotification } from '@/lib/emailNotifications';

interface LaboratoryReservation {
  id: string;
  reservation_date: string;
  observation: string;
  created_at: string;
  equipment_type: string;
  user_id: string; // 🔐 CRÍTICO: ID único do usuário para verificação de segurança
  user_profile: {
    display_name: string;
  };
}

// Lista dinâmica dos laboratórios que será carregada do banco
let laboratoryNames: Record<string, string> = {};

export function LaboratoryReservations() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<LaboratoryReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchLaboratoryReservations = async () => {
    try {
      // Primeiro, buscar todos os laboratórios para criar o mapeamento de nomes
      const { data: labData, error: labError } = await supabase
        .from('laboratory_settings')
        .select('laboratory_code, laboratory_name');

      if (labError) {
        console.error('Error fetching laboratory names:', labError);
      } else {
        // Atualizar o mapeamento global de nomes
        laboratoryNames = {};
        labData?.forEach(lab => {
          laboratoryNames[lab.laboratory_code] = lab.laboratory_name;
        });
      }

      // Buscar todas as reservas de laboratório a partir de hoje
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Lista dos valores válidos de laboratório
      const laboratoryValues = Object.keys(laboratoryNames);

      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('id, reservation_date, observation, user_id, created_at, equipment_type')
        .in('equipment_type', laboratoryValues)
        .gte('reservation_date', todayStr)
        .order('reservation_date', { ascending: true });

      if (reservationError) {
        console.error('Error fetching laboratory reservations:', reservationError);
        return;
      }

      if (!reservationData || reservationData.length === 0) {
        console.log('No laboratory reservations found');
        setReservations([]);
        return;
      }

      // Buscar perfis dos usuários
      const userIds = reservationData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
      }

      // Combinar dados
      const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
      const combinedData = reservationData.map(reservation => ({
        id: reservation.id,
        reservation_date: reservation.reservation_date,
        observation: reservation.observation || '',
        created_at: reservation.created_at,
        equipment_type: reservation.equipment_type,
        user_id: reservation.user_id, // 🔐 IMPORTANTE: Incluir user_id para verificação de segurança
        user_profile: {
          display_name: profileMap.get(reservation.user_id)?.display_name || 'Professor não identificado'
        }
      }));

      console.log('Laboratory reservations loaded:', combinedData);
      setReservations(combinedData);
    } catch (error) {
      console.error('Error fetching laboratory reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaboratoryReservations();

    // Configurar realtime updates
    const channelName = `laboratory-reservations-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          console.log('🔄 LaboratoryReservations: Real-time change detected:', payload);
          // Verificar se é uma mudança relacionada a laboratório
          const newEquipmentType = (payload.new as any)?.equipment_type;
          const oldEquipmentType = (payload.old as any)?.equipment_type;
          
          if (newEquipmentType?.startsWith('laboratory_') || 
              oldEquipmentType?.startsWith('laboratory_')) {
            setTimeout(() => {
              fetchLaboratoryReservations();
            }, 300);
            
            // Segunda atualização para garantir sincronização
            setTimeout(() => {
              fetchLaboratoryReservations();
            }, 700);
            
            // Terceira atualização para casos mais lentos
            setTimeout(() => {
              fetchLaboratoryReservations();
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ===== FUNÇÃO DE CANCELAMENTO DE RESERVA =====
  // Esta função cancela uma reserva específica do laboratório
  // e envia notificação por e-mail para os administradores
  const cancelReservation = async (reservationId: string) => {
    try {
      console.log('🔄 Iniciando cancelamento da reserva:', reservationId);
      
      // ===== DELETAR RESERVA DO BANCO DE DADOS =====
      // Usando Supabase client para deletar a reserva
      // 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
      // - MySQL/PostgreSQL: DELETE FROM reservations WHERE id = ?
      // - MongoDB: db.reservations.deleteOne({_id: ObjectId(reservationId)})
      // - Firebase: doc(db, 'reservations', reservationId).delete()
      const { data, error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)
        .select(); // 📝 Retorna os dados deletados para confirmação e envio de e-mail

      console.log('📊 Resultado da deleção:', { data, error });

      // ===== TRATAMENTO DE ERRO NA DELEÇÃO =====
      if (error) {
        console.error('❌ Erro ao deletar reserva:', error);
        toast({
          title: "Erro ao cancelar reserva",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // ===== VERIFICAR SE A RESERVA FOI REALMENTE DELETADA =====
      if (data && data.length > 0) {
        console.log('✅ Reserva deletada com sucesso:', data[0]);
        
        // ===== ENVIO DE NOTIFICAÇÃO POR E-MAIL =====
        // Enviamos e-mail em background para não travar a interface
        // 📧 Esta parte chama uma Edge Function do Supabase que usa Resend.com
        // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
        // - Node.js: usar nodemailer ou sendgrid
        // - PHP: usar PHPMailer ou mail() nativo
        // - Python: usar smtplib ou sendgrid
        // - .NET: usar System.Net.Mail ou SendGrid SDK
        const deletedReservation = data[0];
        sendReservationNotification({
          id: deletedReservation.id,
          equipment_type: deletedReservation.equipment_type,
          reservation_date: deletedReservation.reservation_date,
          observation: deletedReservation.observation,
          time_slots: deletedReservation.time_slots,
          user_id: deletedReservation.user_id
        }, 'cancelled').catch(error => {
          // ⚠️ Não bloqueamos a UI se o e-mail falhar
          console.error('❌ Erro ao enviar notificação por e-mail:', error);
        });
        
        // ===== FEEDBACK PARA O USUÁRIO =====
        toast({
          title: "Reserva cancelada!",
          description: "A reserva do laboratório foi cancelada com sucesso."
        });
        
        // ===== ATUALIZAR LISTA DE RESERVAS =====
        // Busca novamente os dados para sincronizar a interface
        await fetchLaboratoryReservations();
        
      } else {
        // ===== CASO A RESERVA NÃO FOI ENCONTRADA =====
        console.error('❌ Nenhum dado retornado da operação de deleção');
        toast({
          title: "Erro ao cancelar reserva",
          description: "A reserva não pôde ser encontrada ou já foi cancelada.",
          variant: "destructive"
        });
      }
    } catch (error) {
      // ===== TRATAMENTO DE EXCEÇÕES GERAIS =====
      console.error('💥 Exceção no cancelamento da reserva:', error);
      toast({
        title: "Erro ao cancelar reserva",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // ===== VERIFICAÇÃO DE PERMISSÃO PARA CANCELAMENTO =====
  // 🔐 CORREÇÃO DE SEGURANÇA: Usar user_id em vez de display_name
  // Esta função previne que usuários com o mesmo nome cancelem reservas uns dos outros
  const canUserCancelReservation = (reservation: LaboratoryReservation) => {
    // ===== ADMINISTRADORES =====
    // Administradores podem cancelar qualquer reserva
    if (profile?.is_admin) {
      return true;
    }
    
    // ===== USUÁRIOS NORMAIS =====
    // Usuários só podem cancelar suas próprias reservas
    // 🔐 CRÍTICO: Comparar user_id (UUID único) e não display_name (pode repetir)
    // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
    // - JWT: usar user.sub ou user.id do token
    // - Session: usar session.user_id
    // - Auth0: usar user.sub
    // - Firebase: usar user.uid
    return user && user.id === reservation.user_id;
  };

  const toggleExpanded = (reservationId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reservationId)) {
        newSet.delete(reservationId);
      } else {
        newSet.add(reservationId);
      }
      return newSet;
    });
  };

  const getLaboratoryDisplayName = (equipmentType: string) => {
    return laboratoryNames[equipmentType] || equipmentType;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Reservas de Laboratórios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Carregando reservas de laboratórios...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Reservas de Laboratórios
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Todas as reservas futuras de laboratórios
        </p>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma reserva de laboratório encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="border rounded-lg">
                <Collapsible
                  open={expandedItems.has(reservation.id)}
                  onOpenChange={() => toggleExpanded(reservation.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-2 md:p-4 h-auto"
                    >
                      <div className="flex items-center gap-2 md:gap-3 text-left flex-1 min-w-0">
                        <FlaskConical className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs md:text-sm truncate">
                            {getLaboratoryDisplayName(reservation.equipment_type)}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground truncate">
                            {format(new Date(reservation.reservation_date + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground truncate">
                            {reservation.user_profile.display_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                        {canUserCancelReservation(reservation) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 h-5 w-5 md:h-6 md:w-6"
                                title="Cancelar reserva"
                              >
                                <X className="h-2 w-2 md:h-3 md:w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja cancelar a reserva?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Não</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelReservation(reservation.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Sim, cancelar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {expandedItems.has(reservation.id) ? (
                          <ChevronDown className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 border-t bg-muted/20">
                      <div className="mt-3">
                        <h4 className="font-medium text-sm mb-2">Observação:</h4>
                        <div className="bg-white p-3 rounded border text-sm">
                          {reservation.observation || 'Nenhuma observação fornecida.'}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        <span className="font-medium">Reserva feita em:</span>{" "}
                        {format(new Date(reservation.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}