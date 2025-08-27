import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Projector, Speaker, Calendar, X, Building, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


interface Reservation {
  id: string;
  equipment_type: string;
  display_type?: string;
  created_at: string;
  user_id: string; // 🔐 CRÍTICO: ID único do usuário para verificação de segurança
  user_profile: {
    display_name: string;
    green_tag_text?: string | null;
    classroom_monday?: string;
    classroom_tuesday?: string;
    classroom_wednesday?: string;
    classroom_thursday?: string;
    classroom_friday?: string;
  };
}

export function TodayReservations() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const getTodayDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = domingo, 6 = sábado
    
    // Se for sábado (6) ou domingo (0), mostrar segunda-feira
    if (dayOfWeek === 0) { // Domingo
      const monday = new Date(today);
      monday.setDate(monday.getDate() + 1); // Segunda-feira
      return monday;
    } else if (dayOfWeek === 6) { // Sábado
      const monday = new Date(today);
      monday.setDate(monday.getDate() + 2); // Segunda-feira
      return monday;
    }
    
    // Dias úteis, mostrar hoje
    return today;
  };

  const fetchTodayReservations = async () => {
    try {
      const targetDate = getTodayDate();
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      
      console.log('🔍 TodayReservations: Fetching reservations for date:', dateStr);

      // Buscar apenas reservas de projetores e caixas de som
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('id, equipment_type, user_id, created_at')
        .eq('reservation_date', dateStr)
        .in('equipment_type', ['projector', 'speaker'])
        .order('created_at', { ascending: true });

      console.log('🔍 TodayReservations: Raw reservation data:', reservationData);

      if (reservationError) {
        console.error('❌ TodayReservations: Error fetching reservations:', reservationError);
        return;
      }

      if (!reservationData || reservationData.length === 0) {
        console.log('📭 TodayReservations: No reservations found for today');
        setReservations([]);
        return;
      }

      // Buscar nomes dos laboratórios para mapear códigos
      const { data: labData } = await supabase
        .from('laboratory_settings')
        .select('laboratory_code, laboratory_name');

      // Criar mapeamento de códigos de laboratório para nomes
      const laboratoryNames: Record<string, string> = {};
      labData?.forEach(lab => {
        laboratoryNames[lab.laboratory_code] = lab.laboratory_name;
      });

      console.log('🔍 TodayReservations: Laboratory mapping:', laboratoryNames);
      console.log('🔍 TodayReservations: Looking for laboratory:', reservationData.filter(r => r.equipment_type.startsWith('laboratory_')));

      if (reservationData.length === 0) {
        console.log('📭 TodayReservations: No reservations found for today');
        setReservations([]);
        return;
      }

      // Segunda query: buscar perfis dos usuários
      const userIds = reservationData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name, green_tag_text, classroom_monday, classroom_tuesday, classroom_wednesday, classroom_thursday, classroom_friday')
        .in('user_id', userIds);

      if (profileError) {
        console.error('❌ TodayReservations: Error fetching profiles:', profileError);
        return;
      }

      console.log('👥 TodayReservations: Profile data:', profileData);

      // Combinar dados
      const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
      const combinedData = reservationData.map(reservation => {
        // Para laboratórios, usar o nome mapeado se disponível
        let displayType = reservation.equipment_type;
        if (reservation.equipment_type.startsWith('laboratory_')) {
          displayType = laboratoryNames[reservation.equipment_type] || reservation.equipment_type;
          console.log(`🔍 TodayReservations: Mapping laboratory ${reservation.equipment_type} to "${displayType}"`);
        }
          
        return {
          id: reservation.id,
          equipment_type: reservation.equipment_type,
          display_type: displayType,
          created_at: reservation.created_at,
          user_id: reservation.user_id, // 🔐 IMPORTANTE: Incluir user_id para verificação de segurança
          user_profile: {
            display_name: profileMap.get(reservation.user_id)?.display_name || 'Professor não identificado',
            green_tag_text: profileMap.get(reservation.user_id)?.green_tag_text || null,
            classroom_monday: profileMap.get(reservation.user_id)?.classroom_monday || null,
            classroom_tuesday: profileMap.get(reservation.user_id)?.classroom_tuesday || null,
            classroom_wednesday: profileMap.get(reservation.user_id)?.classroom_wednesday || null,
            classroom_thursday: profileMap.get(reservation.user_id)?.classroom_thursday || null,
            classroom_friday: profileMap.get(reservation.user_id)?.classroom_friday || null
          }
        };
      });

      console.log('✅ TodayReservations: Final combined data:', combinedData);
      setReservations(combinedData);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 TodayReservations: Initializing component...');
    fetchTodayReservations();
    
    // Configurar realtime updates para reservas
    const reservationsChannelName = `today-reservations-${Date.now()}`;
    console.log('📡 TodayReservations: Creating reservations channel:', reservationsChannelName);
    
    const reservationsChannel = supabase
      .channel(reservationsChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          console.log('🔄 TodayReservations: Reservations change detected:', payload);
          
          // Atualização mais rápida
          fetchTodayReservations();
          
          // Segunda atualização para garantir sincronização
          setTimeout(() => {
            console.log('🔄 TodayReservations: Second fetch for sync...');
            fetchTodayReservations();
          }, 500);
        }
      )
      .subscribe((status) => {
        console.log('📡 TodayReservations reservations realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ TodayReservations: Successfully subscribed to reservations updates');
        }
      });

    // Configurar realtime updates para laboratory_settings (quando novos laboratórios são criados)
    const labChannelName = `laboratory-settings-${Date.now()}`;
    console.log('📡 TodayReservations: Creating laboratory settings channel:', labChannelName);
    
    const labChannel = supabase
      .channel(labChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laboratory_settings'
        },
        (payload) => {
          console.log('🔄 TodayReservations: Laboratory settings change detected:', payload);
          
          // Quando laboratórios são adicionados/modificados, recarregar dados
          fetchTodayReservations();
        }
      )
      .subscribe((status) => {
        console.log('📡 TodayReservations laboratory settings realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ TodayReservations: Successfully subscribed to laboratory settings updates');
        }
      });

    // Configurar realtime updates para profiles (quando nomes de display são alterados)
    const profilesChannelName = `profiles-${Date.now()}`;
    console.log('📡 TodayReservations: Creating profiles channel:', profilesChannelName);
    
    const profilesChannel = supabase
      .channel(profilesChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🔄 TodayReservations: Profile change detected:', payload);
          fetchTodayReservations();
        }
      )
      .subscribe((status) => {
        console.log('📡 TodayReservations profiles realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ TodayReservations: Successfully subscribed to profiles updates');
        }
      });
    
    // Atualizar a cada minuto para verificar mudança de dia
    const interval = setInterval(() => {
      const now = new Date();
      // Atualizar às 00:01 (início do dia)
      if (now.getHours() === 0 && now.getMinutes() <= 1) {
        console.log('🌅 TodayReservations: New day detected, refreshing...');
        fetchTodayReservations();
      }
    }, 60000); // 1 minuto

    return () => {
      console.log('🧹 TodayReservations: Cleaning up channels and interval');
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(labChannel);
      supabase.removeChannel(profilesChannel);
      clearInterval(interval);
    };
  }, []);

  const getEquipmentIcon = (type: string) => {
    if (type.startsWith('laboratory_')) {
      return <FlaskConical className="h-4 w-4" />;
    }
    
    switch (type) {
      case 'projector':
        return <Projector className="h-4 w-4" />;
      case 'speaker':
        return <Speaker className="h-4 w-4" />;
      case 'auditorium':
        return <Building className="h-4 w-4" />;
      default:
        return <FlaskConical className="h-4 w-4" />;
    }
  };

  const getEquipmentLabel = (reservation: Reservation) => {
    if (reservation.display_type && reservation.equipment_type.startsWith('laboratory_')) {
      return reservation.display_type;
    }
    
    switch (reservation.equipment_type) {
      case 'projector':
        return 'Projetor';
      case 'speaker':
        return 'Caixa de Som';
      case 'auditorium':
        return 'Auditório';
      default:
        return reservation.equipment_type;
    }
  };

  const cancelReservation = async (reservationId: string) => {
    try {
      console.log('Attempting to cancel reservation:', reservationId);
      
      const { data, error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)
        .select(); // Retornar dados para confirmar a deleção

      console.log('Delete result:', { data, error });

      if (error) {
        console.error('Error canceling reservation:', error);
        toast({
          title: "Erro ao cancelar reserva",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data && data.length > 0) {
        console.log('Reservation successfully deleted:', data[0]);
        
        // Email notifications have been removed for security reasons  
        console.log('✅ Today reservation cancelled successfully:', data[0]);
        
        toast({
          title: "Reserva cancelada!",
          description: "A reserva foi cancelada com sucesso."
        });
        
        // Forçar atualização imediata dos dados
        await fetchTodayReservations();
        
        // Pequeno delay e segunda atualização para garantir sincronização
        setTimeout(async () => {
          await fetchTodayReservations();
        }, 500);
        
      } else {
        console.error('No data returned from delete operation');
        toast({
          title: "Erro ao cancelar reserva",
          description: "A reserva não pôde ser encontrada ou já foi cancelada.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Exception in cancelReservation:', error);
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
  const canUserCancelReservation = (reservation: Reservation) => {
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

  const targetDate = getTodayDate();
  const isWeekend = [0, 6].includes(new Date().getDay());

  // Agrupar reservas por professor (usando user_id para separar usuários com mesmo nome)
  const groupedReservations = reservations.reduce((acc, reservation) => {
    const teacherName = reservation.user_profile?.display_name || 'Professor não identificado';
    const userId = reservation.user_id;
    const groupKey = `${teacherName}_${userId}`;
    
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(reservation);
    return acc;
  }, {} as Record<string, Reservation[]>);

  // Função helper para obter nome de exibição
  const getDisplayName = (groupKey: string, reservationsList: Reservation[]): string => {
    return reservationsList[0]?.user_profile?.display_name || 'Professor não identificado';
  };

  // Get current day classroom
  const getCurrentDayClassroom = (userProfile: any) => {
    if (!userProfile) return null;
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    switch (dayOfWeek) {
      case 1: return userProfile.classroom_monday;
      case 2: return userProfile.classroom_tuesday;
      case 3: return userProfile.classroom_wednesday;
      case 4: return userProfile.classroom_thursday;
      case 5: return userProfile.classroom_friday;
      default: return null; // Weekend
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reservas de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Carregando reservas...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Reservas para {format(targetDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </CardTitle>
        {isWeekend && (
          <p className="text-sm text-muted-foreground">
            Exibindo reservas da próxima segunda-feira
          </p>
        )}
      </CardHeader>
      <CardContent>
        {Object.keys(groupedReservations).length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma reserva para hoje</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedReservations).map(([groupKey, teacherReservations]) => (
              <div key={groupKey} className="border rounded-lg p-3 sm:p-4">
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <h3 className="font-semibold text-base sm:text-lg">
                    {getDisplayName(groupKey, teacherReservations)}
                  </h3>
                  {getCurrentDayClassroom(teacherReservations[0]?.user_profile) && (
                    <Badge className="bg-green-100 text-green-800 text-xs px-2 py-0.5 shrink-0">
                      {getCurrentDayClassroom(teacherReservations[0]?.user_profile)}
                    </Badge>
                  )}
                </div>
                 <div className="space-y-3">
                   {teacherReservations.map((reservation) => {
                     const equipmentLabel = getEquipmentLabel(reservation);
                     const equipmentIcon = getEquipmentIcon(reservation.equipment_type);
                     
                     console.log(`🔍 TodayReservations: Rendering reservation:`, {
                       id: reservation.id,
                       equipment_type: reservation.equipment_type,
                       display_type: reservation.display_type,
                       equipmentLabel,
                       hasIcon: !!equipmentIcon
                     });
                     
                     return (
                       <div
                         key={reservation.id}
                         className="bg-primary/10 rounded-lg p-3"
                       >
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2 text-primary mb-2">
                             {equipmentIcon}
                             <span className="font-medium">{equipmentLabel}</span>
                           </div>
                          {canUserCancelReservation(reservation) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 h-6 w-6"
                                  title="Cancelar reserva"
                                >
                                  <X className="h-3 w-3" />
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
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Horário da solicitação:</span>{" "}
                          <span>{format(new Date(reservation.created_at), 'HH:mm')}</span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}